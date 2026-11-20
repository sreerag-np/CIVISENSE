"""CIVISENSE API. Run from the backend folder:  uvicorn app.main:app --reload --port 8000"""
import hashlib
import hmac
import re
import secrets
import sqlite3
import string
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt
from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, Query, Request, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from . import ai, config, security
from .db import UPLOAD_DIR, db, init_db
from .logic import (CATEGORIES, CLOSED, DEPARTMENTS, POST_ASSIGN, PUBLIC_STATUSES, RISK_LEVELS, SLA_HOURS, STATUSES,
                    WORKERS_BY_RISK, chi_score, chi_tier, classify, haversine_m, karma, now_iso, priority_key,
                    public_name, public_status, route_authority, sla_info, suggest_workers)

init_db()  # idempotent; also applies column migrations to older databases


# ---------------------------------------------------------------- auth helpers
def hash_password(pw: str, salt: Optional[bytes] = None) -> str:
    salt = salt or secrets.token_bytes(16)
    dk = hashlib.pbkdf2_hmac("sha256", pw.encode(), salt, 200_000)
    return salt.hex() + "$" + dk.hex()


def verify_password(pw: str, stored: str) -> bool:
    try:
        salt_hex, _ = stored.split("$")
        return hmac.compare_digest(hash_password(pw, bytes.fromhex(salt_hex)), stored)
    except ValueError:
        return False


def make_token(user: dict) -> str:
    payload = {"sub": str(user["id"]), "role": user["role"],
               "exp": datetime.now(timezone.utc) + timedelta(hours=12)}
    return jwt.encode(payload, config.SECRET, algorithm="HS256")


def current_user(authorization: Optional[str] = Header(None)) -> Optional[dict]:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    try:
        data = jwt.decode(authorization[7:], config.SECRET, algorithms=["HS256"])
        uid = int(data["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        return None
    with db() as c:
        row = c.execute("SELECT id,name,email,role,department FROM users WHERE id=?", (uid,)).fetchone()
    return dict(row) if row else None  # role comes from the database, not from the token


def require_user(user=Depends(current_user)) -> dict:
    if not user:
        raise HTTPException(401, "Please log in.")
    return user


def require_authority(user=Depends(require_user)) -> dict:
    if user["role"] not in ("authority", "admin"):
        raise HTTPException(403, "Authority access required.")
    return user


def require_admin(user=Depends(require_user)) -> dict:
    if user["role"] != "admin":
        raise HTTPException(403, "Admin access required.")
    return user


def audit(c, request: Request, user, action: str, target: Optional[str] = None, detail: Optional[str] = None):
    """Append-only trail of security-relevant actions (logins, status changes, staff creation)."""
    c.execute("INSERT INTO audit_log(actor_id,actor_role,action,target,detail,ip,created_at) VALUES(?,?,?,?,?,?,?)",
              (user["id"] if user else None, user["role"] if user else None, action, target,
               (detail or "")[:300] or None, security.client_ip(request), now_iso()))


def is_staff(user) -> bool:
    return bool(user) and user["role"] in ("authority", "admin")


def add_event(c, report_id, status, note, actor_role, actor_name, internal, ts):
    """One line of a report's history. internal=True notes are staff-only and never shown to citizens."""
    c.execute("INSERT INTO status_events(report_id,status,note,actor_role,actor_name,internal,created_at) "
              "VALUES(?,?,?,?,?,?,?)", (report_id, status, note, actor_role, actor_name, 1 if internal else 0, ts))


def move_report(c, row, new_status, expected, ts, **fields):
    """Change status only if it is still `expected` (stops two people acting on the same report at once)."""
    sets = ", ".join(f"{k}=?" for k in fields)
    cur = c.execute(f"UPDATE reports SET status=?, {sets + ', ' if sets else ''}updated_at=? "
                    f"WHERE id=? AND status IN ({','.join('?' * len(expected))})",
                    (new_status, *fields.values(), ts, row["id"], *expected))
    if cur.rowcount != 1:
        raise HTTPException(409, "Someone else just changed this report. Reload it and try again.")


def seed_admin():
    email = config.env("CIVISENSE_ADMIN_EMAIL", "admin@civisense.local")
    with db() as c:
        if c.execute("SELECT 1 FROM users WHERE role='admin'").fetchone():
            return
        pw = config.env("CIVISENSE_ADMIN_PASSWORD")
        generated = pw is None
        if generated:
            pw = "".join(secrets.choice(string.ascii_letters + string.digits) for _ in range(14))
        c.execute("INSERT INTO users(name,email,password_hash,role,created_at) VALUES(?,?,?,?,?)",
                  ("Administrator", email.lower(), hash_password(pw), "admin", now_iso()))
    if generated:
        print(f"\n[CIVISENSE] Admin created. Email: {email}  Password: {pw}\n"
              f"            (shown once - save it, or set CIVISENSE_ADMIN_PASSWORD)\n")


def seed_demo():
    """Optional sample data (SEED_DEMO=1), always flagged is_sample=1 so every screen labels it."""
    if not config.env_bool("SEED_DEMO", False):
        return
    with db() as c:
        if c.execute("SELECT 1 FROM reports").fetchone():
            return
        rows = [
            ("road_damage", "Large pothole near the bus stand, two-wheelers swerving.", 12.0934, 75.2025, "high"),
            ("garbage", "Garbage piling up beside the market road for a week.", 12.0380, 75.3600, "medium"),
            ("street_light", "Street light not working on the school road.", 12.0400, 75.3550, "medium"),
            ("drainage", "Drain overflowing after rain, water on the road.", 11.8750, 75.3700, "high"),
        ]
        for cat, desc, lat, lng, sev in rows:
            _insert_report(c, cat, desc, lat, lng, None, None, sev, None, None, None, None, sample=1)


@asynccontextmanager
async def lifespan(_app):
    seed_admin()
    seed_demo()
    yield


app = FastAPI(title="CIVISENSE API", version="0.3.0", lifespan=lifespan,
              docs_url="/docs" if (not config.IS_PROD or config.env_bool("ENABLE_DOCS", False)) else None,
              redoc_url=None)
security.install(app)  # rate limit, size limit, logging, headers, safe 500s
# CORS is added after, so it is outermost and its headers also appear on 429/413/500 responses.
app.add_middleware(CORSMiddleware, allow_origins=config.ORIGINS, allow_credentials=False,
                   allow_methods=["GET", "POST", "PATCH", "OPTIONS"], allow_headers=["Authorization", "Content-Type"])
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


# ---------------------------------------------------------------- serialisation
def _ref() -> str:
    tail = "".join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(5))
    return f"CS-{datetime.now(timezone.utc):%Y%m%d}-{tail}"


def _insert_report(c, category, description, lat, lng, address, image_path, severity,
                   ai_category, ai_conf, ai_method, user_id, sample=0) -> dict:
    route = route_authority(lat, lng, category)
    ts = now_iso()
    near = c.execute(
        """SELECT id, lat, lng FROM reports WHERE category=? AND status NOT IN ('resolved','rejected')
           AND ABS(lat-?)<0.002 AND ABS(lng-?)<0.002 ORDER BY id""", (category, lat, lng)).fetchall()
    dup_id = next((d["id"] for d in near if haversine_m(lat, lng, d["lat"], d["lng"]) <= config.DUPLICATE_RADIUS_M), None)
    ref = _ref()
    cur = c.execute(
        """INSERT INTO reports(ref,category,description,lat,lng,address,image_path,severity,status,authority,
           department,routing_note,ai_category,ai_confidence,ai_method,duplicate_of,user_id,is_sample,created_at,updated_at)
           VALUES(?,?,?,?,?,?,?,?,'submitted',?,?,?,?,?,?,?,?,?,?,?)""",
        (ref, category, description, lat, lng, address, image_path, severity, route["authority"],
         route["department"], route["note"], ai_category, ai_conf, ai_method, dup_id, user_id, sample, ts, ts))
    c.execute("INSERT INTO status_events(report_id,status,note,actor_role,actor_name,created_at) VALUES(?,?,?,?,?,?)",
              (cur.lastrowid, "submitted", "Report submitted", "citizen", None, ts))
    return {"id": cur.lastrowid, "ref": ref, "duplicate_of_id": dup_id}


REPORT_SQL = """SELECT r.*, (SELECT ref FROM reports d WHERE d.id=r.duplicate_of) AS duplicate_of_ref
                FROM reports r"""


def report_out(r, staff: bool = False) -> dict:
    """Citizens see the public status (forwarded/approved show as 'under_review') and the worker count only once
    the administrator has sent the assigned message. Staff see the real internal status."""
    chi = chi_score(r["category"], r["severity"], r["supports"], r["created_at"])
    out = {
        "ref": r["ref"], "category": r["category"], "category_label": CATEGORIES[r["category"]][0],
        "description": r["description"], "lat": r["lat"], "lng": r["lng"], "address": r["address"],
        "image_url": f"/uploads/{r['image_path']}" if r["image_path"] else None,
        "severity": r["severity"], "risk": r["severity"],
        "status": r["status"] if staff else public_status(r["status"]), "authority": r["authority"],
        "department": r["department"], "assigned_to": r["assigned_to"], "routing_note": r["routing_note"],
        "ai_category": r["ai_category"], "ai_confidence": r["ai_confidence"], "ai_method": r["ai_method"],
        "supports": r["supports"], "duplicate_of_ref": r["duplicate_of_ref"],
        "is_sample": bool(r["is_sample"]), "created_at": r["created_at"], "updated_at": r["updated_at"],
        "chi": chi, "tier": chi_tier(chi), "priority": chi,  # priority kept as an alias for older clients
        "workers": r["workers"] if (staff or r["status"] in POST_ASSIGN) else None,
    }
    if staff:
        out["suggested_workers"] = suggest_workers(r["severity"], chi)
    out.update(sla_info(r["severity"], r["created_at"], r["status"]))
    return out


def _get_report(c, ref: str):
    row = c.execute(REPORT_SQL + " WHERE r.ref=?", (ref,)).fetchone()
    if not row:
        raise HTTPException(404, "Report not found.")
    return row


# ---------------------------------------------------------------- schemas
class RegisterIn(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    email: str = Field(max_length=120)
    password: str = Field(min_length=8, max_length=128)


class LoginIn(BaseModel):
    email: str = Field(max_length=120)
    password: str = Field(max_length=128)


class ClassifyIn(BaseModel):
    description: str = Field(max_length=1000)
    filename: str = Field(default="", max_length=200)


class StatusIn(BaseModel):
    status: str
    note: str = Field(min_length=3, max_length=500)
    department: Optional[str] = Field(default=None, max_length=100)
    authority: Optional[str] = Field(default=None, max_length=100)
    assigned_to: Optional[str] = Field(default=None, max_length=100)


class StaffIn(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    email: str = Field(max_length=120)
    password: str = Field(min_length=8, max_length=128)
    department: str = Field(max_length=100)


class DepartmentIn(BaseModel):
    department: str = Field(max_length=100)


class ForwardIn(BaseModel):
    risk: str
    department: str = Field(max_length=100)
    workers: Optional[int] = Field(default=None, ge=1, le=50)
    authority: Optional[str] = Field(default=None, max_length=100)
    note: str = Field(min_length=3, max_length=500)  # internal: citizens never see it


class ReviewIn(BaseModel):
    decision: str  # approve | decline
    note: str = Field(min_length=3, max_length=500)  # internal


class AssignIn(BaseModel):
    message: str = Field(min_length=3, max_length=500)  # this text IS shown to the citizen


EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
MIME = {"jpg": "image/jpeg", "png": "image/png", "webp": "image/webp"}


# ---------------------------------------------------------------- routes
@app.get("/api/health")
def health():
    with db() as c:
        c.execute("SELECT 1")
    return {"status": "ok", "time": now_iso(), "ai": "gemini" if ai.enabled() else "keyword-fallback"}


@app.get("/api/meta")
def meta():
    return {"categories": [{"id": k, "label": v[0]} for k, v in CATEGORIES.items()], "statuses": PUBLIC_STATUSES,
            "all_statuses": STATUSES, "departments": DEPARTMENTS, "risk_levels": RISK_LEVELS,
            "workers_by_risk": WORKERS_BY_RISK, "sla_hours": SLA_HOURS}


@app.post("/api/auth/register")
def register(body: RegisterIn, request: Request):
    email = body.email.strip().lower()
    if not EMAIL_RE.match(email):
        raise HTTPException(422, "Invalid email address.")
    with db() as c:
        if c.execute("SELECT 1 FROM users WHERE email=?", (email,)).fetchone():
            raise HTTPException(409, "An account with this email already exists.")
        cur = c.execute("INSERT INTO users(name,email,password_hash,role,created_at) VALUES(?,?,?,?,?)",
                        (body.name.strip(), email, hash_password(body.password), "citizen", now_iso()))
        user = {"id": cur.lastrowid, "name": body.name.strip(), "email": email, "role": "citizen"}
        audit(c, request, user, "register", target=str(user["id"]))
    return {"token": make_token(user), "user": user}


@app.post("/api/auth/login")
def login(body: LoginIn, request: Request):
    email = body.email.strip().lower()
    with db() as c:
        row = c.execute("SELECT * FROM users WHERE email=?", (email,)).fetchone()
        ok = bool(row) and verify_password(body.password, row["password_hash"])
        user = {"id": row["id"], "name": row["name"], "email": row["email"], "role": row["role"]} if ok else None
        audit(c, request, user, "login_ok" if ok else "login_failed", detail=None if ok else f"email={email[:80]}")
    if not ok:  # raised after the with-block so the audit row is committed
        raise HTTPException(401, "Incorrect email or password.")
    return {"token": make_token(user), "user": user}


@app.get("/api/auth/me")
def me(user=Depends(require_user)):
    return user


@app.post("/api/admin/authority-users")
def create_authority_user(body: StaffIn, request: Request, admin=Depends(require_admin)):
    email = body.email.strip().lower()
    if not EMAIL_RE.match(email):
        raise HTTPException(422, "Invalid email address.")
    if body.department not in DEPARTMENTS:
        raise HTTPException(422, "Choose a department from the list.")
    with db() as c:
        if c.execute("SELECT 1 FROM users WHERE email=?", (email,)).fetchone():
            raise HTTPException(409, "Email already in use.")
        cur = c.execute("INSERT INTO users(name,email,password_hash,role,department,created_at) VALUES(?,?,?,?,?,?)",
                        (body.name.strip(), email, hash_password(body.password), "authority", body.department, now_iso()))
        audit(c, request, admin, "create_staff", target=str(cur.lastrowid), detail=f"{email} / {body.department}")
    return {"ok": True, "email": email, "department": body.department}


@app.get("/api/admin/staff")
def list_staff(_=Depends(require_admin)):
    with db() as c:
        rows = c.execute("SELECT id,name,email,role,department FROM users WHERE role IN ('authority','admin') "
                         "ORDER BY role, name").fetchall()
    return [dict(r) for r in rows]


@app.patch("/api/admin/staff/{user_id}")
def set_staff_department(user_id: int, body: DepartmentIn, request: Request, admin=Depends(require_admin)):
    if body.department not in DEPARTMENTS:
        raise HTTPException(422, "Choose a department from the list.")
    with db() as c:
        cur = c.execute("UPDATE users SET department=? WHERE id=? AND role='authority'", (body.department, user_id))
        if cur.rowcount != 1:
            raise HTTPException(404, "Staff account not found.")
        audit(c, request, admin, "set_department", target=str(user_id), detail=body.department)
    return {"ok": True}


@app.get("/api/admin/audit")
def audit_log(limit: int = 100, _=Depends(require_admin)):
    with db() as c:
        rows = c.execute("SELECT actor_id,actor_role,action,target,detail,ip,created_at FROM audit_log "
                         "ORDER BY id DESC LIMIT ?", (max(1, min(limit, 500)),)).fetchall()
    return [dict(r) for r in rows]


@app.post("/api/classify")
async def classify_endpoint(body: ClassifyIn):
    suggestion = await run_in_threadpool(ai.analyze, body.description) if ai.enabled() else None
    return suggestion or classify(body.description, body.filename)


@app.post("/api/reports")
async def create_report(
    description: str = Form(...), lat: float = Form(...), lng: float = Form(...),
    category: Optional[str] = Form(None), address: Optional[str] = Form(None),
    image: Optional[UploadFile] = File(None), user=Depends(current_user),
):
    description = description.strip()
    if not 10 <= len(description) <= 1000:
        raise HTTPException(422, "Description must be 10-1000 characters.")
    if not (-90 <= lat <= 90 and -180 <= lng <= 180):
        raise HTTPException(422, "Invalid coordinates.")

    image_bytes, image_path, filename, mime = None, None, "", None
    if image is not None and image.filename:
        image_bytes = await image.read(config.MAX_IMAGE_BYTES + 1)
        if len(image_bytes) > config.MAX_IMAGE_BYTES:
            raise HTTPException(413, f"Image must be {config.MAX_IMAGE_BYTES // (1024 * 1024)} MB or smaller.")
        if image_bytes[:3] == b"\xff\xd8\xff":
            ext = "jpg"
        elif image_bytes[:8] == b"\x89PNG\r\n\x1a\n":
            ext = "png"
        elif image_bytes[:4] == b"RIFF" and image_bytes[8:12] == b"WEBP":
            ext = "webp"
        else:
            raise HTTPException(415, "Only JPEG, PNG or WebP images are allowed.")
        mime = MIME[ext]
        image_path = f"{secrets.token_hex(16)}.{ext}"  # random name; the client filename is never used on disk
        filename = image.filename

    # AI suggestion: Gemini if configured and it answers, otherwise keywords. The citizen's category wins.
    suggestion = None
    if ai.enabled():
        suggestion = await run_in_threadpool(ai.analyze, description, image_bytes, mime)
    suggestion = suggestion or classify(description, filename)
    chosen = category if category in CATEGORIES else suggestion["category"]

    with db() as c:
        res = _insert_report(c, chosen, description, lat, lng, (address or "").strip()[:200] or None,
                             image_path, suggestion["severity"], suggestion["category"], suggestion["confidence"],
                             suggestion["method"], user["id"] if user else None)
        row = _get_report(c, res["ref"])
    if image_path:  # write the file only after the database row exists
        (UPLOAD_DIR / image_path).write_bytes(image_bytes)
    out = report_out(row)
    out["possible_duplicate"] = bool(res["duplicate_of_id"])
    return out


@app.get("/api/reports")
def list_reports(status: Optional[str] = None, category: Optional[str] = None, department: Optional[str] = Query(None, max_length=100),
                 q: Optional[str] = Query(None, max_length=100), sort: str = "recent",
                 limit: int = 200, offset: int = 0, user=Depends(current_user)):
    staff = is_staff(user)
    where, args = [], []
    if status:
        if staff:
            where.append("r.status=?"); args.append(status)
        elif status == "under_review":  # citizens see forwarded/approved jobs as 'under review'
            where.append("r.status IN ('under_review','forwarded','approved')")
        elif status in ("forwarded", "approved"):
            where.append("1=0")
        else:
            where.append("r.status=?"); args.append(status)
    if category:
        where.append("r.category=?"); args.append(category)
    if department:
        where.append("r.department=?"); args.append(department)
    if q:
        where.append("(r.description LIKE ? OR r.ref LIKE ?)"); args += [f"%{q[:100]}%", f"%{q[:100]}%"]
    sql = REPORT_SQL + (" WHERE " + " AND ".join(where) if where else "") + " ORDER BY r.created_at DESC"
    limit, offset = max(1, min(limit, 500)), max(0, offset)
    with db() as c:
        if sort == "priority":  # most critical first: high risk, then hazard index, then oldest
            rows = c.execute(sql + " LIMIT 2000", args).fetchall()
            items = sorted((report_out(r, staff) for r in rows),
                           key=lambda x: priority_key(x["risk"], x["chi"], x["created_at"], x["status"]))
            return items[offset:offset + limit]
        rows = c.execute(sql + " LIMIT ? OFFSET ?", args + [limit, offset]).fetchall()
    return [report_out(r, staff) for r in rows]


@app.get("/api/reports/{ref}")
def get_report(ref: str, user=Depends(current_user)):
    staff = is_staff(user)
    with db() as c:
        row = _get_report(c, ref)
        events = c.execute("SELECT status,note,actor_role,internal,created_at FROM status_events WHERE report_id=? "
                           + ("" if staff else "AND internal=0 ") + "ORDER BY id", (row["id"],)).fetchall()
    out = report_out(row, staff)
    history = []
    for e in events:
        d = dict(e)
        d["internal"] = bool(d["internal"])
        if not staff:
            d.pop("internal")  # citizens never learn that internal steps exist
        history.append(d)
    out["history"] = history
    return out


@app.post("/api/reports/{ref}/support")
def support_report(ref: str, user=Depends(require_user)):
    with db() as c:
        row = _get_report(c, ref)
        if row["user_id"] == user["id"]:
            raise HTTPException(403, "You cannot support your own report.")
        try:
            c.execute("INSERT INTO supporters(report_id,user_id) VALUES(?,?)", (row["id"], user["id"]))
        except sqlite3.IntegrityError:
            raise HTTPException(409, "You have already supported this report.")
        c.execute("UPDATE reports SET supports=supports+1 WHERE id=?", (row["id"],))
        n = c.execute("SELECT supports FROM reports WHERE id=?", (row["id"],)).fetchone()["supports"]
    return {"supports": n}


@app.post("/api/reports/{ref}/forward")
def forward_report(ref: str, body: ForwardIn, request: Request, admin=Depends(require_admin)):
    """Administrator triage: confirm the risk level, choose the concerned department (e.g. Public Works for roads),
    set the number of workers, and send the job to that department for approval."""
    if body.risk not in RISK_LEVELS:
        raise HTTPException(422, f"Risk level must be one of {RISK_LEVELS}.")
    if body.department not in DEPARTMENTS:
        raise HTTPException(422, "Choose a department from the list.")
    ts = now_iso()
    with db() as c:
        row = _get_report(c, ref)
        if row["status"] not in ("submitted", "under_review"):
            raise HTTPException(409, "Only new or under-review reports can be forwarded.")
        chi = chi_score(row["category"], body.risk, row["supports"], row["created_at"])
        workers = body.workers if body.workers is not None else suggest_workers(body.risk, chi)
        if not 1 <= workers <= 50:
            raise HTTPException(422, "Workers must be between 1 and 50.")
        move_report(c, row, "forwarded", ("submitted", "under_review"), ts, severity=body.risk,
                    department=body.department, authority=body.authority or row["authority"], workers=workers)
        add_event(c, row["id"], "forwarded",
                  f"Forwarded to {body.department} as {body.risk} risk with {workers} workers. {body.note.strip()}",
                  "admin", admin["name"], True, ts)
        audit(c, request, admin, "forward", target=ref, detail=f"{body.department} / {body.risk} / {workers} workers")
        out = report_out(_get_report(c, ref), True)
    return out


@app.post("/api/reports/{ref}/review")
def review_report(ref: str, body: ReviewIn, request: Request, user=Depends(require_user)):
    """The concerned department approves or declines a forwarded job. Only that department's authority can do this."""
    if user["role"] != "authority":
        raise HTTPException(403, "Only the department's authority can approve or decline a job.")
    if body.decision not in ("approve", "decline"):
        raise HTTPException(422, "Decision must be approve or decline.")
    ts = now_iso()
    with db() as c:
        row = _get_report(c, ref)
        if row["status"] != "forwarded":
            raise HTTPException(409, "This job is not waiting for approval.")
        if not user["department"] or row["department"] != user["department"]:
            raise HTTPException(403, "This job was forwarded to a different department.")
        new = "approved" if body.decision == "approve" else "under_review"
        verb = "Approved" if body.decision == "approve" else "Declined"
        move_report(c, row, new, ("forwarded",), ts)
        add_event(c, row["id"], new, f"{verb} by {user['name']} ({user['department']}). {body.note.strip()}",
                  "authority", user["name"], True, ts)
        audit(c, request, user, f"job_{body.decision}", target=ref, detail=user["department"])
        out = report_out(_get_report(c, ref), True)
    return out


@app.post("/api/reports/{ref}/assign")
def assign_report(ref: str, body: AssignIn, request: Request, admin=Depends(require_admin)):
    """Only the administrator sends the 'assigned' message to the citizen, and only after the department approved."""
    ts = now_iso()
    with db() as c:
        row = _get_report(c, ref)
        if row["status"] != "approved":
            raise HTTPException(409, "The concerned department must approve the job before you can send the assigned message.")
        move_report(c, row, "assigned", ("approved",), ts)
        add_event(c, row["id"], "assigned", body.message.strip(), "admin", admin["name"], False, ts)  # public
        audit(c, request, admin, "send_assigned", target=ref, detail=f"{row['department']} / {row['workers']} workers")
        out = report_out(_get_report(c, ref), True)
    return out


@app.patch("/api/reports/{ref}/status")
def update_status(ref: str, body: StatusIn, request: Request, user=Depends(require_authority)):
    """Simple steps: start review, reject, start work, mark resolved, reopen. The approval steps (forward, review,
    assign) have their own endpoints so their rules cannot be skipped."""
    new, role = body.status, user["role"]
    if new not in STATUSES:
        raise HTTPException(422, f"Status must be one of {STATUSES}.")
    if new in ("forwarded", "approved", "assigned"):
        raise HTTPException(409, "Use the forward, review and assign actions for this step.")
    if body.department is not None and (role != "admin" or body.department not in DEPARTMENTS):
        raise HTTPException(403 if role != "admin" else 422, "Only an administrator can change the department.")
    ts = now_iso()
    with db() as c:
        row = _get_report(c, ref)
        cur_status = row["status"]
        own_dept = role == "admin" or (role == "authority" and user["department"] and user["department"] == row["department"])
        if cur_status in CLOSED:
            if role != "admin":
                raise HTTPException(409, "This report is closed. Ask an administrator to reopen it.")
            if new != "under_review":
                raise HTTPException(409, "Reopen a closed report to 'under review' first.")
        elif new == "under_review":
            if role != "admin" or cur_status != "submitted":
                raise HTTPException(403 if role != "admin" else 409, "Only an administrator can start the review of a new report.")
        elif new == "rejected":
            if role != "admin":
                raise HTTPException(403, "Only an administrator can reject a report.")
            if cur_status not in ("submitted", "under_review"):
                raise HTTPException(409, "A job already sent to a department cannot be rejected from here.")
        elif new == "in_progress":
            if not own_dept:
                raise HTTPException(403, "Only the concerned department can start the work.")
            if cur_status != "assigned":
                raise HTTPException(409, "Work can start only after the administrator has sent the assigned message.")
        elif new == "resolved":
            if not own_dept:
                raise HTTPException(403, "Only the concerned department can mark the work as resolved.")
            if cur_status not in ("assigned", "in_progress"):
                raise HTTPException(409, "Only assigned or in-progress work can be resolved.")
        else:
            raise HTTPException(409, "A report cannot go back to 'submitted'.")
        fields = {"assigned_to": body.assigned_to} if body.assigned_to else {}
        if body.department is not None:
            fields["department"] = body.department
        if body.authority and role == "admin":
            fields["authority"] = body.authority
        move_report(c, row, new, (cur_status,), ts, **fields)
        add_event(c, row["id"], new, body.note.strip(), role, user["name"], False, ts)
        audit(c, request, user, "status_update", target=ref, detail=f"{cur_status} -> {new}")
        out = report_out(_get_report(c, ref), True)
    return out


@app.get("/api/leaderboard")
def leaderboard(limit: int = 20):
    """Karma = 10 per report + 25 per resolved report + 2 per support from others.
    Sample records, rejected reports and duplicates earn nothing, so spamming does not pay. Names are shortened."""
    with db() as c:
        rows = c.execute(
            """SELECT u.id, u.name, COUNT(r.id) AS reports,
                      SUM(CASE WHEN r.status='resolved' THEN 1 ELSE 0 END) AS resolved,
                      COALESCE(SUM(r.supports),0) AS supports
               FROM users u JOIN reports r ON r.user_id=u.id
               WHERE u.role='citizen' AND r.is_sample=0 AND r.status!='rejected' AND r.duplicate_of IS NULL
               GROUP BY u.id""").fetchall()
    board = [{"name": public_name(r["name"]), "reports": r["reports"], "resolved": r["resolved"],
              "supports": r["supports"], "karma": karma(r["reports"], r["resolved"], r["supports"])} for r in rows]
    board.sort(key=lambda b: (-b["karma"], b["name"]))
    return [{"rank": i + 1, **b} for i, b in enumerate(board[:max(1, min(limit, 100))])]


def _hours(a: str, b: str) -> float:
    return (datetime.fromisoformat(b) - datetime.fromisoformat(a)).total_seconds() / 3600


@app.get("/api/analytics")
def analytics(include_sample: bool = True):
    """Computed only from recorded reports and status events. Nothing is hardcoded."""
    only_real = "" if include_sample else " WHERE is_sample=0"
    ev_real = "" if include_sample else " WHERE r.is_sample=0"
    with db() as c:
        reports = c.execute("SELECT id,category,severity,status,authority,supports,created_at,is_sample "
                            f"FROM reports{only_real}").fetchall()
        events = c.execute("SELECT e.report_id,e.status,e.created_at FROM status_events e "
                           f"JOIN reports r ON r.id=e.report_id{ev_real} ORDER BY e.id").fetchall()
    by_report = {}
    for e in events:
        by_report.setdefault(e["report_id"], []).append(e)
    first_resp, resolution, within_sla = [], [], []
    for r in reports:
        evs = by_report.get(r["id"], [])
        later = [e for e in evs if e["status"] != "submitted"]
        if later:
            first_resp.append(_hours(r["created_at"], later[0]["created_at"]))
        done = [e for e in evs if e["status"] == "resolved"]
        if done:
            h = _hours(r["created_at"], done[-1]["created_at"])
            resolution.append(h)
            within_sla.append(h <= SLA_HOURS.get(r["severity"], SLA_HOURS["medium"]))
    open_rows = [r for r in reports if r["status"] not in CLOSED]
    avg = lambda xs: round(sum(xs) / len(xs), 1) if xs else None
    count = lambda key: {k: sum(1 for r in reports if r[key] == k) for k in {r[key] for r in reports if r[key]}}
    chis = [chi_score(r["category"], r["severity"], r["supports"], r["created_at"]) for r in open_rows]
    tiers = {}
    for v in chis:
        tiers[chi_tier(v)] = tiers.get(chi_tier(v), 0) + 1
    return {
        "total": len(reports),
        "open": len(open_rows),
        "resolved": sum(1 for r in reports if r["status"] == "resolved"),
        "overdue": sum(1 for r in open_rows if sla_info(r["severity"], r["created_at"], r["status"])["overdue"]),
        "sample_records": sum(1 for r in reports if r["is_sample"]),
        "include_sample": include_sample,
        "avg_first_response_hours": avg(first_resp),
        "avg_resolution_hours": avg(resolution),
        "resolved_within_sla_pct": round(100 * sum(within_sla) / len(within_sla)) if within_sla else None,
        "avg_open_chi": avg(chis),
        "open_by_tier": tiers,
        "by_status": {k: sum(1 for r in reports if public_status(r["status"]) == k)
                      for k in {public_status(r["status"]) for r in reports}},
        "open_by_risk": {k: sum(1 for r in open_rows if r["severity"] == k) for k in RISK_LEVELS},
        "by_category": count("category"),
        "open_by_authority": {a: sum(1 for r in open_rows if r["authority"] == a)
                              for a in {r["authority"] for r in open_rows if r["authority"]}},
        "basis": "Computed from recorded reports and status events. CHI and SLA targets are prototype heuristics.",
    }


# ---------------------------------------------------------------- serve the built website (same domain)
_dist = config.FRONTEND_DIST.resolve()
if (_dist / "index.html").exists():
    @app.get("/{full_path:path}", include_in_schema=False)
    def spa(full_path: str):
        if full_path.startswith(("api/", "uploads/")):
            raise HTTPException(404, "Not found.")
        target = (_dist / full_path).resolve()
        if full_path and target.is_file() and _dist in target.parents:  # blocks ../ path tricks
            return FileResponse(target)
        return FileResponse(_dist / "index.html")

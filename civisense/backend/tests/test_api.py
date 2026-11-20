"""End-to-end API tests. Need the real dependencies:  pip install -r requirements-dev.txt"""
import pytest

pytest.importorskip("fastapi")
pytest.importorskip("httpx")
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

PNG = b"\x89PNG\r\n\x1a\n" + b"0" * 64


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:  # runs startup: seeds the admin
        yield c


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _login(client, email, password):
    r = client.post("/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return r.json()["token"]


def _report(client, headers=None, lat=12.09, lng=75.20, desc="Large pothole near the bus stand", **extra):
    data = {"description": desc, "lat": str(lat), "lng": str(lng), **extra}
    return client.post("/api/reports", data=data, headers=headers or {})


def test_health(client):
    assert client.get("/api/health").json()["status"] == "ok"


def test_security_headers_present(client):
    r = client.get("/api/health")
    assert r.headers["x-content-type-options"] == "nosniff"
    assert "x-request-id" in r.headers


def test_wrong_password_rejected_and_audited(client):
    assert client.post("/api/auth/login", json={"email": "admin@test.local", "password": "nope"}).status_code == 401
    admin = _login(client, "admin@test.local", "AdminPass123!")
    log = client.get("/api/admin/audit", headers=_auth(admin)).json()
    assert any(e["action"] == "login_failed" for e in log)


def test_create_report_and_track(client):
    r = _report(client, lat=12.5, lng=75.5, desc="Garbage dumped beside the market")
    assert r.status_code == 200, r.text
    ref = r.json()["ref"]
    got = client.get(f"/api/reports/{ref}").json()
    assert got["status"] == "submitted" and got["history"][0]["status"] == "submitted"
    assert 1 <= got["chi"] <= 100 and got["sla_hours"] > 0


def test_rejects_bad_input(client):
    assert _report(client, desc="short").status_code == 422
    assert _report(client, lat=999).status_code == 422
    fake = client.post("/api/reports", data={"description": "Pothole on main road", "lat": "12", "lng": "75"},
                       files={"image": ("x.jpg", b"not really an image", "image/jpeg")})
    assert fake.status_code == 415


def test_png_upload_accepted(client):
    r = client.post("/api/reports", data={"description": "Street light broken here", "lat": "12.6", "lng": "75.6"},
                    files={"image": ("photo.png", PNG, "image/png")})
    assert r.status_code == 200 and r.json()["image_url"].endswith(".png")
    assert client.get(r.json()["image_url"]).status_code == 200


def test_duplicate_flagged(client):
    first = _report(client, lat=12.7, lng=75.7, desc="Deep pothole on the road").json()
    again = _report(client, lat=12.70005, lng=75.70005, desc="Deep pothole on the road").json()
    assert again["possible_duplicate"] is True and again["duplicate_of_ref"] == first["ref"]


def _staff(client, admin, email, department):
    r = client.post("/api/admin/authority-users", headers=_auth(admin),
                    json={"name": "Officer " + department[:6], "email": email, "password": "officer1234", "department": department})
    assert r.status_code == 200, r.text
    return _login(client, email, "officer1234")


def test_status_update_requires_staff_and_is_logged(client):
    ref = _report(client, lat=13.0, lng=76.0, desc="Water pipe leaking badly").json()["ref"]
    body = {"status": "under_review", "note": "Inspection scheduled"}
    assert client.patch(f"/api/reports/{ref}/status", json=body).status_code == 401
    citizen = client.post("/api/auth/register", json={"name": "Asha K", "email": "asha@test.local", "password": "citizen123"}).json()["token"]
    assert client.patch(f"/api/reports/{ref}/status", json=body, headers=_auth(citizen)).status_code == 403
    admin = _login(client, "admin@test.local", "AdminPass123!")
    ok = client.patch(f"/api/reports/{ref}/status", json={**body, "assigned_to": "Team 4"}, headers=_auth(admin))
    assert ok.status_code == 200 and ok.json()["assigned_to"] == "Team 4"
    assert client.get(f"/api/reports/{ref}").json()["history"][-1]["note"] == "Inspection scheduled"


def test_full_approval_workflow(client):
    admin = _login(client, "admin@test.local", "AdminPass123!")
    roads = _staff(client, admin, "pwd@test.local", "Public Works (Roads)")
    water = _staff(client, admin, "water@test.local", "Water Authority")
    ref = _report(client, lat=13.2, lng=76.2, desc="Huge pothole on the main road").json()["ref"]
    fwd = {"risk": "high", "department": "Public Works (Roads)", "note": "Dangerous for bikes"}

    # only the administrator forwards
    assert client.post(f"/api/reports/{ref}/forward", json=fwd, headers=_auth(roads)).status_code == 403
    r = client.post(f"/api/reports/{ref}/forward", json=fwd, headers=_auth(admin))
    assert r.status_code == 200 and r.json()["status"] == "forwarded" and r.json()["workers"] >= 6

    # citizens see 'under review', no workers, and no internal notes
    pub = client.get(f"/api/reports/{ref}").json()
    assert pub["status"] == "under_review" and pub["workers"] is None
    assert all("internal" not in h for h in pub["history"])
    assert "Dangerous for bikes" not in str(pub["history"])
    staff_view = client.get(f"/api/reports/{ref}", headers=_auth(admin)).json()
    assert staff_view["status"] == "forwarded" and any(h["internal"] for h in staff_view["history"])

    # admin cannot skip the department; wrong department cannot approve
    assert client.post(f"/api/reports/{ref}/assign", json={"message": "Assigned"}, headers=_auth(admin)).status_code == 409
    assert client.post(f"/api/reports/{ref}/review", json={"decision": "approve", "note": "ok"}, headers=_auth(admin)).status_code == 403
    assert client.post(f"/api/reports/{ref}/review", json={"decision": "approve", "note": "ok ok"}, headers=_auth(water)).status_code == 403
    # generic status endpoint cannot bypass the workflow
    assert client.patch(f"/api/reports/{ref}/status", json={"status": "assigned", "note": "skip"}, headers=_auth(admin)).status_code == 409
    assert client.patch(f"/api/reports/{ref}/status", json={"status": "resolved", "note": "skip"}, headers=_auth(roads)).status_code == 409

    ok = client.post(f"/api/reports/{ref}/review", json={"decision": "approve", "note": "Crew free Monday"}, headers=_auth(roads))
    assert ok.status_code == 200 and ok.json()["status"] == "approved"
    assert client.get(f"/api/reports/{ref}").json()["status"] == "under_review"  # still hidden from the citizen

    # only the administrator sends the assigned message
    msg = {"message": "Approved by Public Works. Crew of 6 assigned."}
    assert client.post(f"/api/reports/{ref}/assign", json=msg, headers=_auth(roads)).status_code == 403
    assert client.post(f"/api/reports/{ref}/assign", json=msg, headers=_auth(admin)).status_code == 200
    pub = client.get(f"/api/reports/{ref}").json()
    assert pub["status"] == "assigned" and pub["workers"] >= 6
    assert pub["history"][-1]["note"] == msg["message"]

    # department finishes the work
    assert client.patch(f"/api/reports/{ref}/status", json={"status": "resolved", "note": "Filled"}, headers=_auth(water)).status_code == 403
    assert client.patch(f"/api/reports/{ref}/status", json={"status": "resolved", "note": "Filled"}, headers=_auth(roads)).status_code == 200


def test_decline_returns_job_to_administrator(client):
    admin = _login(client, "admin@test.local", "AdminPass123!")
    roads = _login(client, "pwd@test.local", "officer1234")
    ref = _report(client, lat=13.3, lng=76.3, desc="Pothole near the school gate").json()["ref"]
    client.post(f"/api/reports/{ref}/forward", headers=_auth(admin),
                json={"risk": "medium", "department": "Public Works (Roads)", "workers": 3, "note": "Check it"})
    r = client.post(f"/api/reports/{ref}/review", json={"decision": "decline", "note": "Not our road"}, headers=_auth(roads))
    assert r.status_code == 200 and r.json()["status"] == "under_review"
    assert client.post(f"/api/reports/{ref}/forward", headers=_auth(admin),
                       json={"risk": "medium", "department": "General Administration", "note": "Try another"}).status_code == 200


def test_closed_report_needs_admin_to_reopen(client):
    admin = _login(client, "admin@test.local", "AdminPass123!")
    drains = _staff(client, admin, "tree@test.local", "General Administration")
    ref = _report(client, lat=13.1, lng=76.1, desc="Fallen tree blocking the lane").json()["ref"]
    client.post(f"/api/reports/{ref}/forward", headers=_auth(admin),
                json={"risk": "high", "department": "General Administration", "note": "Blocks the road"})
    client.post(f"/api/reports/{ref}/review", json={"decision": "approve", "note": "Approved"}, headers=_auth(drains))
    client.post(f"/api/reports/{ref}/assign", json={"message": "Crew assigned"}, headers=_auth(admin))
    done = {"status": "resolved", "note": "Tree removed"}
    assert client.patch(f"/api/reports/{ref}/status", json=done, headers=_auth(drains)).status_code == 200
    again = {"status": "under_review", "note": "Reopening"}
    assert client.patch(f"/api/reports/{ref}/status", json=again, headers=_auth(drains)).status_code == 409
    assert client.patch(f"/api/reports/{ref}/status", json=again, headers=_auth(admin)).status_code == 200


def test_priority_sort_puts_high_risk_first(client):
    admin = _login(client, "admin@test.local", "AdminPass123!")
    items = client.get("/api/reports?sort=priority", headers=_auth(admin)).json()
    open_items = [i for i in items if i["status"] not in ("resolved", "rejected")]
    ranks = [{"high": 0, "medium": 1, "low": 2}[i["risk"]] for i in open_items]
    assert ranks == sorted(ranks)


def test_support_rules_and_leaderboard(client):
    owner = client.post("/api/auth/register", json={"name": "Ravi Menon", "email": "ravi@test.local", "password": "citizen123"}).json()["token"]
    ref = _report(client, headers=_auth(owner), lat=13.2, lng=76.2, desc="Open drain overflowing today").json()["ref"]
    assert client.post(f"/api/reports/{ref}/support", headers=_auth(owner)).status_code == 403  # own report
    other = client.post("/api/auth/register", json={"name": "Lena Joy", "email": "lena@test.local", "password": "citizen123"}).json()["token"]
    assert client.post(f"/api/reports/{ref}/support", headers=_auth(other)).status_code == 200
    assert client.post(f"/api/reports/{ref}/support", headers=_auth(other)).status_code == 409  # only once
    board = client.get("/api/leaderboard").json()
    ravi = next(b for b in board if b["name"] == "Ravi M.")
    assert ravi["karma"] >= 12 and ravi["reports"] >= 1


def test_analytics_filters_and_fields(client):
    a = client.get("/api/analytics").json()
    assert a["total"] >= 1 and "avg_open_chi" in a and "overdue" in a
    real = client.get("/api/analytics", params={"include_sample": "false"}).json()
    assert real["sample_records"] == 0


def test_unknown_api_path_is_404_json(client):
    assert client.get("/api/does-not-exist").status_code == 404

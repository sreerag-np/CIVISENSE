"""Domain logic: classification, routing, duplicates, priority.

HONESTY NOTE (matches the roadmap): everything here is prototype-level.
 - classify(): keyword fallback on text/filename. NOT image understanding.
 - route_authority(): nearest sample local body centre. NOT official boundaries.
Replace with a trained image model and verified boundary data before a pilot.
"""
import math
import re
from datetime import datetime, timedelta, timezone

CATEGORIES = {
    "road_damage": ("Road damage / potholes", "Public Works (Roads)"),
    "garbage": ("Garbage / waste", "Health & Sanitation"),
    "street_light": ("Street light fault", "Electrical Section"),
    "water_supply": ("Water leak / supply", "Water Authority"),
    "drainage": ("Drainage / flooding", "Public Works (Drainage)"),
    "fallen_tree": ("Fallen tree / obstruction", "Public Works (Roads)"),
    "other": ("Other", "General Administration"),
}
# Internal workflow: submitted -> under_review -> forwarded (admin sent it to a department) -> approved (the
# department accepted the job) -> assigned (admin sent the assigned message to the citizen) -> in_progress -> resolved.
STATUSES = ["submitted", "under_review", "forwarded", "approved", "assigned", "in_progress", "resolved", "rejected"]
# What citizens see: the two internal approval steps appear as "under_review" until the admin sends the assigned message.
PUBLIC_STATUSES = ["submitted", "under_review", "assigned", "in_progress", "resolved", "rejected"]
CLOSED = ("resolved", "rejected")
POST_ASSIGN = ("assigned", "in_progress", "resolved")  # stages where the worker count is shown to the citizen

# Receiving departments (the concerned authority). "Public Works" is the PWD.
DEPARTMENTS = sorted({v[1] for v in CATEGORIES.values()})
RISK_LEVELS = ["high", "medium", "low"]  # most critical first
RISK_ORDER = {"high": 0, "medium": 1, "low": 2}
# Prototype defaults, not official staffing rules. The administrator can override the number when forwarding.
WORKERS_BY_RISK = {"high": 6, "medium": 4, "low": 2}
CRITICAL_EXTRA_WORKERS = 2  # added when the hazard index (CHI) is in the critical tier


def public_status(status: str) -> str:
    return "under_review" if status in ("forwarded", "approved") else status

KEYWORDS = {
    "road_damage": ["pothole", "road", "crack", "tar", "asphalt", "bridge", "footpath", "pavement"],
    "garbage": ["garbage", "waste", "trash", "litter", "dump", "plastic", "smell", "rubbish"],
    "street_light": ["street light", "streetlight", "lamp", "light", "dark", "bulb", "pole"],
    "water_supply": ["water", "pipe", "leak", "tap", "burst", "supply"],
    "drainage": ["drain", "drainage", "sewage", "flood", "overflow", "waterlogging", "canal", "manhole"],
    "fallen_tree": ["tree", "branch", "fallen", "uprooted", "blocked"],
}
HIGH_RISK = ["accident", "danger", "dangerous", "injur", "child", "school", "hospital", "exposed wire",
             "live wire", "electric shock", "open manhole", "flood", "collapsed", "fire", "urgent"]
LOW_RISK = ["minor", "small", "cosmetic"]

# SAMPLE centres only - NOT jurisdiction boundaries. Replace with official GIS data.
SAMPLE_BODIES = [
    ("Payyanur Municipality", 12.0934, 75.2025),
    ("Taliparamba Municipality", 12.0373, 75.3589),
    ("Kannur Corporation", 11.8745, 75.3704),
    ("Thalassery Municipality", 11.7480, 75.4889),
]
ROUTING_RADIUS_KM = 8.0


def classify(description: str, filename: str = "") -> dict:
    clean_name = re.sub(r"[_.\-]", " ", filename or "")
    text = f"{description} {clean_name}".lower()
    scores = {}
    for cat, words in KEYWORDS.items():
        hits = sum(1 for w in words if w in text)
        if hits:
            scores[cat] = hits
    if scores:
        cat = max(scores, key=scores.get)
        conf = min(0.9, 0.45 + 0.15 * scores[cat])
    else:
        cat, conf = "other", 0.2
    if any(w in text for w in HIGH_RISK):
        sev = "high"
    elif any(w in text for w in LOW_RISK):
        sev = "low"
    else:
        sev = "medium"
    return {
        "category": cat,
        "label": CATEGORIES[cat][0],
        "confidence": round(conf, 2),
        "severity": sev,
        "method": "keyword-fallback",
        "note": "Suggestion based on text/filename only, not on image content. Please confirm or correct.",
    }


def haversine_m(lat1, lng1, lat2, lng2) -> float:
    r = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def route_authority(lat: float, lng: float, category: str) -> dict:
    name, dist = min(((n, haversine_m(lat, lng, a, b)) for n, a, b in SAMPLE_BODIES), key=lambda x: x[1])
    dept = CATEGORIES.get(category, CATEGORIES["other"])[1]
    if dist / 1000 <= ROUTING_RADIUS_KM:
        return {"authority": name, "department": dept,
                "note": "Approximate routing by nearest sample centre; not verified against official boundaries."}
    return {"authority": None, "department": dept,
            "note": "Outside sample coverage; needs manual routing by staff."}


# ---- Civic Hazard Index (CHI) -------------------------------------------------------------
# A transparent 1-100 heuristic used to order work. It is an ESTIMATE, not a measured risk.
CATEGORY_BASE = {"road_damage": 50, "garbage": 35, "street_light": 35, "water_supply": 45,
                 "drainage": 55, "fallen_tree": 55, "other": 25}
SEVERITY_BONUS = {"low": -5, "medium": 5, "high": 20}
# Target response times. Defaults for this prototype, NOT official service-level agreements.
SLA_HOURS = {"high": 48, "medium": 120, "low": 240}


def _age_days(created_at: str) -> int:
    try:
        return max(0, (datetime.now(timezone.utc) - datetime.fromisoformat(created_at)).days)
    except ValueError:
        return 0


def chi_score(category: str, severity: str, supports: int, created_at: str) -> int:
    score = (CATEGORY_BASE.get(category, 25) + SEVERITY_BONUS.get(severity, 5)
             + min(max(supports, 0), 20) + min(_age_days(created_at), 30) * 0.5)
    return int(max(1, min(100, round(score))))


def chi_tier(score: int) -> str:
    return "critical" if score >= 75 else "high" if score >= 55 else "moderate" if score >= 35 else "low"


def sla_info(severity: str, created_at: str, status: str) -> dict:
    hours = SLA_HOURS.get(severity, SLA_HOURS["medium"])
    try:
        due = datetime.fromisoformat(created_at) + timedelta(hours=hours)
    except ValueError:
        return {"sla_hours": hours, "sla_due": None, "overdue": False}
    overdue = status not in CLOSED and datetime.now(timezone.utc) > due
    return {"sla_hours": hours, "sla_due": due.isoformat(timespec="seconds"), "overdue": overdue}


def suggest_workers(risk: str, chi: int) -> int:
    """Headcount suggestion: more workers for higher risk, plus extra when the CHI tier is critical (75+)."""
    n = WORKERS_BY_RISK.get(risk, WORKERS_BY_RISK["medium"])
    return n + (CRITICAL_EXTRA_WORKERS if chi >= 75 else 0)


def priority_key(risk: str, chi: int, created_at: str, status: str):
    """Sort key: open before closed, high risk first, then higher CHI, then oldest first."""
    return (status in CLOSED, RISK_ORDER.get(risk, 1), -chi, created_at)


# ---- Karma (leaderboard) ----------------------------------------------------------------
def karma(reports: int, resolved: int, supports_received: int) -> int:
    return 10 * reports + 25 * resolved + 2 * supports_received


def public_name(name: str) -> str:
    """Show first name + last initial only (privacy)."""
    parts = name.split()
    if not parts:
        return "Citizen"
    return parts[0] if len(parts) == 1 else f"{parts[0]} {parts[-1][0]}."


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")

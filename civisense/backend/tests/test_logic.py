from datetime import datetime, timedelta, timezone

from app import logic


def _iso(days_ago=0, hours_ago=0):
    return (datetime.now(timezone.utc) - timedelta(days=days_ago, hours=hours_ago)).isoformat(timespec="seconds")


def test_classify_keywords_and_severity():
    r = logic.classify("Big pothole on the road, dangerous for children", "IMG_pothole.jpg")
    assert r["category"] == "road_damage"
    assert r["severity"] == "high"
    assert r["method"] == "keyword-fallback"


def test_classify_unknown_is_low_confidence_other():
    r = logic.classify("something odd happened here")
    assert r["category"] == "other" and r["confidence"] <= 0.3


def test_routing_inside_and_outside_coverage():
    near = logic.route_authority(12.0934, 75.2025, "road_damage")
    assert near["authority"] == "Payyanur Municipality"
    far = logic.route_authority(10.0, 76.0, "garbage")
    assert far["authority"] is None and "manual" in far["note"].lower()


def test_haversine_about_55m():
    assert 50 < logic.haversine_m(12.0, 75.0, 12.0005, 75.0) < 60


def test_chi_range_ordering_and_tiers():
    new_low = logic.chi_score("other", "low", 0, _iso())
    old_high = logic.chi_score("drainage", "high", 20, _iso(days_ago=40))
    assert 1 <= new_low < old_high <= 100
    assert logic.chi_tier(80) == "critical" and logic.chi_tier(60) == "high"
    assert logic.chi_tier(40) == "moderate" and logic.chi_tier(10) == "low"


def test_supports_and_age_raise_chi():
    base = logic.chi_score("road_damage", "medium", 0, _iso())
    assert logic.chi_score("road_damage", "medium", 10, _iso()) > base
    assert logic.chi_score("road_damage", "medium", 0, _iso(days_ago=10)) > base


def test_sla_overdue_only_when_open_and_past_due():
    assert logic.sla_info("high", _iso(hours_ago=60), "submitted")["overdue"] is True
    assert logic.sla_info("high", _iso(hours_ago=60), "resolved")["overdue"] is False
    assert logic.sla_info("high", _iso(hours_ago=1), "submitted")["overdue"] is False


def test_karma_and_public_name():
    assert logic.karma(2, 1, 5) == 2 * 10 + 25 + 10
    assert logic.public_name("Sreerag N P") == "Sreerag P."
    assert logic.public_name("Asha") == "Asha"
    assert logic.public_name("   ") == "Citizen"


def test_worker_suggestion_by_risk_and_critical_bonus():
    assert logic.suggest_workers("high", 60) == 6
    assert logic.suggest_workers("medium", 40) == 4
    assert logic.suggest_workers("low", 10) == 2
    assert logic.suggest_workers("high", 80) == 8  # critical hazard index adds two


def test_priority_key_orders_risk_then_chi_and_closed_last():
    rows = [("low", 90, "2026-01-01", "submitted"), ("high", 40, "2026-01-02", "submitted"),
            ("high", 70, "2026-01-03", "submitted"), ("high", 99, "2026-01-01", "resolved")]
    ordered = sorted(rows, key=lambda r: logic.priority_key(*r))
    assert ordered == [rows[2], rows[1], rows[0], rows[3]]


def test_public_status_hides_internal_steps():
    assert logic.public_status("forwarded") == "under_review"
    assert logic.public_status("approved") == "under_review"
    assert logic.public_status("assigned") == "assigned"

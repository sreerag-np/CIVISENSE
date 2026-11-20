from app.security import RateLimiter, match_rule


def test_limiter_blocks_after_limit_and_recovers():
    rl = RateLimiter()
    for i in range(3):
        assert rl.allow("k", 3, 60, now=100.0 + i)[0]
    ok, retry = rl.allow("k", 3, 60, now=103.0)
    assert not ok and retry >= 1
    assert rl.allow("k", 3, 60, now=161.0)[0]  # first hit has left the window


def test_limiter_keys_are_independent():
    rl = RateLimiter()
    assert rl.allow("a", 1, 60, now=1.0)[0]
    assert rl.allow("b", 1, 60, now=1.0)[0]
    assert not rl.allow("a", 1, 60, now=2.0)[0]


def test_rules_pick_the_strictest_matching_bucket():
    assert match_rule("POST", "/api/auth/login")[0] == "auth"
    assert match_rule("POST", "/api/reports")[0] == "create"
    assert match_rule("POST", "/api/reports/CS-1/support")[0] == "support"
    assert match_rule("GET", "/api/reports")[0] == "general"
    assert match_rule("GET", "/assets/app.js") is None

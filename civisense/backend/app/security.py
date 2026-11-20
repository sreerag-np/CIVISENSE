"""Rate limiting, request logging, request-size limit, security headers and a safe 500 handler.

The rate limiter is in-memory and per process: fine for one server (demo / small pilot).
For several workers or servers, use a shared store (Redis) or a gateway limiter instead.
"""
import logging
import secrets
import threading
import time
from collections import defaultdict, deque

from . import config

log = logging.getLogger("civisense")
if not log.handlers:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")


class RateLimiter:
    """Sliding-window limiter. allow(key, limit, window_s) -> (allowed, retry_after_s)."""

    def __init__(self):
        self._hits = defaultdict(deque)
        self._lock = threading.Lock()
        self._last_sweep = time.monotonic()

    def allow(self, key: str, limit: int, window_s: int, now=None):
        now = time.monotonic() if now is None else now
        with self._lock:
            q = self._hits[key]
            while q and q[0] <= now - window_s:
                q.popleft()
            if len(q) >= limit:
                return False, max(1, int(q[0] + window_s - now) + 1)
            q.append(now)
            if now - self._last_sweep > 300:  # drop idle keys so memory cannot grow without bound
                self._last_sweep = now
                for k in [k for k, v in self._hits.items() if not v or v[-1] <= now - 3600]:
                    del self._hits[k]
            return True, 0


limiter = RateLimiter()

# (method or "*", path prefix, bucket name, limit, window seconds). First match wins.
RULES = [
    ("POST", "/api/auth/", "auth", 10, 60),          # slows password guessing
    ("POST", "/api/reports/", "support", 60, 60),     # support / status updates
    ("POST", "/api/reports", "create", 20, 600),
    ("POST", "/api/classify", "classify", 30, 60),
    ("*", "/api/", "general", 240, 60),
]


def client_ip(request) -> str:
    if config.TRUST_PROXY:
        fwd = request.headers.get("x-forwarded-for")
        if fwd:
            return fwd.split(",")[-1].strip()  # the entry appended by our trusted proxy
    return request.client.host if request.client else "unknown"


def match_rule(method: str, path: str):
    for m, prefix, bucket, limit, window in RULES:
        if (m == "*" or m == method) and path.startswith(prefix):
            return bucket, limit, window
    return None


def _headers(path: str) -> dict:
    h = {
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "Referrer-Policy": "no-referrer",
        "Permissions-Policy": "geolocation=(self), camera=(self)",
    }
    if config.CSP_ENABLED and not path.startswith(("/docs", "/redoc", "/openapi.json")):
        h["Content-Security-Policy"] = (
            "default-src 'self'; img-src 'self' data: blob: https://tile.openstreetmap.org "
            "https://*.tile.openstreetmap.org; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
            "font-src 'self' https://fonts.gstatic.com; script-src 'self'; "
            "connect-src 'self'; frame-ancestors 'none'")
    return h


def install(app):
    from fastapi.responses import JSONResponse  # imported here so the limiter can be unit-tested without FastAPI

    @app.middleware("http")
    async def guard(request, call_next):
        rid = secrets.token_hex(6)
        request.state.request_id = rid
        path, method, ip = request.url.path, request.method, client_ip(request)
        start = time.perf_counter()

        resp = None
        length = request.headers.get("content-length")
        if length and length.isdigit() and int(length) > config.MAX_BODY_BYTES:
            resp = JSONResponse({"detail": "Request body too large."}, status_code=413)
        elif config.RATE_LIMIT_ENABLED and (rule := match_rule(method, path)):
            bucket, limit, window = rule
            ok, retry = limiter.allow(f"{ip}:{bucket}", limit, window)
            if not ok:
                resp = JSONResponse({"detail": "Too many requests. Please slow down and try again shortly."},
                                    status_code=429, headers={"Retry-After": str(retry)})
                log.warning("rate-limited ip=%s bucket=%s path=%s", ip, bucket, path)

        if resp is None:
            try:
                resp = await call_next(request)
            except Exception:  # never leak a traceback to the client
                log.exception("unhandled error rid=%s %s %s", rid, method, path)
                resp = JSONResponse({"detail": "Internal server error.", "request_id": rid}, status_code=500)

        for k, v in _headers(path).items():
            resp.headers[k] = v
        resp.headers["X-Request-ID"] = rid
        if path.startswith("/api/"):
            log.info("rid=%s ip=%s %s %s -> %s %.0fms", rid, ip, method, path, resp.status_code,
                     (time.perf_counter() - start) * 1000)
        return resp

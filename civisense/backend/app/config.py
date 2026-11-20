"""Central configuration. Values come from environment variables or a backend/.env file (never commit .env)."""
import os
import secrets
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent


def _load_dotenv():
    f = BASE_DIR / ".env"
    if not f.exists():
        return
    for line in f.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


_load_dotenv()


def env(name: str, default=None):
    v = os.getenv(name)
    return v if v not in (None, "") else default


def env_int(name: str, default: int) -> int:
    try:
        return int(env(name, default))
    except (TypeError, ValueError):
        return default


def env_bool(name: str, default: bool) -> bool:
    v = env(name)
    return default if v is None else v.strip().lower() in ("1", "true", "yes", "on")


ENVIRONMENT = env("CIVISENSE_ENV", "development")  # set to "production" when deployed
IS_PROD = ENVIRONMENT == "production"

_secret = env("CIVISENSE_SECRET")
if not _secret:
    if IS_PROD:
        # A random per-process secret would log everyone out on every restart and break multiple workers.
        raise RuntimeError("CIVISENSE_SECRET must be set when CIVISENSE_ENV=production")
    _secret = secrets.token_urlsafe(48)
SECRET = _secret

DATA_DIR = Path(env("CIVISENSE_DATA_DIR", str(BASE_DIR / "data")))
UPLOAD_DIR = DATA_DIR / "uploads"
DB_PATH = DATA_DIR / "civisense.db"
FRONTEND_DIST = Path(env("FRONTEND_DIST", str(BASE_DIR.parent / "frontend" / "dist")))

ORIGINS = [o.strip() for o in env("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",") if o.strip()]
MAX_IMAGE_BYTES = env_int("MAX_IMAGE_MB", 5) * 1024 * 1024
MAX_BODY_BYTES = MAX_IMAGE_BYTES + 1024 * 1024
DUPLICATE_RADIUS_M = env_int("DUPLICATE_RADIUS_M", 75)

# Rate limiting (per client IP, in-memory, single process). See security.py.
RATE_LIMIT_ENABLED = env_bool("RATE_LIMIT_ENABLED", True)
TRUST_PROXY = env_bool("TRUST_PROXY", False)  # true only behind a proxy you control (Render, nginx...)
CSP_ENABLED = env_bool("CSP_ENABLED", True)

# Optional Gemini analysis. Without a key the keyword fallback is used.
GEMINI_API_KEY = env("GEMINI_API_KEY")
GEMINI_MODEL = env("GEMINI_MODEL", "gemini-2.0-flash")  # verify the current model name in Google's docs
GEMINI_TIMEOUT_S = env_int("GEMINI_TIMEOUT_S", 8)

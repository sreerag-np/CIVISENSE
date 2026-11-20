import os
import sys
import tempfile
from pathlib import Path

# Isolated data directory and settings BEFORE the app is imported.
_tmp = tempfile.mkdtemp(prefix="civisense-test-")
os.environ["CIVISENSE_DATA_DIR"] = _tmp
os.environ["CIVISENSE_SECRET"] = "test-secret-not-for-production"
os.environ["CIVISENSE_ADMIN_EMAIL"] = "admin@test.local"
os.environ["CIVISENSE_ADMIN_PASSWORD"] = "AdminPass123!"
os.environ["RATE_LIMIT_ENABLED"] = "0"
os.environ["FRONTEND_DIST"] = str(Path(_tmp) / "no-dist")
os.environ.pop("GEMINI_API_KEY", None)
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

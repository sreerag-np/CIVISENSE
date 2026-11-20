"""SQLite storage with WAL mode (safe concurrent readers + a writer) and a tiny migration step.
For multiple servers or heavy load, move to PostgreSQL (+PostGIS): keep the SQL in this layer simple."""
import sqlite3
from contextlib import contextmanager

from . import config

DATA_DIR = config.DATA_DIR
UPLOAD_DIR = config.UPLOAD_DIR
DB_PATH = config.DB_PATH

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'citizen',      -- citizen | authority | admin
  department TEXT,                           -- authority users: the department they approve jobs for
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ref TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  address TEXT,
  image_path TEXT,
  severity TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'submitted',
  authority TEXT,
  department TEXT,
  assigned_to TEXT,
  workers INTEGER,
  routing_note TEXT,
  ai_category TEXT,
  ai_confidence REAL,
  ai_method TEXT,
  supports INTEGER NOT NULL DEFAULT 0,
  duplicate_of INTEGER REFERENCES reports(id),
  user_id INTEGER REFERENCES users(id),
  is_sample INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_geo ON reports(lat, lng);
CREATE INDEX IF NOT EXISTS idx_reports_user ON reports(user_id);
CREATE TABLE IF NOT EXISTS status_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id INTEGER NOT NULL REFERENCES reports(id),
  status TEXT NOT NULL,
  note TEXT,
  actor_role TEXT NOT NULL,
  actor_name TEXT,
  internal INTEGER NOT NULL DEFAULT 0,       -- 1 = staff-only note, hidden from citizens
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS supporters (
  report_id INTEGER NOT NULL REFERENCES reports(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  PRIMARY KEY (report_id, user_id)
);
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id INTEGER,
  actor_role TEXT,
  action TEXT NOT NULL,
  target TEXT,
  detail TEXT,
  ip TEXT,
  created_at TEXT NOT NULL
);
"""

# Columns added after the first release: (table, column, type). Applied to existing databases.
MIGRATIONS = [
    ("reports", "assigned_to", "TEXT"),
    ("reports", "ai_method", "TEXT"),
    ("reports", "workers", "INTEGER"),
    ("users", "department", "TEXT"),
    ("status_events", "internal", "INTEGER NOT NULL DEFAULT 0"),
]


def _migrate(c):
    for table, col, typ in MIGRATIONS:
        cols = {r["name"] for r in c.execute(f"PRAGMA table_info({table})")}
        if col not in cols:
            c.execute(f"ALTER TABLE {table} ADD COLUMN {col} {typ}")


def init_db():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    with db() as c:
        c.executescript(SCHEMA)
        _migrate(c)


@contextmanager
def db():
    c = sqlite3.connect(DB_PATH, timeout=10)
    c.row_factory = sqlite3.Row
    c.execute("PRAGMA foreign_keys=ON")
    c.execute("PRAGMA journal_mode=WAL")
    c.execute("PRAGMA busy_timeout=10000")
    try:
        yield c
        c.commit()
    except Exception:
        c.rollback()
        raise
    finally:
        c.close()

# CIVISENSE website (v0.5)

React + Vite frontend, FastAPI + SQLite backend. Open this folder in VS Code and use two terminals.

## Interface (v0.4)

New look built around road signage: asphalt and chalk neutrals, road-paint yellow accent, Barlow / Barlow Condensed type,
hazard-tape ticket for the latest report, and report progress drawn as a road line (dashed ahead, solid once done).

- **Theme menu** (palette icon, top right): Light, Dark or System, plus four accent colours (road yellow, monsoon green,
  coast blue, laterite red). Saved in the browser; applied before the page paints so it never flashes.
- Mobile menu, skip link, visible keyboard focus, loading skeletons, empty states, inline form errors, drag-and-drop photo upload,
  category chips, copy-reference button, map and list that follow each other on the Map page.
- Fonts load from Google Fonts. If you tighten the CSP, keep `fonts.googleapis.com` and `fonts.gstatic.com` allowed
  (see `app/security.py`); without them the site falls back to system fonts and still works.

## Run locally

**Terminal 1 - backend** (from the `backend` folder, with the venv active):
```powershell
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
$env:CIVISENSE_ADMIN_PASSWORD="Admin12345!"     # your own admin password
$env:CIVISENSE_SECRET="a-long-random-text-you-choose-123456789"
$env:SEED_DEMO="1"                              # optional labelled sample data
uvicorn app.main:app --reload --port 8000
```
Your existing database keeps working: new columns and tables are added automatically on start.

**Terminal 2 - frontend** (from the `frontend` folder):
```powershell
npm install
npm run dev
```
Open http://localhost:5173. Log in as `admin@civisense.local`, open **Admin** to create staff accounts and read the audit log.

## Approval workflow (v0.5)

1. **Citizen** reports an issue. Status: *Submitted*.
2. **Administrator** triages it: confirms the **risk level** (high / medium / low), picks the **concerned department**
   (for road repairs: Public Works (Roads)), sets the **number of workers** and adds an internal note, then forwards it.
3. **That department's authority** (an authority account whose department matches) approves or declines.
   Declined jobs return to the administrator. Other departments and the administrator cannot approve on their behalf.
4. **Only the administrator** can then send the *assigned* message to the citizen. It appears on the Track page.
5. The department starts the work and marks it resolved. Only an administrator can reject or reopen a report.

Citizens see simple statuses only: while a job is with a department or approved, they see *Under review*. Internal notes
and the worker count stay hidden until the assigned message is sent.

**Risk and priority.** Lists sort open jobs by risk (high first), then hazard index (CHI), then oldest first.
**Worker defaults** when the administrator leaves the number empty: high 6, medium 4, low 2, plus 2 when CHI is critical (75+).
These are prototype defaults, not an official staffing norm.

**Staff accounts need a department.** In **Admin**, create each staff account with a department, or set one for an existing
authority account. An authority account with no department cannot approve jobs.
Messages are shown on the Track page only: there is no email or SMS delivery yet.

## What changed in v0.3 (from the architecture review)

| Review finding | What was done |
|---|---|
| JSON database, race conditions | SQLite in WAL mode with a busy timeout; automatic migrations. PostgreSQL is the next step for real load. |
| CORS wildcard | Explicit origins from `CORS_ORIGINS`; only the methods and headers the site uses. |
| No authentication | JWT login, roles read from the database; only staff change status; supporting a report needs login, once per user, never your own. |
| Image upload validation | 5 MB limit, file type checked from the file's bytes, random file names, request-size limit. |
| Unhandled async errors | Safe 500 handler (no traceback leaks, request id returned); AI call has a timeout and always falls back. |
| No rate limiting | Per-IP limits: 10 auth attempts/min, 20 new reports/10 min, 240 API calls/min (see `app/security.py`). |
| No logging / audit trail | Request log with ids; `audit_log` table for logins, failures, registrations, staff creation, status changes; admin page. |
| Hardcoded seed data / API URL | Sample data lives in the backend, labelled "Sample data"; URL via Vite proxy or `VITE_API_URL`. |
| Manual routing | React Router. |
| No error boundary | Added, so one broken page does not blank the site. |
| Env management | `backend/.env.example`; production refuses to start without `CIVISENSE_SECRET`. |
| No tests / CI / Docker | `backend/tests`, GitHub Actions workflow, multi-stage `Dockerfile`. |

Features carried over from the original project: **CHI** hazard index (1-100), **SLA** targets with overdue flags,
team assignment, **leaderboard** (karma), optional **Gemini** analysis, dark/light theme, analytics sample-data toggle.

Not done on purpose: *cost estimates in rupees* (no real data to base them on) and *response caching* (it would show
stale status after a staff update). TypeScript, Celery/background jobs and OpenTelemetry are not worth it at this size.

## Honest limits (say these in demos)

- **CHI** and **SLA targets** are prototype heuristics, not official measures. Targets: high 48 h, medium 120 h, low 240 h.
- Category suggestion is keywords unless `GEMINI_API_KEY` is set. The Gemini code has not been tested against the live service yet.
- Authority routing uses four sample town centres, not official boundaries.
- Rate limiting is in memory (one server process). Use a shared store for several servers.
- Sample records are flagged `is_sample` and excluded from karma.

## Tests

```powershell
pip install -r requirements-dev.txt
python -m pytest tests -q
```

## Deploy on one domain (website + API + mobile app share it)

```powershell
docker build -t civisense .
docker run -p 8000:8000 -v civisense-data:/data -e CIVISENSE_SECRET=... -e CIVISENSE_ADMIN_PASSWORD=... civisense
```
Open http://localhost:8000. On a host such as Render, also set `TRUST_PROXY=1` and attach a persistent disk at `/data`;
free tiers without a disk lose the database and photos on every restart. Point the mobile app's `config.js` at the same URL.

@echo off
title CIVISENSE Backend (FastAPI)
echo Starting CIVISENSE Backend on port 8000...
cd /d "C:\Users\SREERAG\CIVISENSE\backend"
"C:\Users\SREERAG\CIVISENSE\.venv\Scripts\python.exe" -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
pause

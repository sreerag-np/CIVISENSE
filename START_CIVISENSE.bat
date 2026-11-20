@echo off
title CIVISENSE 2.0 - Civic Science AI Platform
color 0B

echo ======================================================================
echo                CIVISENSE 2.0 - Civic Science AI Platform
echo ======================================================================
echo.
echo [1/3] Starting FastAPI Backend on port 8000...
start "CIVISENSE Backend" cmd /c ""%~dp0.venv\Scripts\python.exe" -m uvicorn main:app --reload --host 0.0.0.0 --port 8000 --app-dir "%~dp0backend""

timeout /t 2 /nobreak >nul

echo [2/3] Starting React Vite Frontend on port 5173...
start "CIVISENSE Frontend" cmd /c "cd /d "%~dp0frontend" && npm run dev"

timeout /t 2 /nobreak >nul

echo [3/3] Opening CIVISENSE in your default browser...
start http://localhost:5173

echo.
echo ======================================================================
echo  CIVISENSE is LIVE and RUNNING!
echo.
echo  * Web Application: http://localhost:5173
echo  * Backend API Docs: http://127.0.0.1:8000/docs
echo.
echo  Keep this window or the background windows open while using the app.
echo  Press any key to close this launcher.
echo ======================================================================
pause

@echo off
echo ===================================================
echo     AutoCaption Studio - Short-Form AI Editor
echo ===================================================
echo.

echo Starting Python FastAPI Backend (Port 8000)...
start "AutoCaption Backend" cmd /k "cd /d %~dp0backend && python app.py"

timeout /t 2 /nobreak >nul

echo Starting Vite Frontend Dev Server (Port 5173)...
start "AutoCaption Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo AutoCaption Studio launched!
echo Frontend: http://localhost:5173
echo Backend:  http://127.0.0.1:8000
echo.
pause

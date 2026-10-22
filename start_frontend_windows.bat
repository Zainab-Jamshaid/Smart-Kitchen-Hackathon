@echo off
setlocal
cd /d "%~dp0"
echo =============================================
echo Smart Kitchen - Frontend Setup
echo =============================================
where npm >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js/npm is not installed or not on PATH.
  echo Install Node.js LTS from https://nodejs.org/ then reopen VS Code.
  pause
  exit /b 1
)
if not exist node_modules (
  echo Installing frontend packages...
  call npm install
  if errorlevel 1 goto failed
)
echo Starting frontend...
call npm run dev
if errorlevel 1 goto failed
exit /b 0
:failed
echo.
echo ERROR: Frontend setup failed. Please send a screenshot of this terminal.
pause
exit /b 1

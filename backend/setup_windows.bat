@echo off
setlocal
cd /d "%~dp0"
echo =============================================
echo Smart Kitchen - Windows Backend Setup
echo =============================================

if not exist .venv (
  echo Looking for a compatible Python installation...
  py -3.14 -m venv .venv 2>nul
  if errorlevel 1 py -3.13 -m venv .venv 2>nul
  if errorlevel 1 py -3.12 -m venv .venv 2>nul
  if errorlevel 1 (
    echo ERROR: Python 3.12, 3.13, or 3.14 was not found.
    echo Install Python 3.12 or newer from https://www.python.org/downloads/windows/
    echo Then re-run this file.
    pause
    exit /b 1
  )
)

call .venv\Scripts\activate.bat
if errorlevel 1 (
  echo ERROR: Could not activate .venv. Delete backend\.venv and run this file again.
  pause
  exit /b 1
)

python -m pip install --upgrade pip setuptools wheel
if errorlevel 1 goto install_failed

echo Installing binary wheels for packages where available...
python -m pip install --only-binary=pydantic-core -r requirements.txt
if errorlevel 1 goto install_failed

if not exist .env copy .env.example .env >nul
echo.
echo Backend dependencies installed successfully.
echo If you want real AI recipes, edit backend\.env and add your Gemini API key.
echo Starting API at http://127.0.0.1:8000
python -m uvicorn main:app --reload --port 8000
if errorlevel 1 goto run_failed
exit /b 0

:install_failed
echo.
echo ERROR: Dependency installation failed. Please send a screenshot of this terminal.
pause
exit /b 1

:run_failed
echo.
echo ERROR: The API server did not start. Please send a screenshot of this terminal.
pause
exit /b 1

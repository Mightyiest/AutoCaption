@echo off
setlocal enabledelayedexpansion

title AutoCaption Studio - Setup & Requirements Installer

echo ===================================================
echo     AutoCaption Studio - Setup & Requirements
echo ===================================================
echo.
echo [1/5] Checking System Prerequisites...

:: 1. Check Python
where python >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Python is not found in your PATH!
    echo Please install Python 3.10+ from https://www.python.org/
    echo Make sure to check "Add Python to PATH" during installation.
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('python --version 2^>^&1') do set PYTHON_VERSION=%%v
echo  - Python found: !PYTHON_VERSION!

:: 2. Check Node & NPM
where npm >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js / NPM is not found in your PATH!
    echo Please install Node.js 18+ from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('node -v 2^>^&1') do set NODE_VERSION=%%v
for /f "tokens=*" %%v in ('npm -v 2^>^&1') do set NPM_VERSION=%%v
echo  - Node.js found: !NODE_VERSION! (npm v!NPM_VERSION!)
echo.

:: Ensure storage directories exist
if not exist "%~dp0backend\storage\uploads" mkdir "%~dp0backend\storage\uploads"
if not exist "%~dp0backend\storage\exports" mkdir "%~dp0backend\storage\exports"
if not exist "%~dp0backend\storage\fonts" mkdir "%~dp0backend\storage\fonts"
if not exist "%~dp0backend\storage\debug" mkdir "%~dp0backend\storage\debug"

:: 3. Install Python Dependencies
echo ===================================================
echo [2/5] Installing Python Dependencies (Backend)...
echo ===================================================
pip install -r "%~dp0backend\requirements.txt"
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Failed to install Python dependencies.
    echo Please check your internet connection and Python installation.
    echo.
    pause
    exit /b 1
)

echo.
echo Installing NVIDIA CUDA 12 acceleration libraries (Optional/GPU)...
pip install nvidia-cublas-cu12 nvidia-cudnn-cu12 >nul 2>&1
echo [OK] Python dependencies and GPU libraries installed successfully!
echo.

:: 4. Install Node / NPM Dependencies
echo ===================================================
echo [3/5] Installing NPM Dependencies (Frontend)...
echo ===================================================
cd /d "%~dp0frontend"
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Failed to install NPM packages.
    echo Please verify your Node.js and network setup.
    echo.
    pause
    exit /b 1
)
cd /d "%~dp0"
echo.
echo [OK] Frontend packages installed successfully!
echo.

:: 5. Download Custom Fonts for Subtitles & UI
echo ===================================================
echo [4/5] Downloading Fonts for Video Subtitle Burn-in...
echo ===================================================
python "%~dp0backend\download_fonts.py"
if %ERRORLEVEL% NEQ 0 (
    echo [WARNING] Font download had issues, but you can retry later.
) else (
    echo [OK] Fonts downloaded and ready!
)
echo.

:: 6. Pre-cache Whisper AI Models
echo ===================================================
echo [5/5] Pre-downloading Whisper AI Models...
echo ===================================================
python "%~dp0backend\download_models.py"
if %ERRORLEVEL% NEQ 0 (
    echo [WARNING] Whisper model download encountered an issue. Models will download automatically on first transcription.
) else (
    echo [OK] Whisper AI models ready!
)

echo.
echo ===================================================
echo       All Requirements Installed Successfully!      
echo ===================================================
echo.
echo You can now launch AutoCaption Studio anytime by running:
echo   run_dev.bat
echo.
pause

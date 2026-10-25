@echo off
setlocal
title AutoCaption Studio
cd /d "%~dp0"

:: Auto-detect and prepend standard Node & Python paths if present
if exist "%LOCALAPPDATA%\Programs\nodejs" set "PATH=%LOCALAPPDATA%\Programs\nodejs;%PATH%"
if exist "%ProgramFiles%\nodejs" set "PATH=%ProgramFiles%\nodejs;%PATH%"
if exist "%ProgramFiles(x86)%\nodejs" set "PATH=%ProgramFiles(x86)%\nodejs;%PATH%"
if exist "%APPDATA%\npm" set "PATH=%APPDATA%\npm;%PATH%"
if exist "C:\Python314" set "PATH=C:\Python314;C:\Python314\Scripts;%PATH%"

where python >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Python is not found in your PATH!
    echo Please make sure Python 3.10+ is installed and added to PATH.
    pause
    exit /b 1
)

python run_dev.py
if %ERRORLEVEL% NEQ 0 (
    pause
)


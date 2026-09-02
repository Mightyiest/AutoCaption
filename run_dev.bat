@echo off
setlocal
title AutoCaption Studio
cd /d "%~dp0"

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

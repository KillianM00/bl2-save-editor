@echo off
title BL2 Save Editor
echo Starting BL2 Save Editor...
echo.

:: Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python is not installed or not in PATH.
    echo Download Python from https://python.org
    pause
    exit /b 1
)

:: Start server and open browser
cd /d "%~dp0"
start "" http://localhost:5000
python -B app.py

:: If server exits, pause so user can see any errors
echo.
echo Server stopped.
pause

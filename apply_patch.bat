@echo off
:: Applies the exe patch via patch_bl2.py (uses config.json for paths)
:: Self-elevate to admin since the game directory is in Program Files
net session >nul 2>&1
if %errorLevel% neq 0 (
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

echo Patching Borderlands2.exe - raising grade cap from 80 to 127...
cd /d "%~dp0"
python patch_bl2.py
if %errorLevel% equ 0 (
    echo SUCCESS: Patch applied.
) else (
    echo FAILED. Check config.json for correct game_dir path.
)
pause

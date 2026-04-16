# Applies the exe patch via patch_bl2.py (uses config.json for paths)
# Run this from the project root directory.

Set-Location $PSScriptRoot
Write-Host "Patching Borderlands2.exe via patch_bl2.py..."
python patch_bl2.py

if ($LASTEXITCODE -eq 0) {
    Write-Host "SUCCESS: Patch applied." -ForegroundColor Green
} else {
    Write-Host "FAILED. Check config.json for correct game_dir path." -ForegroundColor Red
}
Read-Host "Press Enter to close"

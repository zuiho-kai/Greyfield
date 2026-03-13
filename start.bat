@echo off
chcp 65001 >nul
title GreyWind
echo [GreyWind] Starting backend...
start "GreyWind-Backend" cmd /c "chcp 65001 >nul && cd /d %~dp0 && uv run python -m greywind.run"
echo [GreyWind] Waiting for backend...
timeout /t 3 /nobreak >nul
echo [GreyWind] Starting desktop...
cd /d "%~dp0frontend\desktop"
npx electron . --dev

@echo off
setlocal enabledelayedexpansion

echo [GreyWind] Building desktop app...

pushd "%~dp0frontend\desktop" || (echo [ERR] Cannot enter frontend\desktop & exit /b 1)

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERR] npm not found. Please install Node.js 18+.
  popd
  exit /b 1
)

echo [1/2] npm install
call npm install
if errorlevel 1 (
  echo [ERR] npm install failed.
  popd
  exit /b 1
)

echo [2/2] npm run build (signing disabled)
set ELECTRON_BUILDER_DISABLE_SIGN=true
call npm run build
if errorlevel 1 (
  echo [ERR] npm run build failed.
  popd
  exit /b 1
)

popd
echo [OK] Build finished. If you changed frontend files, re-run this before using the exe.

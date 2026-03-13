@echo off
setlocal enabledelayedexpansion

echo [GreyWind] Fast dev build (stub shell, no signing, dir output)...

pushd "%~dp0frontend\desktop" || (echo [ERR] Cannot enter frontend\desktop & exit /b 1)

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERR] npm not found. Please install Node.js 18+.
  popd
  exit /b 1
)

if not exist node_modules (
  echo [INFO] node_modules not found, running npm install...
  call npm install
  if errorlevel 1 (
    echo [ERR] npm install failed.
    popd
    exit /b 1
  )
)

set ELECTRON_BUILDER_DISABLE_SIGN=true
set ELECTRON_BUILDER_CONFIG=electron-builder.stub.json

echo [1/1] npm run build:dir (stub)
call npm run build:dir
if errorlevel 1 (
  echo [ERR] build:dir failed.
  popd
  exit /b 1
)

popd
echo [OK] Dev build finished. Output: dist\win-unpacked

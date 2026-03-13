@echo off
setlocal enabledelayedexpansion

echo [灰风] 出包 — portable 单文件 exe

where uv >nul 2>nul
if errorlevel 1 (
    echo [ERR] uv 未找到，请先安装 uv
    pause
    exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
    echo [ERR] npm 未找到，请先安装 Node.js 18+
    pause
    exit /b 1
)

echo [1/3] uv sync ...
pushd "%~dp0"
call uv sync --no-dev
if errorlevel 1 (
    echo [ERR] uv sync 失败
    popd
    pause
    exit /b 1
)

echo [2/3] npm install ...
pushd "%~dp0frontend\desktop"
if not exist node_modules (
    call npm install
    if errorlevel 1 (
        echo [ERR] npm install 失败
        popd & popd
        pause
        exit /b 1
    )
)

echo [3/3] electron-builder portable ...
set ELECTRON_BUILDER_DISABLE_SIGN=true
call npm run build:portable
if errorlevel 1 (
    echo [ERR] 打包失败
    popd & popd
    pause
    exit /b 1
)

popd & popd
echo.
echo [OK] 出包完成: %~dp0灰风.exe
pause

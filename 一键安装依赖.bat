@echo off
chcp 65001 >nul
echo ===== GreyWind Install Dependencies =====
echo.

echo [1/2] Python (uv sync)...
call uv sync
if errorlevel 1 (
    echo Python install failed
    pause
    exit /b 1
)
echo Python done
echo.

echo [2/2] Frontend (npm install)...
cd frontend\desktop
call npm install
if errorlevel 1 (
    echo Frontend install failed
    pause
    exit /b 1
)
cd ..\..
echo Frontend done
echo.

echo ===== All dependencies installed =====
pause

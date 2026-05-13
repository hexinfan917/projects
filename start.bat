@echo off
chcp 65001 >nul
echo ========================================
echo    尾巴旅行 - 一键启动所有服务
echo ========================================
echo.

REM 设置工作目录
cd /d D:\projects\backend

REM 检查Python虚拟环境
if not exist "venv\Scripts\python.exe" (
    echo [错误] 未找到Python虚拟环境
    pause
    exit /b 1
)

set PYTHON=venv\Scripts\python.exe
echo [1/5] 正在启动 User Service (端口8031)...
start "User Service" cmd /k "cd user-service && ..\%PYTHON% -m uvicorn main:app --port 8031 --reload"
timeout /t 2 /nobreak >nul

echo [2/5] 正在启动 Order Service (端口8032)...
start "Order Service" cmd /k "cd order-service && ..\%PYTHON% -m uvicorn main:app --port 8032 --reload"
timeout /t 2 /nobreak >nul

echo [3/5] 正在启动 Route Service (端口8033)...
start "Route Service" cmd /k "cd route-service && ..\%PYTHON% -m uvicorn main:app --port 8033 --reload"
timeout /t 2 /nobreak >nul

echo [4/5] 正在启动 Content Service (端口8005)...
start "Content Service" cmd /k "cd content-service && ..\%PYTHON% -m uvicorn main:app --port 8005 --reload"
timeout /t 2 /nobreak >nul

echo [5/5] 正在启动 Gateway (端口8084)...
start "Gateway" cmd /k "%PYTHON% -m uvicorn gateway.main:app --port 8084 --reload"
timeout /t 3 /nobreak >nul

echo.
echo ========================================
echo    所有服务已启动！
echo ========================================
echo.
echo 服务地址：
echo   Gateway: http://localhost:8084
echo   User:    http://localhost:8031
echo   Order:   http://localhost:8032
echo   Route:   http://localhost:8033
echo.
echo 按任意键关闭所有服务窗口...
pause >nul

REM 关闭所有服务窗口
taskkill /FI "WINDOWTITLE eq User Service" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq Order Service" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq Route Service" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq Content Service" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq Gateway" /F >nul 2>&1

echo 服务已停止。
pause

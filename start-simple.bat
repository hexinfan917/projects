@echo off
chcp 65001 >nul
title 犬兜行后端服务启动

echo ========================================
echo   犬兜行后端服务启动脚本
echo ========================================
echo.

set BACKEND_DIR=%~dp0backend
set VENV_PYTHON=%BACKEND_DIR%\venv\Scripts\python.exe

REM 检查虚拟环境
if not exist "%VENV_PYTHON%" (
    echo [错误] 虚拟环境不存在
    echo 请先运行 init-project.ps1
    pause
    exit /b 1
)

echo 正在启动服务...
echo.

REM 启动API网关
start "API网关:8000" cmd /k "cd /d %BACKEND_DIR%\gateway && set PYTHONPATH=%BACKEND_DIR% && %VENV_PYTHON% main.py"
timeout /t 2 /nobreak >nul

REM 启动用户服务
start "用户服务:8001" cmd /k "cd /d %BACKEND_DIR%\user-service && set PYTHONPATH=%BACKEND_DIR% && %VENV_PYTHON% main.py"

REM 启动路线服务
start "路线服务:8033" cmd /k "cd /d %BACKEND_DIR%\route-service && set PYTHONPATH=%BACKEND_DIR% && %VENV_PYTHON% main.py"

REM 启动订单服务
start "订单服务:8003" cmd /k "cd /d %BACKEND_DIR%\order-service && set PYTHONPATH=%BACKEND_DIR% && %VENV_PYTHON% main.py"

REM 启动支付服务
start "支付服务:8006" cmd /k "cd /d %BACKEND_DIR%\pay-service && set PYTHONPATH=%BACKEND_DIR% && %VENV_PYTHON% main.py"

echo.
echo ========================================
echo   所有服务启动完成！
echo ========================================
echo.
echo API文档地址:
echo   http://localhost:8000/docs (API网关)
echo   http://localhost:8001/docs (用户服务)
echo   http://localhost:8002/docs (路线服务)
echo   http://localhost:8003/docs (订单服务)
echo.
pause

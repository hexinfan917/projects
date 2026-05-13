@echo off
chcp 65001 >nul
title 尾巴旅行后端服务

set "PROJECT_ROOT=%~dp0"
set "BACKEND_DIR=%PROJECT_ROOT%backend"
set "VENV_PYTHON=%BACKEND_DIR%\venv\Scripts\python.exe"

echo ========================================
echo   尾巴旅行后端服务启动
echo ========================================
echo.

REM 检查虚拟环境
if not exist "%VENV_PYTHON%" (
    echo [错误] 虚拟环境不存在！
    echo 请先运行: init-project.ps1
    pause
    exit /b 1
)

echo 检查依赖...
"%VENV_PYTHON%" -c "import jwt" 2>nul
if errorlevel 1 (
    echo 安装依赖中...
    "%BACKEND_DIR%\venv\Scripts\pip.exe" install -r "%BACKEND_DIR%\common\requirements.txt"
)

echo.
echo 启动服务中...
echo.

REM API网关
start "网关:8000" cmd /k "echo [API网关] 启动中... && cd /d "%BACKEND_DIR%\gateway" && set PYTHONPATH=%BACKEND_DIR% && "%VENV_PYTHON%" main.py"
timeout /t 2 >nul

REM 用户服务  
start "用户:8001" cmd /k "echo [用户服务] 启动中... && cd /d "%BACKEND_DIR%\user-service" && set PYTHONPATH=%BACKEND_DIR% && "%VENV_PYTHON%" main.py"

REM 路线服务
start "路线:8033" cmd /k "echo [路线服务] 启动中... && cd /d "%BACKEND_DIR%\route-service" && set PYTHONPATH=%BACKEND_DIR% && "%VENV_PYTHON%" main.py"

REM 订单服务
start "订单:8003" cmd /k "echo [订单服务] 启动中... && cd /d "%BACKEND_DIR%\order-service" && set PYTHONPATH=%BACKEND_DIR% && "%VENV_PYTHON%" main.py"

REM 支付服务
start "支付:8006" cmd /k "echo [支付服务] 启动中... && cd /d "%BACKEND_DIR%\pay-service" && set PYTHONPATH=%BACKEND_DIR% && "%VENV_PYTHON%" main.py"

echo.
echo ========================================
echo   服务启动命令已执行！
echo ========================================
echo.
echo 请查看弹出的命令窗口确认服务状态
echo.
echo API文档地址:
echo   http://localhost:8000/docs
echo   http://localhost:8001/docs
echo   http://localhost:8033/docs
echo   http://localhost:8003/docs
echo   http://localhost:8006/docs
echo.
pause

# 尾巴旅行 - 启动所有后端服务
# 使用方式: 右键选择"使用 PowerShell 运行"

$ErrorActionPreference = "Continue"

# 检查MySQL
Write-Host "检查 MySQL 状态..." -ForegroundColor Cyan
try {
    $mysql = mysql -u root -proot -e "SELECT 1;" 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ MySQL 运行中" -ForegroundColor Green
    } else {
        Write-Host "  ✗ MySQL 未启动，请先启动 MySQL" -ForegroundColor Red
        pause
        exit
    }
} catch {
    Write-Host "  ✗ MySQL 命令不可用，请确保 MySQL 已安装并添加到 PATH" -ForegroundColor Red
    pause
    exit
}

# 初始化数据库
Write-Host "`n初始化数据库..." -ForegroundColor Cyan
cd $PSScriptRoot
& .\venv\Scripts\python.exe -m scripts.init_database 2>&1 | ForEach-Object {
    if ($_ -match "Error|error|失败") {
        Write-Host "  $_" -ForegroundColor Red
    } else {
        Write-Host "  $_" -ForegroundColor Gray
    }
}

# 启动服务函数
function Start-ServiceInWindow($name, $path, $port) {
    Write-Host "启动 $name (port $port)..." -ForegroundColor Yellow
    $servicePath = Join-Path $PSScriptRoot $path
    $cmd = "cd '$servicePath'; & '$PSScriptRoot\venv\Scripts\python.exe' -m uvicorn main:app --host 0.0.0.0 --port $port --reload"
    Start-Process powershell -ArgumentList "-NoExit", "-Command", $cmd -WindowStyle Normal
    Start-Sleep -Seconds 2
}

Write-Host "`n启动后端服务..." -ForegroundColor Cyan

# 启动各个服务
Start-ServiceInWindow "Gateway" "gateway" 8000
Start-ServiceInWindow "User Service" "user-service" 8001
Start-ServiceInWindow "Route Service" "route-service" 8002
Start-ServiceInWindow "Order Service" "order-service" 8003

Write-Host "`n============================================" -ForegroundColor Green
Write-Host "所有服务已启动！" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "服务地址:"
Write-Host "  Gateway:      http://localhost:8000"
Write-Host "  User Service: http://localhost:8001"
Write-Host "  Route Service:http://localhost:8002"
Write-Host "  Order Service:http://localhost:8003"
Write-Host ""
Write-Host "按任意键关闭此窗口（服务会继续运行）..."

pause

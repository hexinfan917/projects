# 尾巴旅行 - 启动所有后端服务 (10个微服务)
# 注意：不使用 --reload，避免多进程问题

$ErrorActionPreference = "Continue"

# 服务配置: 名称, 路径, 端口
$services = @(
    @{Name="Gateway";       Path="gateway";        Port=8080},
    @{Name="User Service";  Path="user-service";   Port=8001},
    @{Name="Route Service"; Path="route-service";  Port=8033},
    @{Name="Order Service"; Path="order-service";  Port=8003},
    @{Name="Map Service";   Path="map-service";    Port=8004},
    @{Name="Content Service"; Path="content-service"; Port=8005},
    @{Name="Pay Service";   Path="pay-service";    Port=8006},
    @{Name="Message Service"; Path="message-service"; Port=8007},
    @{Name="File Service";  Path="file-service";   Port=8008},
    @{Name="Charity Service"; Path="charity-service"; Port=8009}
)

# 先停止现有 Python 进程（保留 admin 前端）
Write-Host "停止现有 Python 服务进程..." -ForegroundColor Cyan
$pythonProcesses = Get-Process python -ErrorAction SilentlyContinue | Where-Object {
    $_.MainWindowTitle -notlike "*node*" -and $_.MainWindowTitle -notlike "*admin*"
}
foreach ($proc in $pythonProcesses) {
    try {
        Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
        Write-Host "  已停止进程 $($proc.Id)" -ForegroundColor Gray
    } catch {}
}
Start-Sleep -Seconds 2

# 检查MySQL
Write-Host "`n检查 MySQL 状态..." -ForegroundColor Cyan
try {
    $mysqlResult = & mysql -u root -proot -e "SELECT 1;" 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ MySQL 运行中" -ForegroundColor Green
    } else {
        Write-Host "  ⚠ MySQL 未启动或密码错误，继续启动服务..." -ForegroundColor Yellow
    }
} catch {
    Write-Host "  ⚠ MySQL 命令不可用，继续启动服务..." -ForegroundColor Yellow
}

Write-Host "`n启动所有后端服务..." -ForegroundColor Cyan

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = Join-Path $ScriptDir "backend"
$VenvPython = Join-Path $BackendDir "venv\Scripts\python.exe"

# 启动每个服务
foreach ($svc in $services) {
    Write-Host "启动 $($svc.Name) (port $($svc.Port))..." -ForegroundColor Yellow
    $servicePath = Join-Path $BackendDir $svc.Path
    $cmd = "cd '$servicePath'; & '$VenvPython' -m uvicorn main:app --host 0.0.0.0 --port $($svc.Port)"
    Start-Process powershell -ArgumentList "-NoExit", "-Command", $cmd -WindowStyle Minimized
    Start-Sleep -Seconds 2
}

Write-Host "`n============================================" -ForegroundColor Green
Write-Host "所有服务已启动！" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "服务地址:" -ForegroundColor Cyan
foreach ($svc in $services) {
    Write-Host "  $($svc.Name): http://localhost:$($svc.Port)" -ForegroundColor White
}
Write-Host ""
Write-Host "注意：不使用 --reload 模式，避免多进程问题" -ForegroundColor Yellow
Write-Host "按任意键关闭此窗口（服务会继续运行）..." -ForegroundColor Gray
pause

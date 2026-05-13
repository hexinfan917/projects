# 尾巴旅行项目 - 一键启动所有后端服务
# 使用说明: 在 PowerShell 中运行 .\start-all-services.ps1

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  尾巴旅行项目 - 启动所有后端服务" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 获取项目根目录
$ProjectRoot = $PSScriptRoot
$BackendDir = Join-Path $ProjectRoot "backend"

# 服务配置: 名称 = 端口
$Services = @{
    "gateway"        = 8081
    "user-service"   = 8001
    "route-service"  = 8033
    "order-service"  = 8003
    "pay-service"    = 8006
    "content-service"= 8005
    "map-service"    = 8004
    "message-service"= 8007
    "file-service"   = 8008
    "charity-service"= 8009
}

# 先检查端口占用
Write-Host "检查端口占用..." -ForegroundColor Gray
$occupied = @()
foreach ($svc in $Services.GetEnumerator()) {
    $port = $svc.Value
    $conn = netstat -ano | findstr ":$port " | findstr "LISTENING"
    if ($conn) {
        $occupied += $port
        Write-Host "  端口 $port 已被占用" -ForegroundColor Yellow
    }
}

if ($occupied.Count -gt 0) {
    Write-Host ""
    Write-Host "警告: 以下端口已被占用，可能导致启动失败" -ForegroundColor Yellow
    $continue = Read-Host "是否继续? (y/n)"
    if ($continue -ne 'y') {
        exit
    }
}

Write-Host ""
Write-Host "正在启动后端服务..." -ForegroundColor Green
Write-Host ""

# 日志目录
$LogDir = Join-Path $ProjectRoot "logs"
if (!(Test-Path $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir | Out-Null
}

$index = 0
foreach ($svc in $Services.GetEnumerator()) {
    $index++
    $name = $svc.Key
    $port = $svc.Value
    $module = "$name.main:app"
    $logFile = Join-Path $LogDir "$name.log"

    Write-Host "[$index/$($Services.Count)] 启动 $name (端口 $port)..." -ForegroundColor Gray

    # 使用 uvicorn 启动，切换到服务目录后再启动，确保 import app 能找到模块
    $outLog = "$logFile.out.log"
    $errLog = "$logFile.err.log"
    $svcDir = Join-Path $BackendDir $name
    $pythonExe = Join-Path $BackendDir "venv\Scripts\python.exe"
    $proc = Start-Process -FilePath $pythonExe `
        -ArgumentList "-m uvicorn main:app --host 0.0.0.0 --port $port" `
        -WorkingDirectory $svcDir `
        -WindowStyle Hidden `
        -RedirectStandardOutput $outLog `
        -RedirectStandardError $errLog `
        -PassThru

    Start-Sleep -Seconds 1
}

Start-Sleep -Seconds 3

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  所有后端服务已启动!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "服务地址:" -ForegroundColor Cyan
Write-Host "  Gateway (API入口): http://localhost:8081" -ForegroundColor White
Write-Host "  User Service:      http://localhost:8001" -ForegroundColor White
Write-Host "  Order Service:     http://localhost:8003" -ForegroundColor White
Write-Host "  Route Service:     http://localhost:8033" -ForegroundColor White
Write-Host "  Pay Service:       http://localhost:8006" -ForegroundColor White
Write-Host "  Content Service:   http://localhost:8005" -ForegroundColor White
Write-Host "  Map Service:       http://localhost:8004" -ForegroundColor White
Write-Host "  Message Service:   http://localhost:8007" -ForegroundColor White
Write-Host "  File Service:      http://localhost:8008" -ForegroundColor White
Write-Host "  Charity Service:   http://localhost:8009" -ForegroundColor White
Write-Host ""
Write-Host "前端配置:" -ForegroundColor Cyan
Write-Host "  管理后台代理: http://localhost:8081" -ForegroundColor White
Write-Host "  小程序API地址: http://localhost:8081" -ForegroundColor White
Write-Host ""
Write-Host "日志文件:" -ForegroundColor Cyan
Write-Host "  $LogDir\*.out.log (标准输出)" -ForegroundColor White
Write-Host "  $LogDir\*.err.log (错误输出)" -ForegroundColor White
Write-Host ""

# 测试 Gateway
Write-Host "正在测试 Gateway..." -ForegroundColor Gray
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8081/health" -UseBasicParsing -TimeoutSec 5
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ Gateway 测试通过" -ForegroundColor Green
    }
} catch {
    Write-Host "⚠️  Gateway 可能尚未就绪，请查看日志: $LogDir\gateway.log.err.log" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "提示:" -ForegroundColor Yellow
Write-Host "  - 关闭此窗口不会停止服务，服务在后台运行" -ForegroundColor Yellow
Write-Host "  - 如需停止服务，请运行 .\stop-all-services.ps1" -ForegroundColor Yellow
Write-Host "  - 查看实时日志: Get-Content logs\gateway.log -Wait" -ForegroundColor Yellow
Write-Host ""

Read-Host "按 Enter 键继续..."

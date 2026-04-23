# 犬兜行项目 - 一键终止并重启所有后端服务
# 使用说明: 在 PowerShell 中运行 .\restart-all-services.ps1

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  犬兜行项目 - 重启所有后端服务" -ForegroundColor Cyan
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

# 先终止占用端口的进程
Write-Host "正在终止旧服务进程..." -ForegroundColor Gray
$killed = @()
foreach ($svc in $Services.GetEnumerator()) {
    $name = $svc.Key
    $port = $svc.Value
    $conn = netstat -ano | findstr ":$port " | findstr "LISTENING"
    if ($conn) {
        $parts = $conn -split '\s+'
        $procId = $parts[$parts.Length - 1]
        try {
            taskkill /PID $procId /F | Out-Null
            Write-Host "  ✅ 已终止 $name (端口 $port, PID $procId)" -ForegroundColor Green
            $killed += $name
        } catch {
            Write-Host "  ⚠️  无法终止 $name (端口 $port, PID $procId)" -ForegroundColor Yellow
        }
    }
}

if ($killed.Count -gt 0) {
    Write-Host ""
    Write-Host "等待进程释放端口..." -ForegroundColor Gray
    Start-Sleep -Seconds 3
} else {
    Write-Host "  未发现运行中的服务进程" -ForegroundColor Gray
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
Write-Host "  所有后端服务已重启完成!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "服务地址:" -ForegroundColor Cyan
Write-Host "  Gateway (API入口): http://localhost:8081" -ForegroundColor White
Write-Host "  Content Service:   http://localhost:8005" -ForegroundColor White
Write-Host "  File Service:      http://localhost:8008" -ForegroundColor White
Write-Host "  Charity Service:   http://localhost:8009" -ForegroundColor White
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
    Write-Host "⚠️  Gateway 可能尚未就绪" -ForegroundColor Yellow
}

Write-Host ""
Read-Host "按 Enter 键继续..."

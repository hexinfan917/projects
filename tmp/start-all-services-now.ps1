# 启动所有后端服务（不检查端口，不等待用户输入）
$ErrorActionPreference = "Stop"

$ProjectRoot = $PSScriptRoot
if (-not $ProjectRoot) {
    $ProjectRoot = Get-Location
}
$ProjectRoot = Split-Path -Parent $ProjectRoot

$BackendDir = Join-Path $ProjectRoot "backend"
$LogDir = Join-Path $ProjectRoot "logs"

if (!(Test-Path $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir | Out-Null
}

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

foreach ($svc in $Services.GetEnumerator()) {
    $name = $svc.Key
    $port = $svc.Value
    $logFile = Join-Path $LogDir "$name.log"
    $outLog = "$logFile.out.log"
    $errLog = "$logFile.err.log"
    $svcDir = Join-Path $BackendDir $name
    $pythonExe = Join-Path $BackendDir "venv\Scripts\python.exe"

    Write-Host "Starting $name on port $port..." -ForegroundColor Gray

    Start-Process -FilePath $pythonExe `
        -ArgumentList "-m uvicorn main:app --host 0.0.0.0 --port $port" `
        -WorkingDirectory $svcDir `
        -WindowStyle Hidden `
        -RedirectStandardOutput $outLog `
        -RedirectStandardError $errLog

    Start-Sleep -Seconds 1
}

Write-Host "All backend services started." -ForegroundColor Green

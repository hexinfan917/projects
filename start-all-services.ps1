# 犬兜行项目 - 一键启动所有服务
# 使用说明: 在 PowerShell 中运行 .\start-all-services.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  犬兜行项目 - 启动所有服务" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 检查进程是否已在运行
$ports = @(8031, 8032, 8033, 8005, 8084)
$running = $false

foreach ($port in $ports) {
    $conn = netstat -ano | findstr ":$port" | findstr "LISTENING"
    if ($conn) {
        $running = $true
        Write-Host "端口 $port 已被占用" -ForegroundColor Yellow
    }
}

if ($running) {
    Write-Host ""
    Write-Host "警告: 部分服务可能已在运行" -ForegroundColor Yellow
    $continue = Read-Host "是否继续? (y/n)"
    if ($continue -ne 'y') {
        exit
    }
}

Write-Host ""
Write-Host "正在启动后端服务..." -ForegroundColor Green

# 启动 User Service (端口 8031)
Write-Host "[1/5] 启动 User Service (端口 8031)..." -ForegroundColor Gray
Start-Process -WindowStyle Hidden -FilePath "python" -ArgumentList "-m uvicorn user-service.main:app --host 0.0.0.0 --port 8031" -WorkingDirectory "$PSScriptRoot\backend"
Start-Sleep -Seconds 2

# 启动 Order Service (端口 8032)
Write-Host "[2/5] 启动 Order Service (端口 8032)..." -ForegroundColor Gray
Start-Process -WindowStyle Hidden -FilePath "python" -ArgumentList "-m uvicorn order-service.main:app --host 0.0.0.0 --port 8032" -WorkingDirectory "$PSScriptRoot\backend"
Start-Sleep -Seconds 2

# 启动 Route Service (端口 8033)
Write-Host "[3/5] 启动 Route Service (端口 8033)..." -ForegroundColor Gray
Start-Process -WindowStyle Hidden -FilePath "python" -ArgumentList "-m uvicorn route-service.main:app --host 0.0.0.0 --port 8033" -WorkingDirectory "$PSScriptRoot\backend"
Start-Sleep -Seconds 2

# 启动 Content Service (端口 8005)
Write-Host "[4/5] 启动 Content Service (端口 8005)..." -ForegroundColor Gray
Start-Process -WindowStyle Hidden -FilePath "python" -ArgumentList "-m uvicorn content-service.main:app --host 0.0.0.0 --port 8005" -WorkingDirectory "$PSScriptRoot\backend"
Start-Sleep -Seconds 2

# 启动 Gateway (端口 8084)
Write-Host "[5/5] 启动 Gateway (端口 8084)..." -ForegroundColor Gray
Start-Process -WindowStyle Hidden -FilePath "python" -ArgumentList "-m uvicorn gateway.main:app --host 0.0.0.0 --port 8084" -WorkingDirectory "$PSScriptRoot\backend"
Start-Sleep -Seconds 3

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  所有后端服务已启动!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "服务地址:" -ForegroundColor Cyan
Write-Host "  Gateway (API入口): http://localhost:8084" -ForegroundColor White
Write-Host "  User Service:      http://localhost:8031" -ForegroundColor White
Write-Host "  Order Service:     http://localhost:8032" -ForegroundColor White
Write-Host "  Route Service:     http://localhost:8033" -ForegroundColor White
Write-Host "  Content Service:   http://localhost:8005" -ForegroundColor White
Write-Host ""
Write-Host "前端配置:" -ForegroundColor Cyan
Write-Host "  管理后台代理: http://localhost:8084" -ForegroundColor White
Write-Host "  小程序API地址: http://localhost:8084" -ForegroundColor White
Write-Host ""
Write-Host "测试命令:" -ForegroundColor Cyan
Write-Host "  curl http://localhost:8084/health" -ForegroundColor White
Write-Host ""

# 测试服务是否启动
Write-Host "正在测试服务..." -ForegroundColor Gray
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8084/health" -UseBasicParsing -TimeoutSec 5
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ Gateway 测试通过" -ForegroundColor Green
    }
} catch {
    Write-Host "⚠️  Gateway 可能尚未就绪，请稍后再试" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "提示: 关闭此窗口不会停止服务，服务在后台运行" -ForegroundColor Yellow
Write-Host "      如需停止服务，请运行 stop-all-services.ps1" -ForegroundColor Yellow
Write-Host ""

Read-Host "按 Enter 键继续..."

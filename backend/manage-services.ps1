# 尾巴旅行后端服务管理脚本
param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("start", "stop", "restart", "status")]
    [string]$Action
)

$services = @(
    @{Name="Gateway"; Port=8080; Path="gateway\main.py"},
    @{Name="User Service"; Port=8001; Path="user-service\main.py"},
    @{Name="Route Service"; Port=8002; Path="route-service\main.py"},
    @{Name="Order Service"; Port=8003; Path="order-service\main.py"}
)

function Get-ServiceStatus {
    param($Port)
    try {
        $conn = Test-NetConnection -ComputerName localhost -Port $Port -WarningAction SilentlyContinue
        return $conn.TcpTestSucceeded
    } catch {
        return $false
    }
}

function Stop-AllServices {
    Write-Host "正在停止所有服务..." -ForegroundColor Yellow
    Get-Process python -ErrorAction SilentlyContinue | Stop-Process -Force
    Start-Sleep 2
    Write-Host "所有服务已停止" -ForegroundColor Green
}

function Start-AllServices {
    Write-Host "正在启动所有服务..." -ForegroundColor Green
    
    # 先检查 MySQL
    $mysqlRunning = Get-Service mysql -ErrorAction SilentlyContinue | Where-Object {$_.Status -eq 'Running'}
    if (-not $mysqlRunning) {
        Write-Host "正在启动 MySQL..." -ForegroundColor Yellow
        Start-Service mysql
    }
    
    # 启动各个服务
    foreach ($svc in $services) {
        $running = Get-ServiceStatus -Port $svc.Port
        if (-not $running) {
            Write-Host "启动 $($svc.Name) (port $($svc.Port))..." -ForegroundColor Cyan
            Start-Process -FilePath "powershell" -ArgumentList "-Command", "cd d:\projects\backend; .\venv\Scripts\python $($svc.Path)" -WindowStyle Hidden
            Start-Sleep 1
        } else {
            Write-Host "$($svc.Name) 已在运行" -ForegroundColor Gray
        }
    }
    
    Start-Sleep 3
    
    # 显示状态
    Write-Host "`n服务状态:" -ForegroundColor Green
    foreach ($svc in $services) {
        $running = Get-ServiceStatus -Port $svc.Port
        $status = if ($running) { "✓ 运行中" } else { "✗ 未启动" }
        $color = if ($running) { "Green" } else { "Red" }
        Write-Host "  $($svc.Name) (port $($svc.Port)): " -NoNewline
        Write-Host $status -ForegroundColor $color
    }
}

switch ($Action) {
    "start" { Start-AllServices }
    "stop" { Stop-AllServices }
    "restart" { Stop-AllServices; Start-Sleep 2; Start-AllServices }
    "status" {
        Write-Host "服务状态:" -ForegroundColor Green
        foreach ($svc in $services) {
            $running = Get-ServiceStatus -Port $svc.Port
            $status = if ($running) { "✓ 运行中" } else { "✗ 未运行" }
            $color = if ($running) { "Green" } else { "Red" }
            Write-Host "  $($svc.Name) (port $($svc.Port)): " -NoNewline
            Write-Host $status -ForegroundColor $color
        }
    }
}

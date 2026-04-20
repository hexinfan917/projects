# 犬兜行后端服务停止脚本
# 使用方式: .\stop-backend.ps1
# 功能: 停止所有Python后端服务进程

Write-Host "========================================" -ForegroundColor Yellow
Write-Host "  犬兜行后端服务停止脚本" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow
Write-Host ""

# 需要停止的进程名
$ProcessNames = @("python", "python.exe")
$Ports = @(8000, 8001, 8002, 8003, 8004, 8005, 8006, 8007, 8008, 8009)

Write-Host "正在查找并停止后端服务进程..." -ForegroundColor Cyan

$StoppedCount = 0

# 方法1: 通过端口查找并停止进程
foreach ($Port in $Ports) {
    try {
        # 查找占用端口的进程
        $Connection = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($Connection) {
            $Process = Get-Process -Id $Connection.OwningProcess -ErrorAction SilentlyContinue
            if ($Process) {
                Write-Host "停止端口 $Port 的进程: $($Process.ProcessName) (PID: $($Process.Id))" -ForegroundColor Yellow
                Stop-Process -Id $Process.Id -Force -ErrorAction SilentlyContinue
                $StoppedCount++
            }
        }
    } catch {
        # 忽略错误
    }
}

# 方法2: 查找包含特定关键字的Python进程
$Keywords = @("gateway", "user-service", "route-service", "order-service", "map-service", "pay-service")

foreach ($Keyword in $Keywords) {
    $Processes = Get-Process | Where-Object { 
        $_.ProcessName -like "*python*" -and 
        $_.CommandLine -like "*$Keyword*" 
    } -ErrorAction SilentlyContinue
    
    foreach ($Process in $Processes) {
        try {
            Write-Host "停止服务进程: $Keyword (PID: $($Process.Id))" -ForegroundColor Yellow
            Stop-Process -Id $Process.Id -Force -ErrorAction SilentlyContinue
            $StoppedCount++
        } catch {
            # 忽略错误
        }
    }
}

Write-Host ""
if ($StoppedCount -gt 0) {
    Write-Host "已停止 $StoppedCount 个服务进程" -ForegroundColor Green
} else {
    Write-Host "没有找到正在运行的后端服务" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "所有后端服务已停止" -ForegroundColor Green

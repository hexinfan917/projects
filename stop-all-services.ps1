# 尾巴旅行项目 - 停止所有服务
# 使用说明: 在 PowerShell 中运行 .\stop-all-services.ps1

Write-Host "========================================" -ForegroundColor Red
Write-Host "  尾巴旅行项目 - 停止所有服务" -ForegroundColor Red
Write-Host "========================================" -ForegroundColor Red
Write-Host ""

$ports = @(
    @{ Port = 8081; Name = "Gateway" },
    @{ Port = 8001; Name = "User Service" },
    @{ Port = 8003; Name = "Order Service" },
    @{ Port = 8033; Name = "Route Service" },
    @{ Port = 8006; Name = "Pay Service" },
    @{ Port = 8005; Name = "Content Service" },
    @{ Port = 8004; Name = "Map Service" },
    @{ Port = 8007; Name = "Message Service" },
    @{ Port = 8008; Name = "File Service" },
    @{ Port = 8009; Name = "Charity Service" }
)

$stoppedCount = 0

foreach ($service in $ports) {
    $port = $service.Port
    $name = $service.Name
    
    Write-Host "正在查找端口 $port ($name)..." -ForegroundColor Gray
    
    # 获取占用该端口的进程
    $connections = netstat -ano | findstr ":$port" | findstr "LISTENING"
    
    if ($connections) {
        foreach ($conn in $connections) {
            $parts = $conn -split '\s+'
            $pid = $parts[-1]
            
            if ($pid -match '^\d+$') {
                try {
                    Stop-Process -Id $pid -Force -ErrorAction Stop
                    Write-Host "✅ 已停止 $name (PID: $pid)" -ForegroundColor Green
                    $stoppedCount++
                } catch {
                    Write-Host "❌ 无法停止 $name (PID: $pid): $_" -ForegroundColor Red
                }
            }
        }
    } else {
        Write-Host "⚠️  $name 未运行" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
if ($stoppedCount -gt 0) {
    Write-Host "  已停止 $stoppedCount 个服务" -ForegroundColor Green
} else {
    Write-Host "  没有服务在运行" -ForegroundColor Yellow
}
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 额外清理 Python 进程
$pythonProcesses = Get-Process python -ErrorAction SilentlyComplete | Where-Object { 
    $_.Path -like "*backend*" 
}

if ($pythonProcesses) {
    Write-Host "发现 $($pythonProcesses.Count) 个 Python 后端进程" -ForegroundColor Yellow
    $cleanPython = Read-Host "是否一并停止? (y/n)"
    if ($cleanPython -eq 'y') {
        $pythonProcesses | Stop-Process -Force
        Write-Host "✅ 已清理 Python 进程" -ForegroundColor Green
    }
}

Read-Host "按 Enter 键退出..."

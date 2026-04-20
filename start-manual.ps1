# 手动启动脚本 - 在已激活虚拟环境的终端中使用
# 使用方式: 先激活虚拟环境，然后运行此脚本

$ProjectRoot = $PSScriptRoot
if (-not $ProjectRoot) {
    $ProjectRoot = Get-Location
}

$BackendDir = Join-Path $ProjectRoot "backend"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  手动启动后端服务" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 检查虚拟环境是否激活
if (-not $env:VIRTUAL_ENV) {
    Write-Host "[警告] 虚拟环境未激活，正在尝试激活..." -ForegroundColor Yellow
    $VenvActivate = Join-Path $BackendDir "venv\Scripts\Activate.ps1"
    if (Test-Path $VenvActivate) {
        & $VenvActivate
    } else {
        Write-Host "[错误] 找不到虚拟环境，请先运行 init-project.ps1" -ForegroundColor Red
        exit 1
    }
}

# 设置 PYTHONPATH
$env:PYTHONPATH = $BackendDir
Write-Host "PYTHONPATH: $env:PYTHONPATH" -ForegroundColor Gray
Write-Host ""

# 启动服务函数
function Start-BackendService {
    param(
        [string]$Name,
        [int]$Port
    )
    
    $ServiceDir = Join-Path $BackendDir "$Name-service"
    $MainPy = Join-Path $ServiceDir "main.py"
    
    Write-Host "[$Name-service] 启动中... (端口: $Port)" -ForegroundColor Green
    
    # 使用 Start-Job 在后台运行
    $Job = Start-Job -ScriptBlock {
        param($Dir, $PyPath, $Backend)
        Set-Location $Dir
        $env:PYTHONPATH = $Backend
        python $PyPath
    } -ArgumentList $ServiceDir, $MainPy, $BackendDir -Name "$Name-service"
    
    return $Job
}

# 启动所有服务
$Jobs = @()

Write-Host "正在启动服务..." -ForegroundColor Cyan
Write-Host ""

$Jobs += Start-BackendService -Name "gateway" -Port 8000
Start-Sleep -Seconds 1

$Jobs += Start-BackendService -Name "user" -Port 8001
$Jobs += Start-BackendService -Name "route" -Port 8002
$Jobs += Start-BackendService -Name "order" -Port 8003
$Jobs += Start-BackendService -Name "pay" -Port 8006

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  所有服务已启动！" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "服务状态:" -ForegroundColor Cyan

# 检查服务状态
Start-Sleep -Seconds 3

$Services = @(
    @{ Name = "API网关"; Port = 8000 },
    @{ Name = "用户服务"; Port = 8001 },
    @{ Name = "路线服务"; Port = 8002 },
    @{ Name = "订单服务"; Port = 8003 },
    @{ Name = "支付服务"; Port = 8006 }
)

foreach ($Svc in $Services) {
    try {
        $Response = Invoke-WebRequest -Uri "http://localhost:$($Svc.Port)/health" -TimeoutSec 2 -ErrorAction Stop
        if ($Response.StatusCode -eq 200) {
            Write-Host "✓ $($Svc.Name) (端口: $($Svc.Port))" -ForegroundColor Green
        }
    } catch {
        Write-Host "✗ $($Svc.Name) (端口: $($Svc.Port))" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "API文档:" -ForegroundColor Cyan
Write-Host "  http://localhost:8000/docs" -ForegroundColor Yellow
Write-Host ""
Write-Host "按 Ctrl+C 停止所有服务" -ForegroundColor Yellow

# 等待并监控任务
try {
    while ($true) {
        Start-Sleep -Seconds 5
        $RunningJobs = $Jobs | Where-Object { $_.State -eq "Running" }
        if ($RunningJobs.Count -eq 0) {
            Write-Host "`n所有服务已停止" -ForegroundColor Yellow
            break
        }
    }
} finally {
    # 清理任务
    $Jobs | Remove-Job -Force -ErrorAction SilentlyContinue
}

# 尾巴旅行后端服务一键启动脚本
param(
    [string]$Service = "all"
)

$ProjectRoot = $PSScriptRoot
if (-not $ProjectRoot) {
    $ProjectRoot = Get-Location
}

$BackendDir = Join-Path $ProjectRoot "backend"
$VenvPython = Join-Path $BackendDir "venv\Scripts\python.exe"
$VenvPip = Join-Path $BackendDir "venv\Scripts\pip.exe"

# 颜色定义
$Green = "Green"
$Yellow = "Yellow"
$Red = "Red"
$Cyan = "Cyan"

Write-Host "========================================" -ForegroundColor $Cyan
Write-Host "  尾巴旅行后端服务启动脚本" -ForegroundColor $Cyan
Write-Host "========================================" -ForegroundColor $Cyan
Write-Host ""

# 检查虚拟环境
if (-not (Test-Path $VenvPython)) {
    Write-Host "[错误] 虚拟环境不存在，请先运行初始化" -ForegroundColor $Red
    Write-Host "  正在创建虚拟环境..." -ForegroundColor $Yellow
    
    cd $BackendDir
    python -m venv venv
    
    if (-not (Test-Path $VenvPython)) {
        Write-Host "[错误] 虚拟环境创建失败" -ForegroundColor $Red
        exit 1
    }
    
    Write-Host "  安装依赖..." -ForegroundColor $Yellow
    & $VenvPip install -r "$BackendDir\common\requirements.txt"
}

# 检查关键依赖
try {
    & $VenvPython -c "import jwt" 2>$null
} catch {
    Write-Host "  安装依赖..." -ForegroundColor $Yellow
    & $VenvPip install -r "$BackendDir\common\requirements.txt"
}

# 服务配置
$Services = @{
    "gateway" = @{ Port = 8000; Name = "API网关"; Color = $Cyan }
    "user" = @{ Port = 8001; Name = "用户服务"; Color = $Green }
    "route" = @{ Port = 8002; Name = "路线服务"; Color = $Green }
    "order" = @{ Port = 8003; Name = "订单服务"; Color = $Green }
    "pay" = @{ Port = 8006; Name = "支付服务"; Color = $Green }
}

# 启动单个服务的函数
function Start-Service {
    param(
        [string]$ServiceName,
        [int]$Port,
        [string]$DisplayName,
        [string]$Color
    )
    
    $ServiceDir = Join-Path $BackendDir "$ServiceName-service"
    
    if (-not (Test-Path $ServiceDir)) {
        Write-Host "[$DisplayName] 目录不存在，跳过" -ForegroundColor $Yellow
        return
    }
    
    Write-Host "[$DisplayName] 启动中... (端口: $Port)" -ForegroundColor $Color -NoNewline
    
    # 构建启动命令 - 使用绝对路径
    $MainPy = Join-Path $ServiceDir "main.py"
    $PythonPath = $BackendDir
    
    $Command = @"
cd "$ServiceDir"
`$env:PYTHONPATH = "$PythonPath"
"$VenvPython" "$MainPy"
"@
    
    # 在新窗口中启动
    Start-Process -FilePath "powershell.exe" -ArgumentList "-NoExit", "-Command", $Command -WindowStyle Normal
    
    Start-Sleep -Seconds 2
    Write-Host " [已启动]" -ForegroundColor $Green
}

# 根据参数启动服务
if ($Service -eq "all") {
    Write-Host "正在启动所有服务..." -ForegroundColor $Cyan
    Write-Host ""
    
    # 启动所有服务
    Start-Service -ServiceName "gateway" -Port 8000 -DisplayName "API网关" -Color $Cyan
    Start-Sleep -Seconds 1
    
    Start-Service -ServiceName "user" -Port 8001 -DisplayName "用户服务" -Color $Green
    Start-Service -ServiceName "route" -Port 8002 -DisplayName "路线服务" -Color $Green
    Start-Service -ServiceName "order" -Port 8003 -DisplayName "订单服务" -Color $Green
    Start-Service -ServiceName "pay" -Port 8006 -DisplayName "支付服务" -Color $Green
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor $Cyan
    Write-Host "  所有服务启动完成！" -ForegroundColor $Green
    Write-Host "========================================" -ForegroundColor $Cyan
    Write-Host ""
    Write-Host "服务地址:" -ForegroundColor $Cyan
    Write-Host "  API网关: http://localhost:8000/docs" -ForegroundColor $Yellow
    Write-Host "  用户服务: http://localhost:8001/docs" -ForegroundColor $Yellow
    Write-Host "  路线服务: http://localhost:8002/docs" -ForegroundColor $Yellow
    Write-Host "  订单服务: http://localhost:8003/docs" -ForegroundColor $Yellow
    Write-Host ""
    Write-Host "提示: 每个服务都在单独的PowerShell窗口中运行" -ForegroundColor $Cyan
    
} elseif ($Services.ContainsKey($Service)) {
    $Svc = $Services[$Service]
    Start-Service -ServiceName $Service -Port $Svc.Port -DisplayName $Svc.Name -Color $Svc.Color
    Write-Host ""
    Write-Host "服务已启动: http://localhost:$($Svc.Port)/docs" -ForegroundColor $Yellow
} else {
    Write-Host "[错误] 未知服务: $Service" -ForegroundColor $Red
    Write-Host "可用服务: $($Services.Keys -join ', '), all" -ForegroundColor $Yellow
}

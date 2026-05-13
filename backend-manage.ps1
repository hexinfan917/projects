# 尾巴旅行后端服务管理脚本
# 使用方式: .\backend-manage.ps1 [命令]
# 命令: start, stop, restart, status

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("start", "stop", "restart", "status")]
    [string]$Command
)

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$Ports = @(8000, 8001, 8002, 8003, 8004, 8005, 8006)

function Get-ServiceStatus {
    Write-Host "检查服务状态..." -ForegroundColor Cyan
    Write-Host ""
    
    $ServiceNames = @("API网关", "用户服务", "路线服务", "订单服务", "地图服务", "内容服务", "支付服务")
    
    for ($i = 0; $i -lt $Ports.Count; $i++) {
        $Port = $Ports[$i]
        $Name = $ServiceNames[$i]
        
        try {
            $Response = Invoke-WebRequest -Uri "http://localhost:$Port/health" -TimeoutSec 2 -ErrorAction Stop
            if ($Response.StatusCode -eq 200) {
                Write-Host "✓ $Name (端口: $Port)" -ForegroundColor Green
            }
        } catch {
            Write-Host "✗ $Name (端口: $Port)" -ForegroundColor Red
        }
    }
}

function Start-AllServices {
    Write-Host "启动所有服务..." -ForegroundColor Cyan
    & "$ProjectRoot\start-backend.ps1" all
}

function Stop-AllServices {
    Write-Host "停止所有服务..." -ForegroundColor Yellow
    & "$ProjectRoot\stop-backend.ps1"
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  尾巴旅行后端服务管理" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

switch ($Command) {
    "start" {
        Start-AllServices
    }
    "stop" {
        Stop-AllServices
    }
    "restart" {
        Stop-AllServices
        Start-Sleep -Seconds 2
        Start-AllServices
    }
    "status" {
        Get-ServiceStatus
    }
}

Write-Host ""
Write-Host "操作完成" -ForegroundColor Green

# 尾巴旅行后端服务管理脚本
# 使用方式: .\backend-manage.ps1 [命令]
# 命令: start, stop, restart, status

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("start", "stop", "restart", "status")]
    [string]$Command
)

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$Services = @(
    @{ Name = "API网关"; Port = 8081 }
    @{ Name = "用户服务"; Port = 8001 }
    @{ Name = "订单服务"; Port = 8003 }
    @{ Name = "地图服务"; Port = 8004 }
    @{ Name = "内容服务"; Port = 8005 }
    @{ Name = "支付服务"; Port = 8006 }
    @{ Name = "消息服务"; Port = 8007 }
    @{ Name = "文件服务"; Port = 8008 }
    @{ Name = "公益服务"; Port = 8009 }
    @{ Name = "路线服务"; Port = 8033 }
)

function Get-ServiceStatus {
    Write-Host "检查服务状态..." -ForegroundColor Cyan
    Write-Host ""
    
    foreach ($svc in $Services) {
        $Port = $svc.Port
        $Name = $svc.Name
        
        try {
            $Response = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/health" -TimeoutSec 5 -ErrorAction Stop
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

# 尾巴旅行项目 - 本地开发环境一键启动脚本
# 同时启动：后端服务、管理后台前端、小程序开发构建、微信开发者工具
#
# 使用方式: 在 PowerShell 中运行 .\start-all-local.ps1

param(
    [switch]$SkipBackend = $false,
    [switch]$SkipAdmin = $false,
    [switch]$SkipMiniapp = $false,
    [switch]$SkipWechat = $false
)

$ErrorActionPreference = "Stop"

# 项目路径
$ProjectRoot = $PSScriptRoot
if (-not $ProjectRoot) {
    $ProjectRoot = Get-Location
}

$BackendDir = Join-Path $ProjectRoot "backend"
$FrontendAdminDir = Join-Path $ProjectRoot "frontend\admin"
$FrontendMiniappDir = Join-Path $ProjectRoot "frontend\miniapp"
$LogDir = Join-Path $ProjectRoot "logs"
$WechatCli = "D:\software\微信web开发者工具\cli.bat"

# 确保日志目录存在
if (!(Test-Path $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir | Out-Null
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  尾巴旅行 - 本地开发环境一键启动" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ========================
# 1. 启动后端服务
# ========================
if (-not $SkipBackend) {
    Write-Host "[1/4] 启动后端服务..." -ForegroundColor Cyan
    $StartServicesScript = Join-Path $ProjectRoot "start-all-services.ps1"
    if (Test-Path $StartServicesScript) {
        # 在新窗口中运行，避免 Read-Host 阻塞当前脚本
        Start-Process -FilePath "powershell.exe" `
            -ArgumentList "-ExecutionPolicy", "Bypass", "-File", "$StartServicesScript" `
            -WindowStyle Normal
        Write-Host "  ✓ 后端服务启动窗口已打开 (端口: 8081/8001/8003/8033/8004/8005/8006/8007/8008/8009)" -ForegroundColor Green
    } else {
        Write-Host "  ✗ 未找到 start-all-services.ps1，跳过后端启动" -ForegroundColor Red
    }
    Write-Host ""
    Start-Sleep -Seconds 2
} else {
    Write-Host "[1/4] 跳过后端服务" -ForegroundColor Gray
}

# ========================
# 2. 启动管理后台前端
# ========================
if (-not $SkipAdmin) {
    Write-Host "[2/4] 启动管理后台前端..." -ForegroundColor Cyan
    if (Test-Path $FrontendAdminDir) {
        $adminLog = Join-Path $LogDir "admin-dev.out.log"
        $adminErr = Join-Path $LogDir "admin-dev.err.log"
        
        $adminCommand = "cd '$FrontendAdminDir'; npm run dev"
        Start-Process -FilePath "powershell.exe" `
            -ArgumentList "-NoExit", "-Command", $adminCommand `
            -WindowStyle Normal `
            -RedirectStandardOutput $adminLog `
            -RedirectStandardError $adminErr
        
        Write-Host "  ✓ 管理后台启动窗口已打开" -ForegroundColor Green
        Write-Host "    默认地址: http://localhost:8000/admin" -ForegroundColor Gray
        Write-Host "    代理目标: http://localhost:8081" -ForegroundColor Gray
    } else {
        Write-Host "  ✗ 未找到 $FrontendAdminDir，跳过管理后台启动" -ForegroundColor Red
    }
    Write-Host ""
    Start-Sleep -Seconds 2
} else {
    Write-Host "[2/4] 跳过管理后台前端" -ForegroundColor Gray
}

# ========================
# 3. 启动小程序开发构建
# ========================
if (-not $SkipMiniapp) {
    Write-Host "[3/4] 启动小程序开发构建..." -ForegroundColor Cyan
    if (Test-Path $FrontendMiniappDir) {
        $miniappLog = Join-Path $LogDir "miniapp-dev.out.log"
        $miniappErr = Join-Path $LogDir "miniapp-dev.err.log"
        
        $miniappCommand = "cd '$FrontendMiniappDir'; npm run dev:weapp"
        Start-Process -FilePath "powershell.exe" `
            -ArgumentList "-NoExit", "-Command", $miniappCommand `
            -WindowStyle Normal `
            -RedirectStandardOutput $miniappLog `
            -RedirectStandardError $miniappErr
        
        Write-Host "  ✓ 小程序开发构建窗口已打开" -ForegroundColor Green
        Write-Host "    项目目录: $FrontendMiniappDir" -ForegroundColor Gray
        Write-Host "    输出目录: $FrontendMiniappDir\dist" -ForegroundColor Gray
    } else {
        Write-Host "  ✗ 未找到 $FrontendMiniappDir，跳过小程序构建" -ForegroundColor Red
    }
    Write-Host ""
    Start-Sleep -Seconds 2
} else {
    Write-Host "[3/4] 跳过小程序开发构建" -ForegroundColor Gray
}

# ========================
# 4. 打开微信开发者工具
# ========================
if (-not $SkipWechat) {
    Write-Host "[4/4] 打开微信开发者工具..." -ForegroundColor Cyan
    if (Test-Path $WechatCli) {
        try {
            Start-Process -FilePath $WechatCli `
                -ArgumentList "open", "--project", "$FrontendMiniappDir" `
                -WindowStyle Hidden
            Write-Host "  ✓ 微信开发者工具已打开项目: $FrontendMiniappDir" -ForegroundColor Green
        } catch {
            Write-Host "  ⚠ 无法通过微信 CLI 打开工具: $_" -ForegroundColor Yellow
            Write-Host "    请手动打开微信开发者工具，导入项目: $FrontendMiniappDir" -ForegroundColor Yellow
        }
    } else {
        Write-Host "  ⚠ 未找到微信开发者工具 CLI: $WechatCli" -ForegroundColor Yellow
        Write-Host "    请手动打开微信开发者工具，导入项目: $FrontendMiniappDir" -ForegroundColor Yellow
    }
    Write-Host ""
} else {
    Write-Host "[4/4] 跳过微信开发者工具" -ForegroundColor Gray
}

# ========================
# 完成提示
# ========================
Start-Sleep -Seconds 3

Write-Host "========================================" -ForegroundColor Green
Write-Host "  启动命令已全部执行！" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "📋 访问地址:" -ForegroundColor Cyan
Write-Host "  后端 API 入口: http://localhost:8081" -ForegroundColor White
Write-Host "  管理后台:      http://localhost:8000/admin" -ForegroundColor White
Write-Host "  API 文档:      http://localhost:8081/docs" -ForegroundColor White
Write-Host ""
Write-Host "📱 小程序:" -ForegroundColor Cyan
Write-Host "  微信开发者工具 → 项目: $FrontendMiniappDir" -ForegroundColor White
Write-Host ""
Write-Host "📁 日志文件:" -ForegroundColor Cyan
Write-Host "  后端服务: logs\*-service.log.*.log" -ForegroundColor White
Write-Host "  管理后台: logs\admin-dev.*.log" -ForegroundColor White
Write-Host "  小程序:   logs\miniapp-dev.*.log" -ForegroundColor White
Write-Host ""
Write-Host "🛑 停止方式:" -ForegroundColor Cyan
Write-Host "  后端服务: .\stop-all-services.ps1" -ForegroundColor White
Write-Host "  前端服务: 关闭对应的 PowerShell 窗口" -ForegroundColor White
Write-Host ""
Write-Host "⏳ 提示:" -ForegroundColor Yellow
Write-Host "  - 后端服务启动需要几秒钟，请查看弹出的窗口确认状态" -ForegroundColor Yellow
Write-Host "  - 管理后台首次编译可能需要 30-60 秒" -ForegroundColor Yellow
Write-Host "  - 小程序首次编译后，微信开发者工具会自动刷新" -ForegroundColor Yellow
Write-Host ""

Read-Host "按 Enter 键退出此窗口"

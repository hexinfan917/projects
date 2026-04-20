# 犬兜行开发环境一键启动脚本
# 同时启动后端服务和前端小程序开发服务器

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  犬兜行开发环境启动" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 检查虚拟环境
$VenvPath = "$ProjectRoot\backend\venv\Scripts\Activate.ps1"
if (-not (Test-Path $VenvPath)) {
    Write-Host "[警告] 虚拟环境不存在，请先运行初始化" -ForegroundColor Yellow
    Write-Host "  正在尝试初始化..." -ForegroundColor Yellow
    
    # 创建虚拟环境
    cd "$ProjectRoot\backend"
    python -m venv venv
    
    # 激活并安装依赖
    & "$ProjectRoot\backend\venv\Scripts\Activate.ps1"
    pip install -r "$ProjectRoot\backend\common\requirements.txt"
}

# 启动后端服务
Write-Host "[1/2] 启动后端服务..." -ForegroundColor Cyan
& "$ProjectRoot\start-backend.ps1" all

Write-Host ""
Write-Host "[2/2] 前端说明:" -ForegroundColor Cyan
Write-Host "  小程序开发: 请使用微信开发者工具导入 dist 目录" -ForegroundColor Yellow
Write-Host "  dist目录: $ProjectRoot\frontend\miniapp\dist" -ForegroundColor Yellow
Write-Host ""

# 显示访问地址
Write-Host "========================================" -ForegroundColor Green
Write-Host "  开发环境已就绪！" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "📱 小程序:" -ForegroundColor Cyan
Write-Host "   微信开发者工具 → 导入项目 → $ProjectRoot\frontend\miniapp\dist" -ForegroundColor White
Write-Host ""
Write-Host "🖥️ API文档:" -ForegroundColor Cyan
Write-Host "   http://localhost:8000/docs (API网关)" -ForegroundColor White
Write-Host "   http://localhost:8001/docs (用户服务)" -ForegroundColor White
Write-Host "   http://localhost:8002/docs (路线服务)" -ForegroundColor White
Write-Host "   http://localhost:8003/docs (订单服务)" -ForegroundColor White
Write-Host ""
Write-Host "⚡ 快捷命令:" -ForegroundColor Cyan
Write-Host "   .\start-backend.ps1       # 启动所有服务" -ForegroundColor Gray
Write-Host "   .\stop-backend.ps1        # 停止所有服务" -ForegroundColor Gray
Write-Host "   .\backend-manage.ps1 status  # 查看服务状态" -ForegroundColor Gray
Write-Host ""
Write-Host "每个后端服务都在独立的窗口中运行，关闭窗口即可停止对应服务" -ForegroundColor Yellow

# 保持窗口打开
Write-Host ""
Read-Host "按 Enter 键退出此窗口"

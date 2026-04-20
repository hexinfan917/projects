# 犬兜行 - Windows PowerShell 项目初始化脚本

Write-Host "========================================" -ForegroundColor Green
Write-Host "  犬兜行项目初始化 (Windows)" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green

$projectRoot = $PSScriptRoot
if (-not $projectRoot) {
    $projectRoot = Get-Location
}

Set-Location $projectRoot

# 1. 检查 Python
Write-Host "`n[1/5] 检查 Python 环境..." -ForegroundColor Yellow
$python = Get-Command python -ErrorAction SilentlyContinue
if (-not $python) {
    Write-Host "错误: 未找到 Python，请先安装 Python 3.11+" -ForegroundColor Red
    Write-Host "下载地址: https://www.python.org/downloads/" -ForegroundColor Cyan
    exit 1
}
python --version

# 2. 创建虚拟环境
Write-Host "`n[2/5] 创建 Python 虚拟环境..." -ForegroundColor Yellow
if (-not (Test-Path "$projectRoot\backend\venv")) {
    Set-Location "$projectRoot\backend"
    python -m venv venv
    Write-Host "虚拟环境创建完成" -ForegroundColor Green
} else {
    Write-Host "虚拟环境已存在" -ForegroundColor Gray
}

# 3. 安装后端依赖
Write-Host "`n[3/5] 安装后端依赖..." -ForegroundColor Yellow
$venvPip = "$projectRoot\backend\venv\Scripts\pip.exe"
& $venvPip install --upgrade pip
& $venvPip install -r "$projectRoot\backend\common\requirements.txt"

# 4. 检查 Node.js
Write-Host "`n[4/5] 检查 Node.js 环境..." -ForegroundColor Yellow
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    Write-Host "警告: 未找到 Node.js，前端项目需要 Node.js 18+" -ForegroundColor Yellow
    Write-Host "下载地址: https://nodejs.org/" -ForegroundColor Cyan
} else {
    node --version
    
    # 安装小程序依赖
    if (Test-Path "$projectRoot\frontend\miniapp") {
        Write-Host "安装小程序依赖..." -ForegroundColor Cyan
        Set-Location "$projectRoot\frontend\miniapp"
        if (-not (Test-Path "node_modules")) {
            npm install
        }
    }
    
    # 安装管理后台依赖
    if (Test-Path "$projectRoot\frontend\admin") {
        Write-Host "安装管理后台依赖..." -ForegroundColor Cyan
        Set-Location "$projectRoot\frontend\admin"
        if (-not (Test-Path "node_modules")) {
            npm install
        }
    }
}

# 5. 初始化数据库（可选）
Write-Host "`n[5/5] 数据库初始化（可选）..." -ForegroundColor Yellow
Write-Host "如果你的本地已安装 MySQL，可以运行数据库初始化脚本" -ForegroundColor Gray
Write-Host "脚本路径: database/scripts/init_database.py" -ForegroundColor Gray

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "  初始化完成!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "`n可用命令:" -ForegroundColor Cyan
Write-Host "  .\start-services.ps1    - 启动后端服务" -ForegroundColor White
Write-Host "  cd frontend/miniapp; npm run dev:weapp  - 启动小程序" -ForegroundColor White
Write-Host "  cd frontend/admin; npm run dev         - 启动管理后台" -ForegroundColor White
Write-Host "`nAPI 文档地址:" -ForegroundColor Cyan
Write-Host "  用户服务: http://localhost:8001/docs" -ForegroundColor Gray
Write-Host "  路线服务: http://localhost:8002/docs" -ForegroundColor Gray
Write-Host "  订单服务: http://localhost:8003/docs" -ForegroundColor Gray
Write-Host "  API 网关: http://localhost:8000/docs" -ForegroundColor Gray

Set-Location $projectRoot

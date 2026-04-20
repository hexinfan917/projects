# 修复依赖脚本
$ProjectRoot = $PSScriptRoot
if (-not $ProjectRoot) {
    $ProjectRoot = Get-Location
}

$BackendDir = Join-Path $ProjectRoot "backend"
$VenvPip = Join-Path $BackendDir "venv\Scripts\pip.exe"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  修复后端依赖" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $VenvPip)) {
    Write-Host "[错误] 找不到pip，请先创建虚拟环境" -ForegroundColor Red
    exit 1
}

Write-Host "安装/更新依赖..." -ForegroundColor Yellow
& $VenvPip install -r "$BackendDir\common\requirements.txt" --upgrade

Write-Host ""
Write-Host "依赖安装完成！" -ForegroundColor Green
Write-Host ""
Write-Host "现在可以运行: .\start-all.bat" -ForegroundColor Cyan

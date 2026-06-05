# 小程序彻底清理并编译脚本
# 用法: .\auto-build.ps1
# 功能: 删除所有缓存 → 重新编译 → 输出刷新提示

$ErrorActionPreference = "Stop"

Write-Host "=== 尾巴旅行小程序 - 彻底清理编译 ===" -ForegroundColor Green
Write-Host ""

Set-Location $PSScriptRoot

# 1. 删除 dist 目录（编译输出）
if (Test-Path "dist") {
    Write-Host "🗑️  删除旧 dist 目录..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force "dist" -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 500
}

# 2. 删除 Taro 缓存
$cacheDirs = @(
    ".taro-cache",
    "node_modules/.cache",
    "node_modules/.vite"
)
foreach ($dir in $cacheDirs) {
    if (Test-Path $dir) {
        Write-Host "🗑️  删除缓存: $dir" -ForegroundColor Yellow
        Remove-Item -Recurse -Force $dir -ErrorAction SilentlyContinue
    }
}

# 3. 重新编译
Write-Host ""
Write-Host "🔨 开始编译..." -ForegroundColor Green
npm run build:weapp

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ 编译成功！" -ForegroundColor Green
    Write-Host ""
    Write-Host "请在微信开发者工具中执行以下操作：" -ForegroundColor Cyan
    Write-Host "   1. 点击「工具」→「清除缓存」→「全部清除」" -ForegroundColor White
    Write-Host "   2. 按 Ctrl+R 刷新项目" -ForegroundColor White
    Write-Host "   3. 如果还是旧代码，关闭开发者工具重新打开" -ForegroundColor White
    Write-Host ""
    Write-Host "📁 编译输出目录: $(Resolve-Path dist)" -ForegroundColor Gray
} else {
    Write-Host ""
    Write-Host "❌ 编译失败，请检查错误信息" -ForegroundColor Red
}

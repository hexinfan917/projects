# 小程序自动编译脚本
# 用法: .\auto-build.ps1
# 功能: 自动运行 npm run build:weapp

$ErrorActionPreference = "Stop"

Write-Host "=== 开始编译小程序 ===" -ForegroundColor Green

Set-Location $PSScriptRoot

# 清理旧 dist（可选，解决缓存问题）
# Remove-Item -Recurse -Force dist -ErrorAction SilentlyContinue

# 执行编译
npm run build:weapp

if ($LASTEXITCODE -eq 0) {
    Write-Host "=== 编译成功 ===" -ForegroundColor Green
    Write-Host "请回到微信开发者工具，按 Ctrl+R 刷新或点击 编译 按钮"
} else {
    Write-Host "=== 编译失败 ===" -ForegroundColor Red
}

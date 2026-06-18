# 彻底清理并重新编译小程序
# 用法：在 PowerShell 中运行 .\clean-build.ps1

Write-Host "正在停止可能的 Node 进程..." -ForegroundColor Yellow
Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

Write-Host "正在删除 dist 目录..." -ForegroundColor Yellow
Remove-Item -Path ".\dist" -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "正在重新编译（本地开发模式）..." -ForegroundColor Green
$env:NODE_ENV = "development"
npm run build:weapp

Write-Host "编译完成。请手动在微信开发者工具中：工具 -> 清除缓存 -> 全部清除，然后重新编译。" -ForegroundColor Green

# 小程序自动编译并上传脚本
# 用法: .\auto-upload.ps1 [版本号] [描述]
# 示例: .\auto-upload.ps1 1.2.0 "修复优惠券bug"

$ErrorActionPreference = "Stop"

$version = if ($args[0]) { $args[0] } else { "1.0.0" }
$desc = if ($args[1]) { $args[1] } else { "自动构建上传" }

Write-Host "=== 尾巴旅行小程序自动上传 ===" -ForegroundColor Green
Write-Host "版本: $version" -ForegroundColor Cyan
Write-Host "描述: $desc" -ForegroundColor Cyan
Write-Host ""

Set-Location $PSScriptRoot

# 检查 private.key
if (-not (Test-Path "private.key")) {
    Write-Host "❌ 缺少上传密钥文件: private.key" -ForegroundColor Red
    Write-Host ""
    Write-Host "请按以下步骤获取：" -ForegroundColor Yellow
    Write-Host "1. 登录微信小程序后台: https://mp.weixin.qq.com/" -ForegroundColor White
    Write-Host "2. 前往「开发」→「开发设置」→「小程序代码上传」" -ForegroundColor White
    Write-Host "3. 点击「生成」或「下载」上传密钥" -ForegroundColor White
    Write-Host "4. 将 private.key 放到当前目录" -ForegroundColor White
    Write-Host ""
    exit 1
}

# 编译
Write-Host "=== 开始编译 ===" -ForegroundColor Green
npm run build:weapp
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 编译失败" -ForegroundColor Red
    exit 1
}

# 上传
Write-Host ""
Write-Host "=== 开始上传 ===" -ForegroundColor Green
node upload.js $version $desc

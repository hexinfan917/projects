# 小程序 API 地址批量更新脚本
# 使用说明: 修改 $MiniProgramPath 变量为你的小程序项目路径，然后运行此脚本

param(
    [string]$MiniProgramPath = "",  # 小程序项目路径，如 "C:\projects\quandouxing-miniapp"
    [string]$OldPort = "8080",       # 原端口
    [string]$NewPort = "8084"        # 新端口
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  小程序 API 地址更新工具" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 如果没有提供路径，尝试常见路径
if (-not $MiniProgramPath) {
    $possiblePaths = @(
        "C:\projects\quandouxing-miniapp",
        "D:\projects\quandouxing-miniapp",
        "C:\Users\$env:USERNAME\Documents\quandouxing-miniapp",
        "C:\Users\$env:USERNAME\Desktop\quandouxing-miniapp",
        "$PSScriptRoot\..\quandouxing-miniapp",
        "$PSScriptRoot\frontend\miniprogram"
    )
    
    foreach ($path in $possiblePaths) {
        if (Test-Path $path) {
            $MiniProgramPath = $path
            Write-Host "自动发现小程序项目: $path" -ForegroundColor Green
            break
        }
    }
}

if (-not $MiniProgramPath -or -not (Test-Path $MiniProgramPath)) {
    Write-Host "错误: 未找到小程序项目" -ForegroundColor Red
    Write-Host ""
    Write-Host "请提供小程序项目路径，例如:" -ForegroundColor Yellow
    Write-Host "  .\update-miniprogram-api.ps1 -MiniProgramPath \"C:\\projects\\quandouxing-miniapp\"" -ForegroundColor White
    Write-Host ""
    exit 1
}

Write-Host "小程序路径: $MiniProgramPath" -ForegroundColor Cyan
Write-Host "端口替换: $OldPort -> $NewPort" -ForegroundColor Cyan
Write-Host ""

# 常见配置文件列表
$configFiles = @(
    "utils/api.js",
    "utils/request.js",
    "utils/http.js",
    "utils/config.js",
    "config.js",
    "app.js",
    "api/config.js"
)

$updatedFiles = @()

foreach ($file in $configFiles) {
    $fullPath = Join-Path $MiniProgramPath $file
    
    if (Test-Path $fullPath) {
        Write-Host "检查: $file" -ForegroundColor Gray
        
        $content = Get-Content $fullPath -Raw -ErrorAction SilentlyContinue
        
        if ($content -and ($content -match "localhost:$OldPort" -or $content -match "127.0.0.1:$OldPort")) {
            $newContent = $content -replace "localhost:$OldPort", "localhost:$NewPort"
            $newContent = $newContent -replace "127.0.0.1:$OldPort", "127.0.0.1:$NewPort"
            
            Set-Content $fullPath $newContent -NoNewline
            Write-Host "✅ 已更新: $file" -ForegroundColor Green
            $updatedFiles += $file
        } else {
            Write-Host "⏭️  跳过: $file (未找到旧端口)" -ForegroundColor Gray
        }
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
if ($updatedFiles.Count -gt 0) {
    Write-Host "  成功更新 $($updatedFiles.Count) 个文件" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "已更新的文件:" -ForegroundColor Yellow
    $updatedFiles | ForEach-Object { Write-Host "  - $_" -ForegroundColor White }
} else {
    Write-Host "  未找到需要更新的文件" -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "可能的原因:" -ForegroundColor Yellow
    Write-Host "  1. API 地址可能写在其他文件中" -ForegroundColor White
    Write-Host "  2. 端口已经是 $NewPort" -ForegroundColor White
    Write-Host "  3. 使用了环境变量或配置文件" -ForegroundColor White
    Write-Host ""
    Write-Host "建议: 在小程序项目中搜索 '8080' 手动替换为 '8084'" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "下一步操作:" -ForegroundColor Cyan
Write-Host "  1. 在微信开发者工具中重新编译项目" -ForegroundColor White
Write-Host "  2. 点击'详情'->勾选'不校验合法域名...'" -ForegroundColor White
Write-Host "  3. 测试 API 连接" -ForegroundColor White
Write-Host ""

Read-Host "按 Enter 键退出..."

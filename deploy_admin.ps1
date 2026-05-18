# 管理后台前端快速部署脚本
# 构建并上传到生产环境

$PROJECT_ROOT = "D:\projects"
$SERVER_HOST = "101.43.50.236"
$SERVER_USER = "ubuntu"
$KEY_FILE = "$PROJECT_ROOT\petway.pem"
$LOCAL_DIST = "$PROJECT_ROOT\frontend\admin\dist"
$REMOTE_DIST = "/opt/petway/frontend/admin/dist"

Write-Host "=== 开始部署管理后台前端 ===" -ForegroundColor Cyan

# 1. 构建前端
Write-Host "`n[1/3] 正在构建前端..." -ForegroundColor Yellow
Set-Location "$PROJECT_ROOT\frontend\admin"
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "构建失败！" -ForegroundColor Red
    exit 1
}

# 2. 上传到服务器临时目录
Write-Host "`n[2/3] 正在上传到服务器..." -ForegroundColor Yellow
scp -r -i "$KEY_FILE" "$LOCAL_DIST" "${SERVER_USER}@${SERVER_HOST}:/tmp/admin_dist_new"
if ($LASTEXITCODE -ne 0) {
    Write-Host "上传失败！" -ForegroundColor Red
    exit 1
}

# 3. 替换生产环境目录
Write-Host "`n[3/3] 正在替换生产环境文件..." -ForegroundColor Yellow
ssh -i "$KEY_FILE" "${SERVER_USER}@${SERVER_HOST}" "sudo rm -rf ${REMOTE_DIST} && sudo mv /tmp/admin_dist_new ${REMOTE_DIST} && echo 'Deploy done!'"
if ($LASTEXITCODE -ne 0) {
    Write-Host "替换失败！" -ForegroundColor Red
    exit 1
}

Write-Host "`n=== 部署完成！ ===" -ForegroundColor Green
Write-Host "请访问 https://tailtravel.westilt.com/admin/ 查看效果" -ForegroundColor Green
Write-Host "建议按 Ctrl + F5 强制刷新浏览器缓存" -ForegroundColor Yellow

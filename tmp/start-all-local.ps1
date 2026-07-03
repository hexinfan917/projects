# 启动本地所有后端服务 + Admin 管理后台
$ErrorActionPreference = "Continue"
$root = "d:\projects"

$services = @(
  @{Name="Gateway"; Path="gateway"; Port=8000},
  @{Name="User Service"; Path="user-service"; Port=8001},
  @{Name="Route Service"; Path="route-service"; Port=8033},
  @{Name="Order Service"; Path="order-service"; Port=8003},
  @{Name="Map Service"; Path="map-service"; Port=8004},
  @{Name="Content Service"; Path="content-service"; Port=8005},
  @{Name="Pay Service"; Path="pay-service"; Port=8006},
  @{Name="Message Service"; Path="message-service"; Port=8007},
  @{Name="File Service"; Path="file-service"; Port=8008},
  @{Name="Charity Service"; Path="charity-service"; Port=8009}
)

foreach ($s in $services) {
  $cmd = "cd '$root\backend\$($s.Path)'; & '$root\backend\venv\Scripts\python.exe' -m uvicorn main:app --host 0.0.0.0 --port $($s.Port)"
  Start-Process powershell -ArgumentList "-NoExit", "-Command", $cmd -WindowStyle Minimized
  Write-Host "启动 $($s.Name) :$($s.Port)"
  Start-Sleep -Seconds 1
}

Start-Sleep -Seconds 3
$adminCmd = "cd '$root\frontend\admin'; npm run dev"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $adminCmd -WindowStyle Minimized
Write-Host "启动 Admin 后台"

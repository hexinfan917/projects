# 启动所有服务
$services = @(
    @{Name="Gateway"; Path="gateway\main.py"; Port=8080},
    @{Name="User Service"; Path="user-service\main.py"; Port=8001},
    @{Name="Route Service"; Path="route-service\main.py"; Port=8002},
    @{Name="Order Service"; Path="order-service\main.py"; Port=8003}
)

foreach ($svc in $services) {
    Write-Host "Starting $($svc.Name) on port $($svc.Port)..."
    Start-Process -FilePath ".\venv\Scripts\python" -ArgumentList $svc.Path -WindowStyle Hidden
    Start-Sleep -Seconds 2
}

Write-Host "All services started!"

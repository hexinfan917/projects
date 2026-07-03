$services = @(
    @{Name="user-service"; Port=8001},
    @{Name="route-service"; Port=8033},
    @{Name="order-service"; Port=8003},
    @{Name="pay-service"; Port=8006},
    @{Name="map-service"; Port=8004},
    @{Name="content-service"; Port=8005},
    @{Name="message-service"; Port=8007},
    @{Name="file-service"; Port=8008},
    @{Name="charity-service"; Port=8009}
)

$backendDir = "D:\projects\backend"
$venvPython = "$backendDir\venv\Scripts\python.exe"

foreach ($svc in $services) {
    $svcDir = "$backendDir\$($svc.Name)"
    if (Test-Path $svcDir) {
        Write-Host "Starting $($svc.Name) on port $($svc.Port)..."
        $cmd = "cd '$svcDir'; `$env:PYTHONPATH='$backendDir'; '$venvPython' main.py"
        Start-Process -FilePath "powershell.exe" -ArgumentList "-NoExit","-Command",$cmd -WindowStyle Normal
        Start-Sleep -Seconds 2
    }
}

# Gateway
Write-Host "Starting api-gateway on port 8081..."
$gatewayCmd = "cd '$backendDir\gateway'; `$env:PYTHONPATH='$backendDir'; '$venvPython' main.py"
Start-Process -FilePath "powershell.exe" -ArgumentList "-NoExit","-Command",$gatewayCmd -WindowStyle Normal

Write-Host "All backend services started."

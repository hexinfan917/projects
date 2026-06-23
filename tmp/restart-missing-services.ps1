$services = @(
    @{Name='user-service'; Port=8001},
    @{Name='map-service'; Port=8004},
    @{Name='message-service'; Port=8007},
    @{Name='file-service'; Port=8008},
    @{Name='charity-service'; Port=8009}
)
$backendDir = 'D:\projects\backend'
$venvPython = "$backendDir\venv\Scripts\python.exe"
foreach ($svc in $services) {
    $svcDir = "$backendDir\$($svc.Name)"
    if (Test-Path $svcDir) {
        Write-Host "Starting $($svc.Name) on port $($svc.Port)..."
        $cmd = "cd '$svcDir'; `$env:PYTHONPATH='$backendDir'; '$venvPython' -m uvicorn main:app --host 0.0.0.0 --port $($svc.Port)"
        Start-Process -FilePath 'powershell.exe' -ArgumentList '-NoExit','-Command',$cmd -WindowStyle Normal
        Start-Sleep -Seconds 2
    }
}

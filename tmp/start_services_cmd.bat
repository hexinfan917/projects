@echo off
set BACKEND_DIR=D:\projects\backend
set LOG_DIR=D:\projects\logs
set PYTHONPATH=%BACKEND_DIR%

start "user-service" /MIN cmd /c "cd /d %BACKEND_DIR%\user-service && %BACKEND_DIR%\venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8001 >> %LOG_DIR%\user-service.log.out.log 2>&1"
timeout /t 1 /nobreak >nul

start "route-service" /MIN cmd /c "cd /d %BACKEND_DIR%\route-service && %BACKEND_DIR%\venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8033 >> %LOG_DIR%\route-service.log.out.log 2>&1"
timeout /t 1 /nobreak >nul

start "order-service" /MIN cmd /c "cd /d %BACKEND_DIR%\order-service && %BACKEND_DIR%\venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8003 >> %LOG_DIR%\order-service.log.out.log 2>&1"
timeout /t 1 /nobreak >nul

start "pay-service" /MIN cmd /c "cd /d %BACKEND_DIR%\pay-service && %BACKEND_DIR%\venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8006 >> %LOG_DIR%\pay-service.log.out.log 2>&1"
timeout /t 1 /nobreak >nul

start "content-service" /MIN cmd /c "cd /d %BACKEND_DIR%\content-service && %BACKEND_DIR%\venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8005 >> %LOG_DIR%\content-service.log.out.log 2>&1"
timeout /t 1 /nobreak >nul

start "map-service" /MIN cmd /c "cd /d %BACKEND_DIR%\map-service && %BACKEND_DIR%\venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8004 >> %LOG_DIR%\map-service.log.out.log 2>&1"
timeout /t 1 /nobreak >nul

start "message-service" /MIN cmd /c "cd /d %BACKEND_DIR%\message-service && %BACKEND_DIR%\venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8007 >> %LOG_DIR%\message-service.log.out.log 2>&1"
timeout /t 1 /nobreak >nul

start "file-service" /MIN cmd /c "cd /d %BACKEND_DIR%\file-service && %BACKEND_DIR%\venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8008 >> %LOG_DIR%\file-service.log.out.log 2>&1"
timeout /t 1 /nobreak >nul

start "charity-service" /MIN cmd /c "cd /d %BACKEND_DIR%\charity-service && %BACKEND_DIR%\venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8009 >> %LOG_DIR%\charity-service.log.out.log 2>&1"
timeout /t 1 /nobreak >nul

start "gateway" /MIN cmd /c "cd /d %BACKEND_DIR%\gateway && %BACKEND_DIR%\venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8081 >> %LOG_DIR%\gateway.log.out.log 2>&1"

echo All services started.

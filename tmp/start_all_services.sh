#!/bin/bash
# 启动所有后端服务

cd /d/projects/backend
export PYTHONPATH=/d/projects/backend
VENV_PYTHON=/d/projects/backend/venv/Scripts/python.exe

# 确保日志目录存在
mkdir -p /d/projects/logs

# 启动所有服务
nohup $VENV_PYTHON /d/projects/backend/gateway/main.py > /d/projects/logs/gateway.log 2>&1 &
nohup $VENV_PYTHON /d/projects/backend/user-service/main.py > /d/projects/logs/user-service.log 2>&1 &
nohup $VENV_PYTHON /d/projects/backend/route-service/main.py > /d/projects/logs/route-service.log 2>&1 &
nohup $VENV_PYTHON /d/projects/backend/order-service/main.py > /d/projects/logs/order-service.log 2>&1 &
nohup $VENV_PYTHON /d/projects/backend/pay-service/main.py > /d/projects/logs/pay-service.log 2>&1 &
nohup $VENV_PYTHON /d/projects/backend/content-service/main.py > /d/projects/logs/content-service.log 2>&1 &
nohup $VENV_PYTHON /d/projects/backend/map-service/main.py > /d/projects/logs/map-service.log 2>&1 &
nohup $VENV_PYTHON /d/projects/backend/message-service/main.py > /d/projects/logs/message-service.log 2>&1 &
nohup $VENV_PYTHON /d/projects/backend/file-service/main.py > /d/projects/logs/file-service.log 2>&1 &
nohup $VENV_PYTHON /d/projects/backend/charity-service/main.py > /d/projects/logs/charity-service.log 2>&1 &

# 断开所有后台作业与 shell 的关联
disown -a

echo "All backend services started, PIDs:"
jobs -p

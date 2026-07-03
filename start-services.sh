#!/bin/bash
# 尾巴旅行 - 启动所有后端服务 (10个微服务)
# 注意：不使用 --reload，避免多进程问题

echo "============================================"
echo "启动所有后端服务..."
echo "============================================"

# 先停止现有 Python 进程
echo "停止现有 Python 进程..."
for pid in $(tasklist 2>/dev/null | grep python.exe | awk '{print $2}'); do
    taskkill //F //PID $pid 2>/dev/null
done
sleep 2

# 服务配置: 名称, 路径, 端口
services=(
    "gateway:gateway:8080"
    "user-service:user-service:8001"
    "route-service:route-service:8033"
    "order-service:order-service:8003"
    "map-service:map-service:8004"
    "content-service:content-service:8005"
    "pay-service:pay-service:8006"
    "message-service:message-service:8007"
    "file-service:file-service:8008"
    "charity-service:charity-service:8009"
)

cd "$(dirname "$0")/backend"
VENV_PYTHON="$(pwd)/venv/Scripts/python.exe"

for svc in "${services[@]}"; do
    IFS=':' read -r name path port <<< "$svc"
    echo ""
    echo "启动 $name (port $port)..."
    cd "$(pwd)/$path"
    nohup "$VENV_PYTHON" -m uvicorn main:app --host 0.0.0.0 --port "$port" > "$name.log" 2>&1 &
    cd - > /dev/null
    sleep 2
done

echo ""
echo "============================================"
echo "所有服务已启动！"
echo "============================================"
echo ""
echo "服务地址:"
for svc in "${services[@]}"; do
    IFS=':' read -r name path port <<< "$svc"
    echo "  $name: http://localhost:$port"
done
echo ""

# 等待服务启动
sleep 3

echo "检查服务状态..."
for svc in "${services[@]}"; do
    IFS=':' read -r name path port <<< "$svc"
    status=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$port/health 2>/dev/null || echo "000")
    if [ "$status" = "200" ]; then
        echo "  ✓ $name (port $port) - 运行中"
    else
        echo "  ✗ $name (port $port) - 未响应 (HTTP $status)"
    fi
done

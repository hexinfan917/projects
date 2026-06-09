#!/bin/bash
# 尾巴旅行 PetWay —— 本地开发一键启动脚本 (Bash)
# 用法: bash start-dev.sh

PROJECT_ROOT="/d/projects"
VENV_PATH="$PROJECT_ROOT/backend/venv/Scripts/activate"

# 颜色
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

start_service() {
    local name=$1
    local path=$2
    local port=$3
    local dir=$(dirname "$path")
    local file=$(basename "$path")
    echo -e "${CYAN}[$name] 启动中... (port: $port)${NC}"
    (
        cd "$dir"
        source "$VENV_PATH" 2>/dev/null || . "$VENV_PATH"
        python "$file" > /dev/null 2>&1 &
    )
    sleep 2
}

echo -e "${GREEN}=== 启动后端微服务 ===${NC}"
start_service "Gateway 网关"     "$PROJECT_ROOT/backend/gateway/main.py"        8000
start_service "User 用户服务"    "$PROJECT_ROOT/backend/user-service/main.py"   8001
start_service "Order 订单服务"   "$PROJECT_ROOT/backend/order-service/main.py"  8003
start_service "Route 路线服务"   "$PROJECT_ROOT/backend/route-service/main.py"  8033
start_service "Content 内容服务" "$PROJECT_ROOT/backend/content-service/main.py" 8005
start_service "Map 地图服务"     "$PROJECT_ROOT/backend/map-service/main.py"    8004
start_service "Pay 支付服务"     "$PROJECT_ROOT/backend/pay-service/main.py"    8006
start_service "Message 消息服务" "$PROJECT_ROOT/backend/message-service/main.py" 8007
start_service "File 文件服务"    "$PROJECT_ROOT/backend/file-service/main.py"   8008
start_service "Charity 公益服务" "$PROJECT_ROOT/backend/charity-service/main.py" 8009

echo -e "${YELLOW}后端服务已启动，等待 5 秒初始化...${NC}"
sleep 5

echo -e "${GREEN}=== 启动 Admin 管理后台 ===${NC}"
cd "$PROJECT_ROOT/frontend/admin"
npm run dev &

echo -e "${GREEN}=== 全部启动完成 ===${NC}"
echo -e "${CYAN}Admin 后台: http://localhost:8000 (或 8001)${NC}"
echo -e "${CYAN}小程序:     用微信开发者工具打开 frontend/miniapp/dist${NC}"
echo -e "${YELLOW}提示: 后台服务已后台运行，用 'ps | grep python' 查看，kill 对应 PID 停止${NC}"

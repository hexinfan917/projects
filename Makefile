# 尾巴旅行项目 Makefile

.PHONY: help install dev build test clean docker-up docker-down

help: ## 显示帮助信息
	@echo "可用命令:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

install: ## 安装所有依赖
	@echo "安装后端依赖..."
	cd backend && pip install -r common/requirements.txt
	@echo "安装小程序依赖..."
	cd frontend/miniapp && npm install
	@echo "安装管理后台依赖..."
	cd frontend/admin && npm install

dev-backend: ## 启动后端开发服务
	@echo "启动用户服务..."
	cd backend/user-service && python main.py &
	@echo "启动路线服务..."
	cd backend/route-service && python main.py &
	@echo "启动订单服务..."
	cd backend/order-service && python main.py &
	@echo "启动API网关..."
	cd backend/gateway && python main.py &

dev-miniapp: ## 启动小程序开发服务
	cd frontend/miniapp && npm run dev:weapp

dev-admin: ## 启动管理后台开发服务
	cd frontend/admin && npm run dev

docker-up: ## 启动Docker开发环境
	cd docker/dev && docker-compose up -d

docker-down: ## 停止Docker开发环境
	cd docker/dev && docker-compose down

docker-logs: ## 查看Docker日志
	cd docker/dev && docker-compose logs -f

db-init: ## 初始化数据库
	python database/scripts/init_database.py

db-migrate: ## 执行数据库迁移
	@echo "执行数据库迁移..."
	cd database && python scripts/init_database.py

test-backend: ## 运行后端测试
	cd backend && pytest

test-frontend: ## 运行前端测试
	cd frontend/miniapp && npm run test

test: test-backend test-frontend ## 运行所有测试

build-miniapp: ## 构建小程序
	cd frontend/miniapp && npm run build:weapp

build-admin: ## 构建管理后台
	cd frontend/admin && npm run build

build: build-miniapp build-admin ## 构建所有前端

clean: ## 清理构建文件
	@echo "清理Python缓存..."
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete
	find . -type f -name "*.pyo" -delete
	@echo "清理Node模块..."
	rm -rf frontend/miniapp/node_modules
	rm -rf frontend/admin/node_modules
	rm -rf frontend/miniapp/dist
	rm -rf frontend/admin/dist
	@echo "清理完成"

format: ## 格式化代码
	@echo "格式化Python代码..."
	cd backend && black . || true
	@echo "格式化完成"

lint: ## 代码检查
	@echo "检查Python代码..."
	cd backend && flake8 . || true
	@echo "检查完成"

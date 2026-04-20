# 数据库迁移完成文档

## 概述

所有后端服务已完成数据库迁移，从模拟数据切换到 MySQL 数据库。

## 数据库表结构

### 用户服务 (user-service)
- `users` - 用户表
- `pet_profiles` - 宠物档案表

### 路线服务 (route-service)
- `routes` - 路线表
- `route_schedules` - 路线排期表

### 订单服务 (order-service)
- `orders` - 订单表
- `order_evaluations` - 订单评价表

## 快速启动

### 1. 确保 MySQL 运行
```powershell
# 检查 MySQL 状态
mysql -u root -proot -e "SELECT 1;"
```

### 2. 一键启动所有服务
右键点击 `start-all.ps1` 选择"使用 PowerShell 运行"

或手动执行：
```powershell
# 1. 初始化数据库
cd backend
.\venv\Scripts\python.exe -m scripts.init_database

# 2. 启动各个服务（在单独的终端中）
cd gateway && ..\venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
cd user-service && ..\venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8001 --reload
cd route-service && ..\venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8002 --reload
cd order-service && ..\venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8003 --reload
```

## 初始数据

数据库初始化后会自动插入以下测试数据：

### 用户
- ID: 1, OpenID: mock_openid_dev, 昵称: 开发测试用户
- 宠物: 豆豆 (金毛寻回犬)

### 路线 (5条)
1. 海滨漫步一日游 - ￥199
2. 山居野趣两日游 - ￥399
3. 星空露营体验 - ￥299
4. 森林徒步探险 - ￥159
5. 城市宠物聚会 - ￥99

### 排期
每条路线都有未来30天的排期，价格和库存会浮动。

### 订单 (3个测试订单)
1. 待支付订单 - 海滨漫步一日游
2. 待出行订单 - 山居野趣两日游
3. 已完成订单 - 星空露营体验 (含评价)

## API 测试

### 路线列表
```bash
curl http://localhost:8000/api/v1/routes
```

### 路线详情
```bash
curl http://localhost:8000/api/v1/routes/1
```

### 路线排期
```bash
curl http://localhost:8000/api/v1/routes/1/schedules
```

### 订单列表 (需要 Authorization Header)
```bash
curl -H "Authorization: Bearer mock_token_123_dev" http://localhost:8000/api/v1/orders
```

## 配置说明

数据库配置在 `backend/.env` 文件中：
```env
DATABASE__HOST=localhost
DATABASE__PORT=3306
DATABASE__USERNAME=root
DATABASE__PASSWORD=root
DATABASE__DATABASE=quandouxing
```

## 故障排查

### 1. 数据库连接失败
- 检查 MySQL 是否启动
- 检查 `.env` 中的数据库密码是否正确
- 确保 `quandouxing` 数据库已创建

### 2. 表不存在
运行初始化脚本：
```powershell
.\venv\Scripts\python.exe -m scripts.init_database
```

### 3. 401 认证失败
开发环境使用以 `_dev` 结尾的 token：
```
Authorization: Bearer mock_token_xxx_dev
```

## 数据持久化

所有数据现在都会保存到 MySQL：
- 用户注册/登录信息
- 宠物档案
- 订单（创建、支付、取消、评价）
- 评价内容

重启服务后数据不会丢失。

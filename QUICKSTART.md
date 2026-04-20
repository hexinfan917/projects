# ⚡ 快速参考

## 推荐启动方式（按优先级）

### 方法1: 批处理文件（最简单）
```powershell
.\start-all.bat
```

### 方法2: 修复依赖后启动
```powershell
.\fix-deps.ps1          # 安装缺失的依赖
.\start-backend.ps1 all # 启动所有服务
```

### 方法3: 完全手动
```powershell
# 1. 激活虚拟环境
.\backend\venv\Scripts\Activate.ps1

# 2. 启动服务（每个服务一个窗口）
cd backend\gateway; $env:PYTHONPATH=".."; python main.py
cd backend\user-service; $env:PYTHONPATH=".."; python main.py
cd backend\route-service; $env:PYTHONPATH=".."; python main.py
cd backend\order-service; $env:PYTHONPATH=".."; python main.py
```

---

## 脚本说明

| 脚本 | 用途 | 推荐度 |
|-----|------|-------|
| `start-all.bat` | 一键启动所有服务（批处理） | ⭐⭐⭐⭐⭐ |
| `start-simple.bat` | 简化版启动（批处理） | ⭐⭐⭐⭐⭐ |
| `fix-deps.ps1` | 修复依赖问题 | ⭐⭐⭐⭐⭐ |
| `start-backend.ps1` | PowerShell启动脚本 | ⭐⭐⭐⭐ |
| `start-manual.ps1` | 手动模式（单窗口） | ⭐⭐⭐ |
| `stop-backend.ps1` | 停止所有服务 | ⭐⭐⭐⭐ |
| `backend-manage.ps1` | 管理命令 | ⭐⭐⭐ |

---

## 首次使用

```powershell
# 1. 初始化（只需一次）
.\init-project.ps1

# 2. 启动服务
.\start-all.bat

# 3. 打开微信开发者工具，导入 frontend\miniapp\dist
```

---

## 常用命令

```powershell
# 启动
.\start-all.bat

# 停止
.\stop-backend.ps1

# 查看状态
.\backend-manage.ps1 status

# 修复依赖
.\fix-deps.ps1
```

---

## 服务端口

| 服务 | 端口 | 地址 |
|-----|------|------|
| API网关 | 8000 | http://localhost:8000/docs |
| 用户服务 | 8001 | http://localhost:8001/docs |
| 路线服务 | 8002 | http://localhost:8002/docs |
| 订单服务 | 8003 | http://localhost:8003/docs |
| 支付服务 | 8006 | http://localhost:8006/docs |

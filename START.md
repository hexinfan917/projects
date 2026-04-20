# 🚀 快速启动指南

## 推荐使用批处理脚本（最简单）

```powershell
# 方法1: 使用批处理文件（推荐）
.\start-all.bat

# 方法2: 使用简化批处理
.\start-simple.bat
```

这两个 `.bat` 文件会打开多个命令窗口，每个服务一个窗口。

---

## 如果批处理无法运行，使用 PowerShell

### 1. 先修复依赖（如果报错缺少模块）

```powershell
.\fix-deps.ps1
```

### 2. 启动服务

```powershell
# 方法A: 一键启动所有服务
.\start-backend.ps1 all

# 方法B: 手动模式（在当前窗口启动）
.\start-manual.ps1

# 方法C: 启动单个服务
.\start-backend.ps1 user     # 用户服务
.\start-backend.ps1 route    # 路线服务
.\start-backend.ps1 order    # 订单服务
```

---

## 完全手动启动（备用方案）

如果脚本都无法运行，请手动执行：

```powershell
# 1. 进入项目目录
cd D:\projects

# 2. 激活虚拟环境（重要！）
.\backend\venv\Scripts\Activate.ps1

# 3. 检查依赖是否安装
python -c "import jwt"
# 如果报错，运行: pip install -r backend\common\requirements.txt

# 4. 设置环境变量
$env:PYTHONPATH = "D:\projects\backend"

# 5. 启动各个服务（每个服务一个窗口）

# 窗口1 - API网关:
cd backend\gateway
python main.py

# 窗口2 - 用户服务:
cd backend\user-service  
python main.py

# 窗口3 - 路线服务:
cd backend\route-service
python main.py

# 窗口4 - 订单服务:
cd backend\order-service
python main.py
```

---

## 服务状态检查

```powershell
.\backend-manage.ps1 status
```

## 停止所有服务

```powershell
.\stop-backend.ps1
```

或者直接在对应服务的命令窗口中按 `Ctrl+C`

---

## 常见问题

### 1. "No module named 'jwt'"

运行修复脚本：
```powershell
.\fix-deps.ps1
```

### 2. "虚拟环境不存在"

创建虚拟环境：
```powershell
cd backend
python -m venv venv
.\venv\Scripts\pip.exe install -r common\requirements.txt
```

### 3. 端口被占用

```powershell
# 停止所有Python进程
.\stop-backend.ps1

# 或手动查找并停止
Get-Process python | Stop-Process -Force
```

### 4. 无法执行脚本

以管理员身份运行 PowerShell，执行：
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

---

## 访问地址

服务启动后访问:

- API网关: http://localhost:8000/docs
- 用户服务: http://localhost:8001/docs
- 路线服务: http://localhost:8002/docs
- 订单服务: http://localhost:8003/docs
- 支付服务: http://localhost:8006/docs

---

## 微信小程序

1. 打开微信开发者工具
2. 导入项目: `D:\projects\frontend\miniapp\dist`
3. AppID: `touristappid`

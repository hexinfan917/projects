# 尾巴旅行 - 宠物友好型出行平台

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)

尾巴旅行是一个专注于宠物友好型出行的服务平台，为宠物主人提供携宠出行的一站式解决方案。

## 🚀 快速启动

### Windows 一键启动

```powershell
# 1. 进入项目目录
cd D:\projects

# 2. 一键启动所有后端服务
.\start-backend.ps1 all

# 或者启动单个服务
.\start-backend.ps1 user    # 用户服务
.\start-backend.ps1 route   # 路线服务
.\start-backend.ps1 order   # 订单服务

# 3. 查看服务状态
.\backend-manage.ps1 status

# 4. 停止所有服务
.\stop-backend.ps1

# 5. 重启所有服务
.\backend-manage.ps1 restart
```

### 手动启动（备用方案）

如果脚本无法运行，可以手动启动：

```powershell
# 1. 激活虚拟环境
cd D:\projects\backend
.\venv\Scripts\Activate.ps1

# 2. 启动各个服务（每个服务一个窗口）
# 窗口1: API网关
cd gateway
$env:PYTHONPATH = "..\.."
python main.py

# 窗口2: 用户服务
cd user-service
$env:PYTHONPATH = "..\.."
python main.py

# 窗口3: 路线服务
cd route-service
$env:PYTHONPATH = "..\.."
python main.py

# 窗口4: 订单服务
cd order-service
$env:PYTHONPATH = "..\.."
python main.py
```

## 📁 项目结构

```
petway/
├── backend/                    # Python FastAPI 微服务
│   ├── common/                 # 公共模块
│   ├── gateway/               # API网关 (8000)
│   ├── user-service/          # 用户服务 (8001)
│   ├── route-service/         # 路线服务 (8002)
│   ├── order-service/         # 订单服务 (8003)
│   ├── map-service/           # 地图服务 (8004)
│   ├── pay-service/           # 支付服务 (8006)
│   └── ...
├── frontend/
│   ├── miniapp/               # 微信小程序
│   └── admin/                 # 管理后台
└── 脚本文件
    ├── start-backend.ps1      # 启动后端服务
    ├── stop-backend.ps1       # 停止后端服务
    ├── backend-manage.ps1     # 服务管理
    └── init-project.ps1       # 项目初始化
```

## 🔧 可用脚本

| 脚本 | 功能 | 示例 |
|-----|------|------|
| `start-backend.ps1` | 启动后端服务 | `.\start-backend.ps1 all` |
| `stop-backend.ps1` | 停止后端服务 | `.\stop-backend.ps1` |
| `backend-manage.ps1` | 服务管理 | `.\backend-manage.ps1 status` |
| `init-project.ps1` | 项目初始化 | `.\init-project.ps1` |

## 📱 小程序开发

### 导入项目
1. 打开微信开发者工具
2. 选择「导入项目」
3. 项目目录选择: `D:\projects\frontend\miniapp\dist`
4. AppID 选择: `touristappid`（测试号）

### 页面结构
- 首页（发现）: 轮播、快捷入口、热门路线
- 路线列表: 筛选、排序、收藏
- 路线详情: 图片、行程、预订
- 地图: 附近POI、路线规划
- 订单: 确认、支付、详情
- 我的: 用户中心、订单列表

## 🌐 API 文档

启动服务后访问:

- API网关: http://localhost:8000/docs
- 用户服务: http://localhost:8001/docs
- 路线服务: http://localhost:8002/docs
- 订单服务: http://localhost:8003/docs
- 支付服务: http://localhost:8006/docs

## 🛠️ 技术栈

| 层级 | 技术 |
|:---|:---|
| 小程序端 | Taro 3.x + React 18 |
| 管理后台 | React 18 + Ant Design Pro |
| 后端服务 | Python 3.11 + FastAPI |
| 数据库 | MySQL 8.0 + Redis 7 |
| 支付 | 微信支付 V3 |

## 📝 核心功能

### 用户模块
- ✅ 微信授权登录
- ✅ 用户信息管理
- ✅ 宠物档案管理

### 路线模块
- ✅ 路线列表/详情
- ✅ 路线筛选/排序
- ✅ 路线排期查询
- ✅ 安全视频播放

### 订单模块
- ✅ 订单创建
- ✅ 微信支付集成
- ✅ 订单状态管理
- ✅ 退款处理

### 地图模块
- ✅ 附近POI搜索
- ✅ 路线规划
- ✅ 导航集成

## 🔐 环境变量

创建 `backend/.env` 文件:

```env
# 数据库
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=petway

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT
JWT_SECRET=your_secret_key

# 微信
WECHAT_APPID=your_appid
WECHAT_APPSECRET=your_appsecret
```

## 🤝 参与开发

```bash
# 1. 克隆项目
git clone https://github.com/your-org/petway.git

# 2. 初始化项目
cd petway
.\init-project.ps1

# 3. 启动开发环境
.\start-backend.ps1 all
```

## 📄 许可证

[MIT](LICENSE)

---

**尾巴旅行** - 让爱宠陪伴每一次旅行 🐕✈️

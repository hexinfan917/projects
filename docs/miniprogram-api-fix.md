# 微信小程序 API 地址修复指南

## 问题
小程序请求失败：`localhost:8080` 连接被拒绝

## 原因
后端服务端口已更改为 **8084**，但小程序配置仍为 **8080**

## 修复步骤

### 1. 找到小程序 API 配置文件
通常位于：
```
petway-miniapp/
  ├── utils/api.js
  ├── utils/request.js
  ├── config.js
  └── app.js
```

### 2. 修改 API 基础地址
找到类似以下代码：
```javascript
// 原配置（错误）
const BASE_URL = 'http://localhost:8080';

// 修改为（正确）
const BASE_URL = 'http://localhost:8084';
```

### 3. 常见文件位置
| 文件路径 | 修改内容 |
|---------|---------|
| `utils/api.js` | `const API_BASE = 'http://localhost:8084'` |
| `utils/request.js` | `baseUrl: 'http://localhost:8084'` |
| `config.js` | `apiHost: 'http://localhost:8084'` |
| `app.js` | `BASE_API: 'http://localhost:8084'` |

### 4. 修改示例
```javascript
// utils/request.js 或 utils/api.js
const BASE_URL = 'http://localhost:8084';  // 改为 8084

// 或者使用环境判断
const BASE_URL = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:8084' 
  : 'https://your-production-domain.com';
```

### 5. 小程序开发者工具设置
1. 点击右上角「详情」
2. 勾选「不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书」
3. 重新编译项目

---

## 后端服务端口对照表

| 服务 | 端口 | 用途 |
|------|------|------|
| Gateway | 8084 | API网关（小程序应连接此端口）|
| User Service | 8031 | 用户/宠物/出行人 |
| Order Service | 8032 | 订单/评价/退款 |
| Route Service | 8033 | 路线/排期 |
| Content Service | 8005 | 文章/攻略 |

---

## 测试命令
在小程序开发者工具 Console 中执行：
```javascript
wx.request({
  url: 'http://localhost:8084/api/v1/routes?page=1',
  success: (res) => console.log('成功:', res),
  fail: (err) => console.log('失败:', err)
});
```

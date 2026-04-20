# 对话梳理模板

## 使用方法
每隔 12 小时或项目阶段结束时，将以下内容填充后保存到 `docs/conversation-history/YYYY-MM-DD-HH.md`

---

## 📅 会话信息
- **时间**: {当前时间}
- **项目阶段**: {如：初期开发 / 功能完善 / 测试优化}
- **本次对话时长**: {时长}

## ✅ 已完成的功能
| 模块 | 功能点 | 状态 | 备注 |
|------|--------|------|------|
|  |  | ✅ |  |

## 🔄 进行中的功能
| 模块 | 功能点 | 进度 | 阻塞问题 |
|------|--------|------|----------|
|  |  |  |  |

## 📋 待办事项 (TODO)
- [ ] 
- [ ] 
- [ ] 

## 🔧 技术栈 & 配置
### 服务端口
| 服务 | 端口 | 状态 |
|------|------|------|
| Gateway |  |  |
| User Service |  |  |
| Order Service |  |  |
| Route Service |  |  |
| Content Service |  |  |

### 数据库表变更
```sql
-- 本次新增的表
```

## 💡 关键决策 & 注意事项
1. 
2. 
3. 

## 🐛 已知问题
| 问题 | 严重程度 | 解决方案 | 状态 |
|------|----------|----------|------|
|  |  |  |  |

## 📁 新增/修改的文件
```
backend/
  └── 
frontend/
  └── 
```

## 🎯 下次对话目标
1. 
2. 

---

## 快速恢复命令
```bash
# 启动所有服务
cd backend/user-service && python -m uvicorn main:app --port 8021
cd backend/order-service && python -m uvicorn main:app --port 8023
cd backend/route-service && python -m uvicorn main:app --port 8024
cd backend && python -m uvicorn gateway.main:app --port 8083
```

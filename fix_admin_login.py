with open('/opt/petway/backend/user-service/app/routers/auth.py', 'r') as f:
    content = f.read()

old_login = '''@router.post("/admin/login")
async def admin_login(login_data: dict):
    """
    管理后台登录
    
    - **username**: 管理员账号
    - **password**: 管理员密码
    """
    try:
        username = login_data.get("username")
        password = login_data.get("password")
        if username != "admin" or password != "admin123":
            return error(message="账号或密码错误")
        
        import jwt
        from datetime import datetime, timedelta
        from common.config import settings
        
        now = datetime.utcnow()
        payload = {
            "user_id": 0,
            "openid": "admin",
            "role": "admin",
            "type": "access",
            "iat": now,
            "exp": now + timedelta(hours=8),
        }
        token = jwt.encode(payload, settings.jwt.secret, algorithm=settings.jwt.algorithm)
        
        return success({
            "token": token,
            "role": "admin",
            "username": "admin"
        })
    except Exception as e:
        logger.error(f"Admin login failed: {e}")
        return error(message="登录失败")'''

new_login = '''@router.post("/admin/login")
async def admin_login(login_data: dict, db: AsyncSession = Depends(get_db)):
    """
    管理后台登录
    
    - **username**: 管理员账号 (手机号)
    - **password**: 管理员密码
    """
    try:
        from sqlalchemy import select
        from app.models.user import User
        import bcrypt
        
        username = login_data.get("username", "").strip()
        password = login_data.get("password", "")
        
        if not username or not password:
            return error(message="请输入账号和密码")
        
        # 兼容旧版硬编码
        if username == "admin" and password == "admin123":
            user_id = 1
        else:
            return error(message="账号或密码错误")
        
        import jwt
        from datetime import datetime, timedelta
        from common.config import settings
        
        now = datetime.utcnow()
        payload = {
            "user_id": user_id,
            "openid": "admin",
            "role": "admin",
            "type": "access",
            "iat": now,
            "exp": now + timedelta(hours=8),
        }
        token = jwt.encode(payload, settings.jwt.secret, algorithm=settings.jwt.algorithm)
        
        return success({
            "token": token,
            "role": "admin",
            "username": username
        })
    except Exception as e:
        logger.error(f"Admin login failed: {e}")
        return error(message="登录失败")'''

content = content.replace(old_login, new_login)

with open('/opt/petway/backend/user-service/app/routers/auth.py', 'w') as f:
    f.write(content)

print('Admin login updated')

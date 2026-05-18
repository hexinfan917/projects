with open("/app/main.py", "r") as f:
    content = f.read()

old = """    # 查询用户openid
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    openid = user.openid if user else current_user.get("openid", "")"""

new = """    # 直接从JWT中获取openid
    openid = current_user.get("openid", "")"""

content = content.replace(old, new)

# 同时删除不需要的 import
content = content.replace("from app.models.user import User\n", "")

with open("/app/main.py", "w") as f:
    f.write(content)

print("Done")

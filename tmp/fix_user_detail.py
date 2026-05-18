with open("/app/main.py", "r") as f:
    lines = f.readlines()

# 找到 admin_get_user_detail 的起始和结束位置
start = None
end = None
for i, line in enumerate(lines):
    if "async def admin_get_user_detail(" in line:
        start = i
    if start is not None and "async def admin_update_user(" in line:
        end = i
        break

new_func = """async def admin_get_user_detail(
    user_id: int,
    db: AsyncSession = Depends(get_db)
):
    \"\"\"管理后台获取用户详情\"\"\"
    try:
        from app.models.user import User
        
        result = await db.execute(select(User).where(User.id == user_id))
        u = result.scalar_one_or_none()
        
        if not u:
            return {"code": 404, "message": "用户不存在", "data": None}
        
        # 查询宠物数量
        from app.models.pet import PetProfile
        pet_count_result = await db.execute(
            select(func.count(PetProfile.id))
            .where(PetProfile.user_id == user_id, PetProfile.status == 1)
        )
        pet_count = pet_count_result.scalar() or 0
        
        # 查询会员状态
        from app.models.member import UserMembership
        member_result = await db.execute(
            select(UserMembership)
            .where(UserMembership.user_id == user_id, UserMembership.status == 1)
        )
        membership = member_result.scalar_one_or_none()
        
        user = {
            "id": u.id,
            "openid": u.openid,
            "nickname": u.nickname,
            "avatar": u.avatar,
            "phone": u.phone,
            "real_name": u.real_name,
            "id_card": u.id_card,
            "gender": u.gender,
            "birthday": u.birthday.isoformat() if u.birthday else None,
            "city": u.city,
            "member_level": u.member_level,
            "member_points": u.member_points,
            "is_member": membership is not None,
            "status": u.status,
            "pet_count": pet_count,
            "created_at": u.created_at.isoformat() if u.created_at else None,
            "updated_at": u.updated_at.isoformat() if u.updated_at else None,
        }
        
        return {"code": 200, "message": "success", "data": user}
    except Exception as e:
        logger.error(f"Error getting user detail: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return {"code": 500, "message": f"查询失败: {str(e)}", "data": None}


"""

# 替换
new_lines = lines[:start] + [new_func] + lines[end:]

with open("/app/main.py", "w") as f:
    f.writelines(new_lines)

print("Done")

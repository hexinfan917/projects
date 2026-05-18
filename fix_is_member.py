with open('/app/main.py', 'r') as f:
    content = f.read()

old = '''        # 批量查询宠物数量
        user_ids = [u.id for u in users_db]
        from app.models.pet import PetProfile
        pet_count_result = await db.execute(
            select(PetProfile.user_id, func.count(PetProfile.id))
            .where(PetProfile.user_id.in_(user_ids), PetProfile.status == 1)
            .group_by(PetProfile.user_id)
        )
        pet_count_map = {uid: c for uid, c in pet_count_result.all()}
        
        users = []
        for u in users_db:
            users.append({
                "id": u.id,
                "openid": u.openid,
                "nickname": u.nickname or '未设置昵称',
                "avatar": u.avatar,
                "phone": u.phone or '-',
                "real_name": u.real_name or '-',
                "id_card": u.id_card or '-',
                "gender": u.gender,
                "birthday": u.birthday.isoformat() if u.birthday else None,
                "member_level": u.member_level,
                "member_points": u.member_points,
                "status": u.status,
                "pet_count": pet_count_map.get(u.id, 0),
                "created_at": u.created_at.isoformat() if u.created_at else None,
            })'''

new = '''        # 批量查询宠物数量
        user_ids = [u.id for u in users_db]
        from app.models.pet import PetProfile
        pet_count_result = await db.execute(
            select(PetProfile.user_id, func.count(PetProfile.id))
            .where(PetProfile.user_id.in_(user_ids), PetProfile.status == 1)
            .group_by(PetProfile.user_id)
        )
        pet_count_map = {uid: c for uid, c in pet_count_result.all()}
        
        # 批量查询会员状态
        from app.models.member import UserMembership
        member_result = await db.execute(
            select(UserMembership.user_id)
            .where(UserMembership.user_id.in_(user_ids), UserMembership.status == 1)
        )
        member_user_ids = {row[0] for row in member_result.all()}
        
        users = []
        for u in users_db:
            users.append({
                "id": u.id,
                "openid": u.openid,
                "nickname": u.nickname or '未设置昵称',
                "avatar": u.avatar,
                "phone": u.phone or '-',
                "real_name": u.real_name or '-',
                "id_card": u.id_card or '-',
                "gender": u.gender,
                "birthday": u.birthday.isoformat() if u.birthday else None,
                "is_member": u.id in member_user_ids,
                "status": u.status,
                "pet_count": pet_count_map.get(u.id, 0),
                "created_at": u.created_at.isoformat() if u.created_at else None,
            })'''

if old in content:
    content = content.replace(old, new)
    with open('/app/main.py', 'w') as f:
        f.write(content)
    print('Fixed!')
else:
    print('Pattern not found')

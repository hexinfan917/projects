#!/usr/bin/env python3
# This script generates admin API code and appends it to main.py

code = r'''

# ============================================================
# 系统管理 - 管理员账号、角色、菜单管理
# ============================================================

@app.get("/api/v1/admin/admins")
async def admin_list_admins(
    page: int = 1,
    page_size: int = 20,
    keyword: str = "",
    db: AsyncSession = Depends(get_db)
):
    """管理员账号列表"""
    from app.models.admin_user import AdminUser
    from app.models.admin_role import AdminRole
    
    query = select(AdminUser)
    if keyword:
        query = query.where(
            (AdminUser.username.contains(keyword)) |
            (AdminUser.real_name.contains(keyword)) |
            (AdminUser.phone.contains(keyword))
        )
    
    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar()
    
    result = await db.execute(query.offset((page - 1) * page_size).limit(page_size))
    admins = result.scalars().all()
    
    data = []
    for admin in admins:
        role_name = None
        if admin.role:
            role_name = admin.role.name
        data.append({
            "id": admin.id,
            "username": admin.username,
            "real_name": admin.real_name,
            "phone": admin.phone,
            "email": admin.email,
            "avatar": admin.avatar,
            "role_id": admin.role_id,
            "role_name": role_name,
            "status": admin.status,
            "last_login_at": admin.last_login_at.isoformat() if admin.last_login_at else None,
            "created_at": admin.created_at.isoformat() if admin.created_at else None,
        })
    
    return success({"list": data, "total": total, "page": page, "page_size": page_size})


@app.get("/api/v1/admin/admins/{admin_id}")
async def admin_get_admin(admin_id: int, db: AsyncSession = Depends(get_db)):
    """管理员详情"""
    from app.models.admin_user import AdminUser
    result = await db.execute(select(AdminUser).where(AdminUser.id == admin_id))
    admin = result.scalar_one_or_none()
    if not admin:
        return {"code": 404, "message": "管理员不存在", "data": None}
    role_name = admin.role.name if admin.role else None
    return success({
        "id": admin.id, "username": admin.username, "real_name": admin.real_name,
        "phone": admin.phone, "email": admin.email, "avatar": admin.avatar,
        "role_id": admin.role_id, "role_name": role_name, "status": admin.status,
        "last_login_at": admin.last_login_at.isoformat() if admin.last_login_at else None,
        "created_at": admin.created_at.isoformat() if admin.created_at else None,
    })


@app.post("/api/v1/admin/admins")
async def admin_create_admin(data: dict, db: AsyncSession = Depends(get_db)):
    """创建管理员账号"""
    import bcrypt
    from app.models.admin_user import AdminUser
    username = data.get("username", "").strip()
    if not username:
        return {"code": 400, "message": "用户名不能为空", "data": None}
    result = await db.execute(select(AdminUser).where(AdminUser.username == username))
    if result.scalar_one_or_none():
        return {"code": 400, "message": "用户名已存在", "data": None}
    password = data.get("password", "")
    if len(password) < 6:
        return {"code": 400, "message": "密码不能少于6位", "data": None}
    hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    admin = AdminUser(
        username=username, password=hashed, real_name=data.get("real_name"),
        phone=data.get("phone"), email=data.get("email"), avatar=data.get("avatar"),
        role_id=data.get("role_id"), status=data.get("status", 1),
    )
    db.add(admin)
    await db.flush()
    await db.commit()
    return success({"id": admin.id}, message="创建成功")


@app.put("/api/v1/admin/admins/{admin_id}")
async def admin_update_admin(admin_id: int, data: dict, db: AsyncSession = Depends(get_db)):
    """更新管理员账号"""
    import bcrypt
    from app.models.admin_user import AdminUser
    result = await db.execute(select(AdminUser).where(AdminUser.id == admin_id))
    admin = result.scalar_one_or_none()
    if not admin:
        return {"code": 404, "message": "管理员不存在", "data": None}
    new_username = data.get("username", "").strip()
    if new_username and new_username != admin.username:
        check = await db.execute(select(AdminUser).where(AdminUser.username == new_username))
        if check.scalar_one_or_none():
            return {"code": 400, "message": "用户名已存在", "data": None}
        admin.username = new_username
    for field in ["real_name", "phone", "email", "avatar", "role_id", "status"]:
        if field in data:
            setattr(admin, field, data[field])
    password = data.get("password")
    if password and len(password) >= 6:
        admin.password = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    await db.commit()
    return success({"id": admin.id}, message="更新成功")


@app.delete("/api/v1/admin/admins/{admin_id}")
async def admin_delete_admin(admin_id: int, db: AsyncSession = Depends(get_db)):
    """删除/禁用管理员账号"""
    from app.models.admin_user import AdminUser
    result = await db.execute(select(AdminUser).where(AdminUser.id == admin_id))
    admin = result.scalar_one_or_none()
    if not admin:
        return {"code": 404, "message": "管理员不存在", "data": None}
    admin.status = 0
    await db.commit()
    return success(message="已禁用")


# ========== 角色管理 ==========

@app.get("/api/v1/admin/roles")
async def admin_list_roles(page: int = 1, page_size: int = 20, keyword: str = "", db: AsyncSession = Depends(get_db)):
    """角色列表"""
    from app.models.admin_role import AdminRole
    query = select(AdminRole)
    if keyword:
        query = query.where((AdminRole.name.contains(keyword)) | (AdminRole.code.contains(keyword)))
    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar()
    result = await db.execute(query.offset((page - 1) * page_size).limit(page_size))
    roles = result.scalars().all()
    data = []
    for role in roles:
        menu_ids = [m.id for m in role.menus] if role.menus else []
        data.append({
            "id": role.id, "name": role.name, "code": role.code,
            "description": role.description, "status": role.status,
            "menu_ids": menu_ids, "created_at": role.created_at.isoformat() if role.created_at else None,
        })
    return success({"list": data, "total": total, "page": page, "page_size": page_size})


@app.get("/api/v1/admin/roles/{role_id}")
async def admin_get_role(role_id: int, db: AsyncSession = Depends(get_db)):
    """角色详情"""
    from app.models.admin_role import AdminRole
    result = await db.execute(select(AdminRole).where(AdminRole.id == role_id))
    role = result.scalar_one_or_none()
    if not role:
        return {"code": 404, "message": "角色不存在", "data": None}
    menu_ids = [m.id for m in role.menus] if role.menus else []
    return success({
        "id": role.id, "name": role.name, "code": role.code,
        "description": role.description, "status": role.status,
        "menu_ids": menu_ids, "created_at": role.created_at.isoformat() if role.created_at else None,
    })


@app.post("/api/v1/admin/roles")
async def admin_create_role(data: dict, db: AsyncSession = Depends(get_db)):
    """创建角色"""
    from app.models.admin_role import AdminRole
    from app.models.admin_role_menu import AdminRoleMenu
    code = data.get("code", "").strip()
    name = data.get("name", "").strip()
    if not code or not name:
        return {"code": 400, "message": "角色编码和名称不能为空", "data": None}
    result = await db.execute(select(AdminRole).where(AdminRole.code == code))
    if result.scalar_one_or_none():
        return {"code": 400, "message": "角色编码已存在", "data": None}
    role = AdminRole(name=name, code=code, description=data.get("description"), status=data.get("status", 1))
    db.add(role)
    await db.flush()
    menu_ids = data.get("menu_ids", [])
    if menu_ids:
        for menu_id in menu_ids:
            db.add(AdminRoleMenu(role_id=role.id, menu_id=menu_id))
    await db.commit()
    return success({"id": role.id}, message="创建成功")


@app.put("/api/v1/admin/roles/{role_id}")
async def admin_update_role(role_id: int, data: dict, db: AsyncSession = Depends(get_db)):
    """更新角色"""
    from app.models.admin_role import AdminRole
    from app.models.admin_role_menu import AdminRoleMenu
    result = await db.execute(select(AdminRole).where(AdminRole.id == role_id))
    role = result.scalar_one_or_none()
    if not role:
        return {"code": 404, "message": "角色不存在", "data": None}
    for field in ["name", "description", "status"]:
        if field in data:
            setattr(role, field, data[field])
    if "menu_ids" in data:
        await db.execute(AdminRoleMenu.__table__.delete().where(AdminRoleMenu.role_id == role_id))
        for menu_id in data["menu_ids"]:
            db.add(AdminRoleMenu(role_id=role_id, menu_id=menu_id))
    await db.commit()
    return success({"id": role.id}, message="更新成功")


@app.delete("/api/v1/admin/roles/{role_id}")
async def admin_delete_role(role_id: int, db: AsyncSession = Depends(get_db)):
    """删除/禁用角色"""
    from app.models.admin_role import AdminRole
    result = await db.execute(select(AdminRole).where(AdminRole.id == role_id))
    role = result.scalar_one_or_none()
    if not role:
        return {"code": 404, "message": "角色不存在", "data": None}
    role.status = 0
    await db.commit()
    return success(message="已禁用")


# ========== 菜单管理 ==========

@app.get("/api/v1/admin/menus")
async def admin_list_menus(db: AsyncSession = Depends(get_db)):
    """菜单列表（平铺）"""
    from app.models.admin_menu import AdminMenu
    result = await db.execute(select(AdminMenu).where(AdminMenu.status == 1).order_by(AdminMenu.sort_order))
    menus = result.scalars().all()
    data = []
    for menu in menus:
        data.append({
            "id": menu.id, "parent_id": menu.parent_id, "name": menu.name,
            "path": menu.path, "icon": menu.icon, "sort_order": menu.sort_order,
            "type": menu.type, "permission": menu.permission, "status": menu.status,
            "created_at": menu.created_at.isoformat() if menu.created_at else None,
        })
    return success({"list": data})


@app.get("/api/v1/admin/menus/tree")
async def admin_menu_tree(db: AsyncSession = Depends(get_db)):
    """菜单树"""
    from app.models.admin_menu import AdminMenu
    result = await db.execute(select(AdminMenu).where(AdminMenu.status == 1).order_by(AdminMenu.sort_order))
    menus = result.scalars().all()
    menu_map = {}
    for menu in menus:
        menu_map[menu.id] = {
            "id": menu.id, "parent_id": menu.parent_id, "name": menu.name,
            "path": menu.path, "icon": menu.icon, "sort_order": menu.sort_order,
            "type": menu.type, "permission": menu.permission, "status": menu.status,
            "children": [],
        }
    tree = []
    for item in menu_map.values():
        if item["parent_id"] == 0:
            tree.append(item)
        else:
            parent = menu_map.get(item["parent_id"])
            if parent:
                parent["children"].append(item)
    return success(tree)


@app.post("/api/v1/admin/menus")
async def admin_create_menu(data: dict, db: AsyncSession = Depends(get_db)):
    """创建菜单"""
    from app.models.admin_menu import AdminMenu
    menu = AdminMenu(
        parent_id=data.get("parent_id", 0), name=data.get("name"), path=data.get("path"),
        icon=data.get("icon"), sort_order=data.get("sort_order", 0), type=data.get("type", 2),
        permission=data.get("permission"), status=data.get("status", 1),
    )
    db.add(menu)
    await db.flush()
    await db.commit()
    return success({"id": menu.id}, message="创建成功")


@app.put("/api/v1/admin/menus/{menu_id}")
async def admin_update_menu(menu_id: int, data: dict, db: AsyncSession = Depends(get_db)):
    """更新菜单"""
    from app.models.admin_menu import AdminMenu
    result = await db.execute(select(AdminMenu).where(AdminMenu.id == menu_id))
    menu = result.scalar_one_or_none()
    if not menu:
        return {"code": 404, "message": "菜单不存在", "data": None}
    for field in ["parent_id", "name", "path", "icon", "sort_order", "type", "permission", "status"]:
        if field in data:
            setattr(menu, field, data[field])
    await db.commit()
    return success({"id": menu.id}, message="更新成功")


@app.delete("/api/v1/admin/menus/{menu_id}")
async def admin_delete_menu(menu_id: int, db: AsyncSession = Depends(get_db)):
    """删除/禁用菜单"""
    from app.models.admin_menu import AdminMenu
    result = await db.execute(select(AdminMenu).where(AdminMenu.id == menu_id))
    menu = result.scalar_one_or_none()
    if not menu:
        return {"code": 404, "message": "菜单不存在", "data": None}
    menu.status = 0
    await db.commit()
    return success(message="已禁用")


# ========== 当前用户信息 ==========

@app.get("/api/v1/admin/me")
async def admin_me(current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """获取当前管理员信息"""
    from app.models.admin_user import AdminUser
    user_id = current_user.get("user_id")
    if not user_id or user_id == 0:
        return {"code": 404, "message": "未登录", "data": None}
    result = await db.execute(select(AdminUser).where(AdminUser.id == user_id))
    admin = result.scalar_one_or_none()
    if not admin:
        return {"code": 404, "message": "管理员不存在", "data": None}
    role_name = admin.role.name if admin.role else None
    return success({
        "id": admin.id, "username": admin.username, "real_name": admin.real_name,
        "phone": admin.phone, "email": admin.email, "avatar": admin.avatar,
        "role_id": admin.role_id, "role_name": role_name, "status": admin.status,
    })


@app.get("/api/v1/admin/my-menus")
async def admin_my_menus(current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """获取当前用户的菜单"""
    from app.models.admin_user import AdminUser
    from app.models.admin_menu import AdminMenu
    from app.models.admin_role_menu import AdminRoleMenu
    user_id = current_user.get("user_id", 0)
    result = await db.execute(select(AdminUser).where(AdminUser.id == user_id))
    admin = result.scalar_one_or_none()
    if not admin or not admin.role_id:
        return success([])
    result = await db.execute(
        select(AdminMenu)
        .join(AdminRoleMenu, AdminMenu.id == AdminRoleMenu.menu_id)
        .where(AdminRoleMenu.role_id == admin.role_id, AdminMenu.status == 1)
        .order_by(AdminMenu.sort_order)
    )
    menus = result.scalars().all()
    menu_map = {}
    for menu in menus:
        menu_map[menu.id] = {
            "id": menu.id, "parent_id": menu.parent_id, "name": menu.name,
            "path": menu.path, "icon": menu.icon, "sort_order": menu.sort_order,
            "type": menu.type, "permission": menu.permission, "status": menu.status,
            "children": [],
        }
    tree = []
    for item in menu_map.values():
        if item["parent_id"] == 0:
            tree.append(item)
        else:
            parent = menu_map.get(item["parent_id"])
            if parent:
                parent["children"].append(item)
    return success(tree)
'''

with open('/opt/petway/backend/user-service/main.py', 'a', encoding='utf-8') as f:
    f.write(code)

print('Done')

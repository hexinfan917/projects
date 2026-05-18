with open('/opt/petway/backend/user-service/main.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix admin_my_menus - remove import of AdminRoleMenu class, use table directly
old_my_menus = '''    from app.models.admin_user import AdminUser
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
    )'''

new_my_menus = '''    from app.models.admin_user import AdminUser
    from app.models.admin_menu import AdminMenu
    from app.models.admin_role import admin_role_menus
    
    user_id = current_user.get("user_id", 0)
    
    result = await db.execute(select(AdminUser).where(AdminUser.id == user_id))
    admin = result.scalar_one_or_none()
    if not admin or not admin.role_id:
        return success([])
    
    result = await db.execute(
        select(AdminMenu)
        .join(admin_role_menus, AdminMenu.id == admin_role_menus.c.menu_id)
        .where(admin_role_menus.c.role_id == admin.role_id, AdminMenu.status == 1)
        .order_by(AdminMenu.sort_order)
    )'''

content = content.replace(old_my_menus, new_my_menus)

# Also fix admin_create_role and admin_update_role if they import AdminRoleMenu
content = content.replace('from app.models.admin_role_menu import AdminRoleMenu', 'from app.models.admin_role import admin_role_menus')

# Fix references to AdminRoleMenu in create_role
content = content.replace('db.add(AdminRoleMenu(role_id=role.id, menu_id=menu_id))', 'db.add(admin_role_menus.insert().values(role_id=role.id, menu_id=menu_id))')

# Fix references in update_role
old_delete = 'await db.execute(\n            AdminRoleMenu.__table__.delete().where(AdminRoleMenu.role_id == role_id)\n        )'
new_delete = 'await db.execute(\n            admin_role_menus.delete().where(admin_role_menus.c.role_id == role_id)\n        )'
content = content.replace(old_delete, new_delete)

content = content.replace('db.add(AdminRoleMenu(role_id=role_id, menu_id=menu_id))', 'await db.execute(admin_role_menus.insert().values(role_id=role_id, menu_id=menu_id))')

with open('/opt/petway/backend/user-service/main.py', 'w', encoding='utf-8') as f:
    f.write(content)

# Remove the old admin_role_menu.py file
import os
os.remove('/opt/petway/backend/user-service/app/models/admin_role_menu.py')

print('Fixed admin API imports')

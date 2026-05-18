with open('/opt/petway/frontend/admin/.umirc.ts', 'r', encoding='utf-8') as f:
    content = f.read()

old = "    { name: '优惠券管理', path: '/coupons', component: './Coupons/List' },"
new = """    { name: '优惠券管理', path: '/coupons', component: './Coupons/List' },
    { name: '系统管理', path: '/system', routes: [
      { name: '账号管理', path: '/system/admins', component: './System/AdminList' },
      { name: '角色管理', path: '/system/roles', component: './System/RoleList' },
      { name: '菜单管理', path: '/system/menus', component: './System/MenuList' },
    ] },"""

content = content.replace(old, new)

with open('/opt/petway/frontend/admin/.umirc.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print('Routes updated')

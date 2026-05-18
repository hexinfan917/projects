with open('/opt/petway/frontend/admin/src/app.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Change routes to children in menu.transformMenu
content = content.replace(
    'routes: item.children && item.children.length > 0 ? transformMenu(item.children) : undefined,',
    'children: item.children && item.children.length > 0 ? transformMenu(item.children) : undefined,'
)

with open('/opt/petway/frontend/admin/src/app.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('Fixed menu transform: routes -> children')

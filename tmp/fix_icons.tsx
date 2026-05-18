with open('/opt/petway/frontend/admin/src/app.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Add icon import after existing imports
old_import = "import { LogoutOutlined, UserOutlined } from '@ant-design/icons';"
new_import = "import { LogoutOutlined, UserOutlined } from '@ant-design/icons';\nimport * as Icons from '@ant-design/icons';"
content = content.replace(old_import, new_import)

# Add Icon wrapper component before getInitialState
old_initial = '// 全局初始化数据配置'
new_initial = '''// 图标组件包装器
const MenuIcon = ({ name }: { name?: string }) => {
  if (!name) return null;
  const IconComponent = (Icons as any)[name];
  return IconComponent ? <IconComponent /> : null;
};

// 全局初始化数据配置'''
content = content.replace(old_initial, new_initial)

# Fix transformMenu to use MenuIcon
old_transform = '''            const transformMenu = (menus: any[]): any[] => {
              return menus.map((item) => ({
                name: item.name,
                path: item.path,
                icon: item.icon || undefined,
                children: item.children && item.children.length > 0 ? transformMenu(item.children) : undefined,
              }));
            };'''

new_transform = '''            const transformMenu = (menus: any[]): any[] => {
              return menus.map((item) => ({
                name: item.name,
                path: item.path,
                icon: item.icon ? <MenuIcon name={item.icon} /> : undefined,
                children: item.children && item.children.length > 0 ? transformMenu(item.children) : undefined,
              }));
            };'''
content = content.replace(old_transform, new_transform)

with open('/opt/petway/frontend/admin/src/app.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('Fixed icons in app.tsx')

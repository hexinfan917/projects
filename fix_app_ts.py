with open('/opt/petway/frontend/admin/src/app.ts', 'r') as f:
    content = f.read()

# Replace onPageChange with delayed redirect using setTimeout
old = '''    onPageChange: () => {
      const { location } = history;
      const token = localStorage.getItem('token');
      // 未登录且不在登录页，重定向到登录页
      if (!token && location.pathname !== '/login') {
        history.push('/login');
      }
    },'''

new = '''    onPageChange: () => {
      const { location } = history;
      const token = localStorage.getItem('token');
      // 未登录且不在登录页，重定向到登录页
      if (!token && location.pathname !== '/login') {
        setTimeout(() => {
          history.push('/login');
        }, 100);
      }
    },'''

content = content.replace(old, new)

with open('/opt/petway/frontend/admin/src/app.ts', 'w') as f:
    f.write(content)

print('app.ts updated')

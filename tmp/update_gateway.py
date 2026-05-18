with open('/opt/petway/backend/gateway/main.py', 'r', encoding='utf-8') as f:
    content = f.read()

old = '''    "/api/v1/admin/users": "http://user-service:8000",
    "/api/v1/admin/pets": "http://user-service:8000",'''

new = '''    "/api/v1/admin/users": "http://user-service:8000",
    "/api/v1/admin/admins": "http://user-service:8000",
    "/api/v1/admin/roles": "http://user-service:8000",
    "/api/v1/admin/menus": "http://user-service:8000",
    "/api/v1/admin/me": "http://user-service:8000",
    "/api/v1/admin/my-menus": "http://user-service:8000",
    "/api/v1/admin/pets": "http://user-service:8000",'''

content = content.replace(old, new)

with open('/opt/petway/backend/gateway/main.py', 'w', encoding='utf-8') as f:
    f.write(content)

print('Gateway routes updated')

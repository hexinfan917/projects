with open('/opt/petway/backend/common/database.py', 'r', encoding='utf-8') as f:
    content = f.read()
content = content.replace('connect_args={"charset": "utf8mb4"},', '')
with open('/opt/petway/backend/common/database.py', 'w', encoding='utf-8') as f:
    f.write(content)
print('Restored database.py')

with open('/app/app/services/pet.py', 'r') as f:
    content = f.read()

# Fix update_pet method
old = '''        # 删除不需要的字段
        update_data.pop(breed_type, None)
        
        # 确保可选字段有默认值，避免数据库 NOT NULL 报错
        for field in [breed, avatar, health_notes]:
            if data.get(field) is None:
                data[field] = '''

new = '''        # 删除不需要的字段
        update_data.pop('breed_type', None)
        
        # 确保可选字段有默认值，避免数据库 NOT NULL 报错
        for field in ['breed', 'avatar', 'health_notes']:
            if update_data.get(field) is None:
                update_data[field] = '' '''

if old in content:
    content = content.replace(old, new)
    with open('/app/app/services/pet.py', 'w') as f:
        f.write(content)
    print('Fixed update_pet!')
else:
    print('Pattern not found')

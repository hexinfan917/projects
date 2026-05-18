with open('/app/app/services/pet.py', 'r') as f:
    content = f.read()

old = '''        # 删除不需要的字段
        data.pop(breed_type, None)
        
        # 确保可选字段有默认值，避免数据库 NOT NULL 报错
        for field in [breed, avatar, health_notes]:
            if data.get(field) is None:
                data[field] = '''

new = '''        # 删除不需要的字段
        data.pop('breed_type', None)
        
        # 确保可选字段有默认值，避免数据库 NOT NULL 报错
        for field in ['breed', 'avatar', 'health_notes']:
            if data.get(field) is None:
                data[field] = '' '''

if old in content:
    content = content.replace(old, new)
    with open('/app/app/services/pet.py', 'w') as f:
        f.write(content)
    print('Fixed!')
else:
    print('Pattern not found, checking...')
    # Try to find and print the relevant section
    idx = content.find('删除不需要的字段')
    if idx >= 0:
        print(repr(content[idx-20:idx+200]))

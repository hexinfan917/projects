with open('/app/app/services/pet.py', 'r') as f:
    lines = f.readlines()

new_lines = []
for i, line in enumerate(lines):
    new_lines.append(line)
    if "data.pop('breed_type', None)" in line:
        new_lines.append('\n')
        new_lines.append('        # 将 None 的可选字段替换为空字符串，避免数据库 NOT NULL 报错\n')
        new_lines.append("        for field in ['breed', 'avatar', 'health_notes']:\n")
        new_lines.append("            if data.get(field) is None:\n")
        new_lines.append("                data[field] = ''\n")

with open('/app/app/services/pet.py', 'w') as f:
    f.writelines(new_lines)

print('Done')

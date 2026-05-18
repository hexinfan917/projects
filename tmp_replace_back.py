import os
import re

base_dir = "frontend/miniapp/src/pages"
return_icon = "/assets/icons/return.png"
arrow = '\u2190'

files_to_modify = []
for root, dirs, files in os.walk(base_dir):
    for f in files:
        if f.endswith('.tsx'):
            path = os.path.join(root, f)
            with open(path, 'r', encoding='utf-8') as file:
                content = file.read()
            marker1 = "page-back-icon">" + arrow + "<"
            marker2 = "detail-back-icon">" + arrow + "<"
            if marker1 in content or marker2 in content:
                files_to_modify.append(path)

print(f"找到 {len(files_to_modify)} 个需要修改的文件:")
for f in files_to_modify:
    print(f"  {f}")

for path in files_to_modify:
    with open(path, 'r', encoding='utf-8') as file:
        content = file.read()
    
    original = content
    
    content = content.replace(
        "<Text className='page-back-icon'>" + arrow + "</Text>",
        "<Image className='page-back-icon' src='" + return_icon + "' mode='aspectFit' />"
    )
    content = content.replace(
        "<Text className='detail-back-icon'>" + arrow + "</Text>",
        "<Image className='detail-back-icon' src='" + return_icon + "' mode='aspectFit' />"
    )
    
    if 'Image' not in content and "from '@tarojs/components'" in content:
        content = re.sub(
            r"(import\s*\{[^}]*)(\}\s*from\s*['\"]@tarojs/components['\"])",
            lambda m: f"{m.group(1).rstrip()}, Image{m.group(2)}" if 'Image' not in m.group(1) else m.group(0),
            content
        )
    
    if content != original:
        with open(path, 'w', encoding='utf-8') as file:
            file.write(content)
        print(f"已修改: {os.path.relpath(path)}")
    else:
        print(f"未修改: {os.path.relpath(path)}")

print("\n完成!")

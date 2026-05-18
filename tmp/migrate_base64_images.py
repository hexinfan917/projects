import re
import pymysql
import requests
import json

# Connect to database
conn = pymysql.connect(
    host='101.43.50.236',
    user='root',
    password='Petway123',
    database='petway',
    port=3306
)
cursor = conn.cursor()

# Get route 8 content
cursor.execute('SELECT id, highlights_detail, fee_description, notice FROM routes WHERE id=8')
row = cursor.fetchone()
if not row:
    print("Route 8 not found")
    exit(1)

route_id = row[0]
fields = {
    'highlights_detail': row[1] or '',
    'fee_description': row[2] or '',
    'notice': row[3] or '',
}

print(f"Processing route {route_id}")

# Pattern to find base64 images
pattern = re.compile(r'data:image/[^;]+;base64,[^"\'\s>]+')

updated_fields = {}
for field_name, content in fields.items():
    if not content:
        continue
    matches = pattern.findall(content)
    print(f"{field_name}: {len(matches)} base64 images found")
    
    if not matches:
        continue
    
    new_content = content
    for i, base64_str in enumerate(matches):
        # Upload to file service
        try:
            resp = requests.post(
                'http://101.43.50.236:8000/api/v1/files/upload/base64',
                json={'base64': base64_str},
                timeout=30
            )
            if resp.status_code == 200:
                result = resp.json()
                if result.get('code') == 200:
                    file_url = result['data']['url']
                    print(f"  Uploaded image {i+1} -> {file_url}")
                    new_content = new_content.replace(base64_str, file_url, 1)
                else:
                    print(f"  Failed to upload image {i+1}: {result}")
            else:
                print(f"  Failed to upload image {i+1}: HTTP {resp.status_code}")
        except Exception as e:
            print(f"  Error uploading image {i+1}: {e}")
    
    updated_fields[field_name] = new_content

# Update database
for field_name, new_content in updated_fields.items():
    if new_content != fields[field_name]:
        cursor.execute(f"UPDATE routes SET {field_name} = %s WHERE id = %s", (new_content, route_id))
        print(f"Updated {field_name}")

conn.commit()
cursor.close()
conn.close()
print("Migration completed!")

import pymysql

conn = pymysql.connect(host='localhost', port=3306, user='root', password='root', database='petway', charset='utf8mb4')
cursor = conn.cursor()
try:
    cursor.execute("ALTER TABLE orders ADD COLUMN pets JSON NULL COMMENT '宠物信息' AFTER participants;")
    conn.commit()
    print('Column added successfully')
except pymysql.err.OperationalError as e:
    if 'Duplicate column name' in str(e):
        print('Column already exists')
    else:
        print(f'Error: {e}')
finally:
    cursor.close()
    conn.close()

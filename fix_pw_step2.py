import sys
hash_val = sys.stdin.read().strip()
print(f"Hash received: {hash_val[:20]}...")

import pymysql
conn = pymysql.connect(host='mysql', user='root', password='Petway123', database='petway')
cur = conn.cursor()
cur.execute("UPDATE admin_users SET password = %s WHERE username = 'admin'", (hash_val,))
conn.commit()
print("Updated rows:", cur.rowcount)
cur.close()
conn.close()

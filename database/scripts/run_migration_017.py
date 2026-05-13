"""
执行迁移脚本 017_coupon_member_popup.sql
"""
import pymysql
import os

DB_CONFIG = {
    'host': 'localhost',
    'port': 3306,
    'user': 'root',
    'password': 'root',
    'database': 'petway',
    'charset': 'utf8mb4',
}

MIGRATION_FILE = os.path.join(os.path.dirname(__file__), '..', 'migrations', '017_coupon_member_popup.sql')

def run_migration():
    conn = pymysql.connect(**DB_CONFIG)
    cursor = conn.cursor()
    
    with open(MIGRATION_FILE, 'r', encoding='utf-8') as f:
        sql = f.read()
    
    statements = [s.strip() for s in sql.split(';') if s.strip()]
    for statement in statements:
        try:
            cursor.execute(statement)
            print(f"OK: {statement[:60]}...")
        except Exception as e:
            print(f"SKIP/ERROR: {e}")
            print(f"  Statement: {statement[:100]}...")
    
    conn.commit()
    cursor.close()
    conn.close()
    print("Migration 017 completed.")

if __name__ == '__main__':
    run_migration()

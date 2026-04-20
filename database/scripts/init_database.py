"""
数据库初始化脚本
用于创建数据库和表结构
"""
import os
import sys
import mysql.connector
from mysql.connector import Error

# 数据库配置
DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'port': int(os.getenv('DB_PORT', 3306)),
    'user': os.getenv('DB_USER', 'root'),
    'password': os.getenv('DB_PASSWORD', ''),
    'database': os.getenv('DB_NAME', 'quandouxing'),
}

MIGRATIONS_DIR = os.path.join(os.path.dirname(__file__), '..', 'migrations')


def create_database():
    """创建数据库"""
    config = DB_CONFIG.copy()
    database = config.pop('database')
    
    try:
        conn = mysql.connector.connect(**config)
        cursor = conn.cursor()
        
        cursor.execute(f"CREATE DATABASE IF NOT EXISTS {database} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
        print(f"Database '{database}' created or already exists.")
        
        cursor.close()
        conn.close()
        return True
    except Error as e:
        print(f"Error creating database: {e}")
        return False


def execute_migrations():
    """执行迁移脚本"""
    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        # 获取所有迁移文件
        migration_files = sorted([f for f in os.listdir(MIGRATIONS_DIR) if f.endswith('.sql')])
        
        for migration_file in migration_files:
            print(f"Executing migration: {migration_file}")
            
            with open(os.path.join(MIGRATIONS_DIR, migration_file), 'r', encoding='utf-8') as f:
                sql = f.read()
            
            # 分割SQL语句并执行
            statements = sql.split(';')
            for statement in statements:
                statement = statement.strip()
                if statement:
                    try:
                        cursor.execute(statement)
                    except Error as e:
                        print(f"Error executing statement: {e}")
                        print(f"Statement: {statement[:100]}...")
            
            conn.commit()
            print(f"Migration {migration_file} completed.")
        
        cursor.close()
        conn.close()
        print("All migrations executed successfully.")
        return True
    except Error as e:
        print(f"Error executing migrations: {e}")
        return False


def init_data():
    """初始化基础数据"""
    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        # 插入示例路线数据
        sample_routes = [
            ('R2024001', '海滨漫步一日游', 2, '带着爱宠一起感受海风与阳光', '半日', 199.00, 1),
            ('R2024002', '山野探险周末行', 1, '深入山林，与爱宠共享自然', '2日', 399.00, 1),
            ('R2024003', '星空露营体验', 3, '在星空下与爱宠共度美好夜晚', '1日', 299.00, 1),
        ]
        
        insert_sql = """
            INSERT IGNORE INTO routes (route_no, name, route_type, description, duration, base_price, status)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """
        
        cursor.executemany(insert_sql, sample_routes)
        conn.commit()
        
        print(f"Inserted {cursor.rowcount} sample routes.")
        
        cursor.close()
        conn.close()
        return True
    except Error as e:
        print(f"Error initializing data: {e}")
        return False


def main():
    """主函数"""
    print("=" * 50)
    print("Database Initialization Script")
    print("=" * 50)
    
    # 创建数据库
    if not create_database():
        sys.exit(1)
    
    # 执行迁移
    if not execute_migrations():
        sys.exit(1)
    
    # 初始化数据
    if not init_data():
        sys.exit(1)
    
    print("=" * 50)
    print("Database initialization completed successfully!")
    print("=" * 50)


if __name__ == '__main__':
    main()

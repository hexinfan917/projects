import sys
sys.path.insert(0, 'D:/projects/backend')

from common.database import engine
from sqlalchemy import text

def update_db():
    with engine.connect() as conn:
        # 示例: 更新数据库结构
        conn.execute(text("UPDATE routes SET status = 1 WHERE status IS NULL"))
        conn.commit()
        print("数据库更新完成")

if __name__ == "__main__":
    update_db()

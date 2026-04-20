import sys
sys.path.insert(0, 'D:/projects/backend')

from common.database import engine
from sqlalchemy import text

def add_subtitle_column():
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE routes ADD COLUMN subtitle VARCHAR(200) AFTER name"))
        conn.commit()
        print("✅ subtitle 列添加成功")

if __name__ == "__main__":
    add_subtitle_column()

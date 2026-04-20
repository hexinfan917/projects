import sys
sys.path.insert(0, 'D:/projects/backend')

from sqlalchemy import create_engine, text
from common.config import settings

engine = create_engine(settings.database_url)

def check_tables():
    with engine.connect() as conn:
        result = conn.execute(text("SHOW TABLES"))
        tables = [row[0] for row in result]
        print("数据库中的表:")
        for t in tables:
            print(f"  - {t}")

if __name__ == "__main__":
    check_tables()

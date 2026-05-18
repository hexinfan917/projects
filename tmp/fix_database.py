with open('/opt/petway/backend/common/database.py', 'r', encoding='utf-8') as f:
    content = f.read()

old_engine = '''engine = create_async_engine(
    settings.database.sqlalchemy_url,
    echo=settings.debug,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
)'''

new_engine = '''engine = create_async_engine(
    settings.database.sqlalchemy_url,
    echo=settings.debug,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
    connect_args={"charset": "utf8mb4"},
)'''

content = content.replace(old_engine, new_engine)

with open('/opt/petway/backend/common/database.py', 'w', encoding='utf-8') as f:
    f.write(content)

print('Database config fixed')

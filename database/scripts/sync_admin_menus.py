"""
同步后台菜单数据
根据 frontend/admin/.umirc.ts 中的 routes 配置，自动生成并同步 admin_menus 表

用法：
    python database/scripts/sync_admin_menus.py

运行后会：
1. 清空 admin_menus 表
2. 根据 .umirc.ts 生成新的菜单数据
3. 更新 database/migrations/024_seed_admin_data.sql
4. 同步到当前数据库
"""
import asyncio
import os
import re
import sys

# 自动定位项目根目录
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, '..', '..'))
sys.path.insert(0, os.path.join(PROJECT_ROOT, 'backend'))
sys.path.insert(0, os.path.join(PROJECT_ROOT, 'backend/user-service'))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text
from common.config import settings


def parse_routes(content: str):
    """从 .umirc.ts 中解析 routes 数组"""
    match = re.search(r'routes:\s*\[(.*)\n\s*\],', content, re.DOTALL)
    if not match:
        raise ValueError('routes not found in .umirc.ts')
    routes_str = match.group(1)

    items = []
    stack = []
    next_id = 1
    root_sort = 0

    lines = routes_str.split('\n')
    i = 0
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        if not stripped or stripped.startswith('//') or stripped.startswith('/*'):
            i += 1
            continue

        if stripped == '{':
            indent = len(line) - len(line.lstrip())
            while stack and stack[-1]['indent'] >= indent:
                stack.pop()
            parent = stack[-1] if stack else None
            obj = {
                'indent': indent,
                'id': next_id,
                'parent_id': parent['id'] if parent else 0,
                'sort': 0,
                'data': {},
            }
            next_id += 1
            stack.append(obj)
            i += 1
            continue

        if stripped in ('},', '}'):
            if len(stack) > 0:
                obj = stack.pop()
                data = obj['data']
                name = data.get('name')
                path = data.get('path')
                # 跳过 redirect、hideInMenu、不带 layout 的登录页
                if name and path and not data.get('hideInMenu') and data.get('layout') is not False:
                    menu_type = 1 if data.get('has_routes') else 2
                    parent = stack[-1] if stack else None
                    if parent:
                        parent['sort'] += 1
                        sort_order = parent['sort']
                    else:
                        root_sort += 1
                        sort_order = root_sort
                    items.append({
                        'id': obj['id'],
                        'parent_id': obj['parent_id'],
                        'name': name,
                        'path': path,
                        'type': menu_type,
                        'sort_order': sort_order,
                    })
            i += 1
            continue

        m = re.match(r"(name|path|hideInMenu|layout):\s*('[^']*'|\"[^\"]*\"|true|false|[\w/:@.-]+)", stripped)
        if m:
            key = m.group(1)
            val = m.group(2).strip().strip("'\"")
            if val == 'true':
                val = True
            elif val == 'false':
                val = False
            if stack:
                stack[-1]['data'][key] = val
            i += 1
            continue

        if re.match(r"routes:\s*\[", stripped):
            if stack:
                stack[-1]['data']['has_routes'] = True
            i += 1
            continue

        i += 1

    return items


def generate_seed_sql(menus):
    """生成 seed SQL"""
    lines = [
        "-- 初始化后台菜单和角色数据",
        "SET NAMES utf8mb4;",
        "",
        "-- 插入超级管理员角色",
        "INSERT INTO admin_roles (id, name, code, description, status) VALUES",
        "(1, '超级管理员', 'super_admin', '拥有所有权限', 1)",
        "ON DUPLICATE KEY UPDATE status = 1;",
        "",
        "-- 插入菜单数据",
        "DELETE FROM admin_role_menus;",
        "DELETE FROM admin_menus;",
        "",
        "INSERT INTO admin_menus (id, parent_id, name, path, icon, sort_order, type, permission, status) VALUES",
    ]
    values = []
    for m in menus:
        values.append(
            f"({m['id']}, {m['parent_id']}, '{m['name']}', '{m['path']}', NULL, {m['sort_order']}, {m['type']}, NULL, 1)"
        )
    lines.append(",\n".join(values) + ";")
    lines.append("")
    lines.append("-- 超级管理员关联所有菜单")
    lines.append("INSERT INTO admin_role_menus (role_id, menu_id)")
    lines.append("SELECT 1, id FROM admin_menus;")
    return "\n".join(lines)


async def sync_to_database(menus):
    """同步到数据库"""
    engine = create_async_engine(settings.database.sqlalchemy_url)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    try:
        async with async_session() as db:
            await db.execute(text("DELETE FROM admin_menus"))
            await db.execute(text("ALTER TABLE admin_menus AUTO_INCREMENT = 1"))

            for m in menus:
                await db.execute(
                    text("""
                        INSERT INTO admin_menus (id, parent_id, name, path, type, sort_order, status)
                        VALUES (:id, :parent_id, :name, :path, :type, :sort_order, 1)
                    """),
                    {
                        'id': m['id'],
                        'parent_id': m['parent_id'],
                        'name': m['name'],
                        'path': m['path'],
                        'type': m['type'],
                        'sort_order': m['sort_order'],
                    }
                )
            await db.commit()
    finally:
        await engine.dispose()


async def main():
    umirc_path = os.path.join(PROJECT_ROOT, 'frontend/admin/.umirc.ts')
    seed_path = os.path.join(PROJECT_ROOT, 'database/migrations/024_seed_admin_data.sql')

    print(f'Reading routes from {umirc_path}')
    with open(umirc_path, 'r', encoding='utf-8') as f:
        content = f.read()

    menus = parse_routes(content)
    print(f'Parsed {len(menus)} menus from .umirc.ts')

    # 生成 seed SQL
    sql = generate_seed_sql(menus)
    with open(seed_path, 'w', encoding='utf-8') as f:
        f.write(sql)
    print(f'Updated {seed_path}')

    # 同步到数据库
    await sync_to_database(menus)
    print(f'Synced {len(menus)} menus to database')


if __name__ == '__main__':
    asyncio.run(main())

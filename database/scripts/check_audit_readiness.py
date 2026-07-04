#!/usr/bin/env python3
"""
小程序代码审核前置数据检查工具

用法：
  方式1 - 环境变量（推荐，避免密码入命令行历史）
    export DB_HOST=101.43.50.236
    export DB_PORT=3306
    export DB_USER=petway
    export DB_PASSWORD=Petway123
    export DB_NAME=petway
    python database/scripts/check_audit_readiness.py

  方式2 - 命令行参数
    python database/scripts/check_audit_readiness.py \
        --host 101.43.50.236 --user petway --password Petway123 --database petway
"""

import argparse
import os
import sys
from pathlib import Path

import pymysql
from pymysql.cursors import DictCursor


def get_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="检查小程序审核所需关键数据")
    parser.add_argument("--host", default=os.getenv("DB_HOST", "localhost"), help="数据库主机")
    parser.add_argument("--port", type=int, default=int(os.getenv("DB_PORT", "3306")), help="数据库端口")
    parser.add_argument("--user", default=os.getenv("DB_USER", "petway"), help="数据库用户")
    parser.add_argument("--password", default=os.getenv("DB_PASSWORD", ""), help="数据库密码")
    parser.add_argument("--database", default=os.getenv("DB_NAME", "petway"), help="数据库名")
    return parser


def load_sql() -> str:
    script_path = Path(__file__).with_suffix(".sql")
    if not script_path.exists():
        print(f"错误：找不到 SQL 文件 {script_path}")
        sys.exit(1)
    return script_path.read_text(encoding="utf-8")


def main():
    parser = get_arg_parser()
    args = parser.parse_args()

    if not args.password:
        print("错误：未提供数据库密码。请通过 --password 参数或 DB_PASSWORD 环境变量传入。")
        sys.exit(1)

    print(f"正在连接数据库 {args.host}:{args.port}/{args.database} ...\n")

    try:
        conn = pymysql.connect(
            host=args.host,
            port=args.port,
            user=args.user,
            password=args.password,
            database=args.database,
            charset="utf8mb4",
            cursorclass=DictCursor,
        )
    except Exception as e:
        print(f"数据库连接失败：{e}")
        sys.exit(1)

    sql = load_sql()
    # 按分号拆分并逐条执行，便于输出可读
    statements = [s.strip() for s in sql.split(";") if s.strip()]

    try:
        with conn.cursor() as cursor:
            for stmt in statements:
                # 跳过纯注释行和空结果集的 SET 类语句
                first_line = stmt.splitlines()[0].strip()
                if first_line.startswith("--") or first_line.upper().startswith("SET"):
                    continue

                try:
                    cursor.execute(stmt)
                except Exception as e:
                    print(f"执行 SQL 出错：{e}\nSQL: {stmt[:200]}...")
                    continue

                # 只打印有结果集的查询
                if cursor.description:
                    rows = cursor.fetchall()
                    if rows:
                        print_table(rows)
                        print()
    finally:
        conn.close()


def print_table(rows: list):
    if not rows:
        return

    # 统一列名：取第一条数据的所有 key
    headers = list(rows[0].keys())
    # 计算每列最大宽度
    widths = {h: len(h) for h in headers}
    for row in rows:
        for h in headers:
            val = format_value(row.get(h))
            widths[h] = max(widths[h], len(val))

    # 表头
    header_line = " | ".join(h.ljust(widths[h]) for h in headers)
    print(header_line)
    print("-" * len(header_line))

    # 数据行
    for row in rows:
        print(" | ".join(format_value(row.get(h)).ljust(widths[h]) for h in headers))


def format_value(v) -> str:
    if v is None:
        return "NULL"
    if isinstance(v, bytes):
        return v.decode("utf-8", errors="ignore")
    return str(v)


if __name__ == "__main__":
    main()

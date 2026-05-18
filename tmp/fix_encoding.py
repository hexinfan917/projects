import subprocess
import sys

tables = [
    ("coupons", "name"),
    ("member_plans", "name"),
    ("member_plans", "subtitle"),
    ("users", "nickname"),
    ("users", "real_name"),
    ("articles", "title"),
    ("banners", "title"),
    ("routes", "name"),
    ("charity_activities", "title"),
    ("addons", "name"),
]

password = "Petway123"

for table, col in tables:
    sql = f"UPDATE {table} SET {col} = CONVERT(CAST(CONVERT({col} USING latin1) AS BINARY) USING utf8mb4) WHERE {col} IS NOT NULL AND {col} != '';"
    cmd = [
        "docker", "exec", "-i", "petway-mysql", "mysql", "-uroot", f"-p{password}", "petway", "-e", sql
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"ERROR fixing {table}.{col}: {result.stderr}", file=sys.stderr)
    else:
        print(f"Fixed {table}.{col}")

print("Done")

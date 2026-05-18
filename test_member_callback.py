#!/usr/bin/env python3
"""Test member order pay callback flow"""

import jwt
import requests
import json
import time

BASE_URL = "https://tailtravel.westilt.com"
JWT_SECRET = "your-secret-key"

now = int(time.time())
payload = {
    "user_id": 4,
    "openid": "test_openid_default",
    "type": "access",
    "iat": now,
    "exp": now + 3600,
}
token = jwt.encode(payload, JWT_SECRET, algorithm="HS256")
headers = {
    "Authorization": f"Bearer {token}",
    "Content-Type": "application/json",
}

print("=" * 60)
print("1. Create member order")
res = requests.post(
    f"{BASE_URL}/api/v1/member/orders",
    headers=headers,
    json={"plan_id": 2},  # Quarterly plan
    timeout=10,
)
order_res = res.json()
print(json.dumps(order_res, indent=2, ensure_ascii=False))

if order_res.get("code") != 200:
    print("ERROR: Failed to create order")
    exit(1)

order_no = order_res["data"]["order_no"]
print(f"\nOrder no: {order_no}")

print("=" * 60)
print("2. Trigger pay callback")
callback_data = {
    "order_no": order_no,
    "transaction_id": f"wx_test_{int(time.time())}",
    "pay_channel": "wechat"
}
res = requests.post(
    f"{BASE_URL}/api/v1/orders/pay/callback",
    headers=headers,
    json=callback_data,
    timeout=10,
)
print(f"Status: {res.status_code}")
callback_res = res.json()
print(json.dumps(callback_res, indent=2, ensure_ascii=False))

if callback_res.get("code") != "SUCCESS":
    print("ERROR: Callback failed")
    exit(1)

print("=" * 60)
print("3. Verify DB state")
import subprocess

# Check member_orders
result = subprocess.run([
    "docker", "exec", "petway-mysql",
    "mysql", "-uroot", "-pPetway123", "petway", "-e",
    f"SELECT id, order_no, status, pay_trade_no FROM member_orders WHERE order_no='{order_no}';"
], capture_output=True, text=True)
print("member_orders:")
print(result.stdout)

# Check user_memberships
result = subprocess.run([
    "docker", "exec", "petway-mysql",
    "mysql", "-uroot", "-pPetway123", "petway", "-e",
    "SELECT id, user_id, plan_id, status, start_date, end_date, order_id FROM user_memberships WHERE user_id=4;"
], capture_output=True, text=True)
print("user_memberships:")
print(result.stdout)

# Check user_coupons
result = subprocess.run([
    "docker", "exec", "petway-mysql",
    "mysql", "-uroot", "-pPetway123", "petway", "-e",
    "SELECT id, user_id, template_id, name, status, source_id FROM user_coupons WHERE user_id=4;"
], capture_output=True, text=True)
print("user_coupons:")
print(result.stdout)

print("=" * 60)
print("TEST COMPLETE")

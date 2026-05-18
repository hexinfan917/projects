#!/usr/bin/env python3
"""Test member pay flow with correct JWT secret"""

import jwt
import requests
import json
import time

BASE_URL = "https://tailtravel.westilt.com"
JWT_SECRET = "your-secret-key"  # Actual secret used by all services (JWTConfig has no env_prefix)
JWT_ALGORITHM = "HS256"

now = int(time.time())
payload = {
    "user_id": 4,
    "openid": "test_openid_default",
    "type": "access",
    "iat": now,
    "exp": now + 3600,
}
token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
print(f"Generated token (first 50 chars): {token[:50]}...")

headers = {
    "Authorization": f"Bearer {token}",
    "Content-Type": "application/json",
}

print("=" * 60)
print("1. Get member plans")
res = requests.get(f"{BASE_URL}/api/v1/member/plans", headers=headers, timeout=10)
print(f"Status: {res.status_code}")
plans = res.json()
print(json.dumps(plans, indent=2, ensure_ascii=False)[:500])

if plans.get("code") != 200 or not plans.get("data"):
    print("ERROR: No plans available")
    exit(1)

plan_id = plans["data"]["list"][0]["id"]
print(f"\nUsing plan_id={plan_id}")

print("=" * 60)
print("2. Create member order")
res = requests.post(
    f"{BASE_URL}/api/v1/member/orders",
    headers=headers,
    json={"plan_id": plan_id},
    timeout=10,
)
print(f"Status: {res.status_code}")
order_res = res.json()
print(json.dumps(order_res, indent=2, ensure_ascii=False))

if order_res.get("code") != 200:
    print("ERROR: Failed to create member order")
    exit(1)

order_id = order_res["data"]["order_id"]
order_no = order_res["data"].get("order_no", "N/A")
print(f"\nCreated order_id={order_id}, order_no={order_no}")

print("=" * 60)
print("3. Call member pay API")
res = requests.post(
    f"{BASE_URL}/api/v1/member/orders/{order_id}/pay",
    headers=headers,
    timeout=10,
)
print(f"Status: {res.status_code}")
pay_res = res.json()
print(json.dumps(pay_res, indent=2, ensure_ascii=False))

if pay_res.get("code") != 200:
    print(f"\nMember pay API returned error")
    print(f"Message: {pay_res.get('message')}")
else:
    pay_data = pay_res.get("data", {})
    print(f"\nmock={pay_data.get('mock')}")
    print(f"pay_order_no={pay_data.get('pay_order_no')}")
    pay_params = pay_data.get("pay_params")
    if pay_params:
        print(f"timeStamp={pay_params.get('timeStamp')}")
        print(f"nonceStr={pay_params.get('nonceStr')}")
        print(f"package={pay_params.get('package')}")
        print(f"signType={pay_params.get('signType')}")
        print(f"paySign={pay_params.get('paySign', '')[:30]}...")
    else:
        print("WARNING: No pay_params returned")

print("=" * 60)
print("4. Check order status in DB")
import subprocess
result = subprocess.run([
    "docker", "exec", "petway-mysql", 
    "mysql", "-uroot", "-pPetway123", "petway", "-e",
    f"SELECT id, order_no, status, pay_trade_no FROM member_orders WHERE id={order_id};"
], capture_output=True, text=True)
print(result.stdout)
if result.stderr:
    print("DB Error:", result.stderr)

print("=" * 60)
print("TEST COMPLETE")

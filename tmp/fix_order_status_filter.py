with open("/app/main.py", "r") as f:
    content = f.read()

old = """                SELECT user_id, id as order_id, order_no, coupon_name, discount_amount 
                FROM orders 
                WHERE user_id IN :user_ids AND (coupon_id IS NOT NULL OR discount_amount > 0)
                ORDER BY created_at DESC"""

new = """                SELECT user_id, id as order_id, order_no, coupon_name, discount_amount 
                FROM orders 
                WHERE user_id IN :user_ids AND (coupon_id IS NOT NULL OR discount_amount > 0)
                  AND status NOT IN (10, 30)
                ORDER BY created_at DESC"""

content = content.replace(old, new)
with open("/app/main.py", "w") as f:
    f.write(content)
print("Done")

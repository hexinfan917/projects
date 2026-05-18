import re

with open("/opt/petway/backend/order-service/main.py", "r") as f:
    content = f.read()

# Fix pay_callback coupon handling
old_callback_coupon = '''            # Issue coupons
            if plan and plan["coupon_package"]:
                coupon_package = plan["coupon_package"]
                if isinstance(coupon_package, str):
                    coupon_package = json.loads(coupon_package)
                templates = coupon_package.get("templates", [])
                for item in templates:
                    template_result = await db.execute(
                        text("SELECT * FROM coupon_templates WHERE id = :template_id"),
                        {"template_id": item["template_id"]}
                    )
                    template = template_result.mappings().one_or_none()
                    if not template:
                        continue
                    valid_days = item.get("valid_days", 30)
                    for _ in range(item.get("count", 1)):
                        await db.execute(
                            text("INSERT INTO user_coupons (user_id, template_id, coupon_no, name, type, value, min_amount, max_discount, applicable_type, applicable_ids, valid_start_time, valid_end_time, status, source_type, source_id, created_at) VALUES (:user_id, :template_id, :coupon_no, :name, :type, :value, :min_amount, :max_discount, :applicable_type, :applicable_ids, :valid_start, :valid_end, 1, 2, :source_id, NOW())"),
                            {
                                "user_id": user_id,
                                "template_id": template["id"],
                                "coupon_no": generate_coupon_no(),
                                "name": template["name"],
                                "type": template["type"],
                                "value": template["value"],
                                "min_amount": template["min_amount"],
                                "max_discount": template["max_discount"],
                                "applicable_type": template["applicable_type"],
                                "applicable_ids": json.dumps(template["applicable_ids"]) if template["applicable_ids"] else None,
                                "valid_start": now,
                                "valid_end": now + timedelta(days=valid_days),
                                "source_id": member_order["id"],
                            }
                        )'''

new_callback_coupon = '''            # Issue coupons
            if plan and plan["coupon_package"]:
                coupon_package = plan["coupon_package"]
                if isinstance(coupon_package, str):
                    coupon_package = json.loads(coupon_package)
                
                # Support both list format [1,2,3] and object format {"templates": [...]}
                if isinstance(coupon_package, list):
                    template_ids = coupon_package
                    templates_config = [{"template_id": tid, "count": 1, "valid_days": 30} for tid in template_ids]
                elif isinstance(coupon_package, dict):
                    templates_config = coupon_package.get("templates", [])
                else:
                    templates_config = []
                
                for item in templates_config:
                    template_result = await db.execute(
                        text("SELECT * FROM coupon_templates WHERE id = :template_id"),
                        {"template_id": item["template_id"]}
                    )
                    template = template_result.mappings().one_or_none()
                    if not template:
                        continue
                    valid_days = item.get("valid_days", 30)
                    for _ in range(item.get("count", 1)):
                        await db.execute(
                            text("INSERT INTO user_coupons (user_id, template_id, coupon_no, name, type, value, min_amount, max_discount, applicable_type, applicable_ids, valid_start_time, valid_end_time, status, source_type, source_id, created_at) VALUES (:user_id, :template_id, :coupon_no, :name, :type, :value, :min_amount, :max_discount, :applicable_type, :applicable_ids, :valid_start, :valid_end, 1, 2, :source_id, NOW())"),
                            {
                                "user_id": user_id,
                                "template_id": template["id"],
                                "coupon_no": generate_coupon_no(),
                                "name": template["name"],
                                "type": template["type"],
                                "value": template["value"],
                                "min_amount": template["min_amount"],
                                "max_discount": template["max_discount"],
                                "applicable_type": template["applicable_type"],
                                "applicable_ids": json.dumps(template["applicable_ids"]) if template["applicable_ids"] else None,
                                "valid_start": now,
                                "valid_end": now + timedelta(days=valid_days),
                                "source_id": member_order["id"],
                            }
                        )'''

content = content.replace(old_callback_coupon, new_callback_coupon)

with open("/opt/petway/backend/order-service/main.py", "w") as f:
    f.write(content)

print("Done")

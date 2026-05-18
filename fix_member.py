with open('/app/main.py', 'r') as f:
    content = f.read()

old = '''    plan_list = []
    for p in plans:
        benefit_config = p.benefit_config or {}
        coupon_package = p.coupon_package or {}
        
        benefits = benefit_config.get("items", [])
        if not benefits:
            # 生成默认权益展示
            benefits = []
            if benefit_config.get("discount_rate"):
                rate = benefit_config["discount_rate"]
                benefits.append({"icon": "discount", "title": f"全场{int(rate*10)}折"})
            if coupon_package.get("total_value"):
                benefits.append({"icon": "coupon", "title": f"赠¥{coupon_package['total_value']}券包"})
        
        plan_list.append({
            "id": p.id,
            "name": p.name,
            "subtitle": p.subtitle,
            "original_price": float(p.original_price),
            "sale_price": float(p.sale_price),
            "duration_days": p.duration_days,
            "tag": p.tag,
            "color": p.color,
            "is_recommend": p.is_recommend == 1,
            "benefits": benefits,
            "coupon_package": {
                "total_value": coupon_package.get("total_value", 0),
                "desc": coupon_package.get("desc", ""),
            }
        })'''

new = '''    plan_list = []
    for p in plans:
        benefit_config = p.benefit_config or {}
        coupon_package_raw = p.coupon_package or {}
        # coupon_package 可能是列表（旧数据）或字典（新数据格式）
        if isinstance(coupon_package_raw, list):
            coupon_package = {"total_value": 0, "desc": ""}
        else:
            coupon_package = coupon_package_raw
        
        benefits = benefit_config.get("items", [])
        if not benefits:
            # 生成默认权益展示
            benefits = []
            if benefit_config.get("discount_rate"):
                rate = benefit_config["discount_rate"]
                benefits.append({"icon": "discount", "title": f"全场{int(rate*10)}折"})
            if coupon_package.get("total_value"):
                benefits.append({"icon": "coupon", "title": f"赠¥{coupon_package['total_value']}券包"})
        
        plan_list.append({
            "id": p.id,
            "name": p.name,
            "subtitle": p.subtitle,
            "original_price": float(p.original_price),
            "sale_price": float(p.sale_price),
            "duration_days": p.duration_days,
            "tag": p.tag,
            "color": p.color,
            "is_recommend": p.is_recommend == 1,
            "benefits": benefits,
            "coupon_package": {
                "total_value": coupon_package.get("total_value", 0),
                "desc": coupon_package.get("desc", ""),
            }
        })'''

if old in content:
    content = content.replace(old, new)
    with open('/app/main.py', 'w') as f:
        f.write(content)
    print('Fixed!')
else:
    print('Pattern not found')

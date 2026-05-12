import pymysql
import json

conn = pymysql.connect(host='localhost', port=3306, user='root', password='root', database='quandouxing', charset='utf8mb4')
cursor = conn.cursor()

# 1. 插入优惠券模板（用于会员购买赠送）
cursor.execute("""
    INSERT INTO coupon_templates (name, type, value, min_amount, source_type, description, status)
    VALUES ('会员专享10元券', 3, 10, 0, 2, '无门槛立减10元', 1)
""")
cursor.execute("""
    INSERT INTO coupon_templates (name, type, value, min_amount, source_type, description, status)
    VALUES ('会员专享20元券', 3, 20, 0, 2, '无门槛立减20元', 1)
""")
# 通用券（领券中心）
cursor.execute("""
    INSERT INTO coupon_templates (name, type, value, min_amount, total_count, per_user_limit, valid_type, valid_days, source_type, description, status)
    VALUES ('新人立减券', 3, 30, 0, 1000, 1, 1, 30, 1, '新用户专享，无门槛立减30元', 1)
""")
cursor.execute("""
    INSERT INTO coupon_templates (name, type, value, min_amount, total_count, per_user_limit, valid_type, valid_days, source_type, description, status)
    VALUES ('满300减50', 1, 50, 300, 500, 2, 1, 30, 1, '满300元可用', 1)
""")

# 2. 插入会员套餐
cursor.execute("""
    INSERT INTO member_plans (name, subtitle, original_price, sale_price, duration_days, benefit_config, coupon_package, sort_order, tag, is_recommend, status)
    VALUES (
        '月卡会员', '连续包月', 39, 29, 30,
        '{"items": [{"icon": "discount", "title": "全场9.8折"}, {"icon": "coupon", "title": "赠¥30券包"}], "discount_rate": 0.98}',
        '{"templates": [{"template_id": 1, "count": 3, "valid_days": 30}], "total_value": 30, "desc": "3张¥10券"}',
        1, '尝鲜价', 0, 1
    )
""")
cursor.execute("""
    INSERT INTO member_plans (name, subtitle, original_price, sale_price, duration_days, benefit_config, coupon_package, sort_order, tag, is_recommend, status)
    VALUES (
        '季卡会员', '连续包季', 99, 79, 90,
        '{"items": [{"icon": "discount", "title": "全场9.5折"}, {"icon": "coupon", "title": "赠¥100券包"}, {"icon": "service", "title": "专属客服"}], "discount_rate": 0.95}',
        '{"templates": [{"template_id": 1, "count": 2, "valid_days": 90}, {"template_id": 2, "count": 4, "valid_days": 90}], "total_value": 100, "desc": "2张¥10券 + 4张¥20券"}',
        2, '热销', 1, 1
    )
""")
cursor.execute("""
    INSERT INTO member_plans (name, subtitle, original_price, sale_price, duration_days, benefit_config, coupon_package, sort_order, tag, is_recommend, status)
    VALUES (
        '年卡会员', '超值年卡', 365, 299, 365,
        '{"items": [{"icon": "discount", "title": "全场9折"}, {"icon": "coupon", "title": "赠¥400券包"}, {"icon": "service", "title": "专属客服"}, {"icon": "refund", "title": "优先退改"}], "discount_rate": 0.90}',
        '{"templates": [{"template_id": 2, "count": 20, "valid_days": 365}], "total_value": 400, "desc": "20张¥20券"}',
        3, '超值', 0, 1
    )
""")

# 3. 插入弹窗配置
cursor.execute("""
    INSERT INTO popup_configs (type, title, subtitle, content, primary_btn_text, close_btn_text, trigger_type, target_plan_id, target_page, status, start_time, end_time)
    VALUES (
        'member_activity',
        '开通会员 立享优惠',
        '新人首月仅需¥29',
        '{"benefits": ["全场路线9.5折", "每月赠送¥30券包", "专属客服通道"], "price_display": "¥29/月", "original_price": "¥39/月"}',
        '立即开通',
        '暂不开通',
        1,
        1,
        '/pages/member/center/index',
        1,
        NOW(),
        DATE_ADD(NOW(), INTERVAL 1 YEAR)
    )
""")

conn.commit()
cursor.close()
conn.close()
print('Test data seeded successfully')

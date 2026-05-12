import pymysql

conn = pymysql.connect(host='localhost', port=3306, user='root', password='root', database='quandouxing', charset='utf8mb4')
cursor = conn.cursor()

cursor.execute("ALTER TABLE orders ADD COLUMN coupon_id BIGINT UNSIGNED DEFAULT NULL COMMENT '使用的优惠券ID' AFTER pay_amount")
cursor.execute("ALTER TABLE orders ADD COLUMN coupon_name VARCHAR(100) DEFAULT NULL COMMENT '优惠券名称' AFTER coupon_id")
cursor.execute("ALTER TABLE orders ADD COLUMN member_discount_amount DECIMAL(10,2) DEFAULT 0 COMMENT '会员折扣金额' AFTER coupon_name")

conn.commit()
cursor.close()
conn.close()
print('Columns added successfully')

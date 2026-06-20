# 手动开通会员操作步骤

## 1. SSH 连接服务器

打开你电脑上的终端（Windows 用 PowerShell 或 Git Bash，Mac 用 Terminal）：

```bash
# 尝试 root 用户
ssh root@101.43.50.236

# 如果 root 连不上，尝试 ubuntu 用户
ssh ubuntu@101.43.50.236
```

输入密码（逐个试）：
- `Petway123`
- `Navicat2026`

如果连不上，检查是否有密钥文件需要指定：
```bash
ssh -i ~/.ssh/id_rsa root@101.43.50.236
```

---

## 2. 找到 MySQL 密码

连上服务器后，先找数据库密码。一般在项目目录的 `.env` 文件里：

```bash
# 进入项目目录
cd /path/to/your/project

# 查找 .env 或配置文件
cat .env | grep -i pass
cat docker/.env | grep -i pass
cat backend/.env | grep -i pass
```

或者如果是 Docker 部署的 MySQL，密码可能在 docker-compose 里：
```bash
cat docker-compose.yml | grep -i pass
cat docker-compose.yaml | grep -i pass
```

如果用了 `.env` 文件但找不到，直接看环境变量：
```bash
env | grep -i db
echo $DB_PASSWORD
echo $MYSQL_ROOT_PASSWORD
```

---

## 3. 登录 MySQL

找到密码后，登录 MySQL：

```bash
# 方法A：如果 MySQL 在本地
mysql -u root -p petway

# 方法B：如果 MySQL 在 Docker 里
docker exec -it mysql容器名 mysql -u root -p petway
```

输入密码后，看到 `mysql>` 提示符就是登录成功了。

---

## 4. 执行开通会员 SQL

把下面的 SQL **完整复制粘贴**进去执行：

```sql
-- ========== 手动开通年度会员 + 发放优惠券 ==========
-- 用户ID: 105 (Estelle)
-- 套餐: 年度会员 (ID: 3, 365天)

START TRANSACTION;

-- 第1步：插入会员订单
INSERT INTO member_orders (
  order_no, user_id, plan_id, original_price, discount_amount, pay_amount,
  status, pay_time, pay_channel, platform, created_at, updated_at
) VALUES (
  CONCAT('MV', DATE_FORMAT(NOW(), '%Y%m%d%H%i%s'), LPAD(FLOOR(RAND()*1000), 3, '0')),
  105, 3, 9.90, 9.90, 0.00,
  20, NOW(), 'manual', 'admin', NOW(), NOW()
);

SET @order_id = LAST_INSERT_ID();

-- 第2步：插入会员订阅
INSERT INTO user_memberships (
  user_id, plan_id, status, start_date, end_date,
  order_id, pay_amount, is_auto_renew, benefit_snapshot, created_at, updated_at
) VALUES (
  105, 3, 1,
  CURDATE(), DATE_ADD(CURDATE(), INTERVAL 365 DAY),
  @order_id, 0.00, 0,
  (SELECT benefit_config FROM member_plans WHERE id = 3),
  NOW(), NOW()
);

-- 第3步：发放优惠券 template_id 4 × 2 张
INSERT INTO user_coupons (
  user_id, template_id, coupon_no, name, type, value, min_amount,
  applicable_type, applicable_ids, valid_start_time, valid_end_time,
  status, source_type, source_id, description
)
SELECT 
  105, 4,
  CONCAT('CP', DATE_FORMAT(NOW(), '%Y%m%d%H%i%s'), '4', LPAD(FLOOR(RAND()*1000), 3, '0')),
  name, type, value, min_amount,
  applicable_type, applicable_ids,
  NOW(), DATE_ADD(NOW(), INTERVAL valid_days DAY),
  1, 2, @order_id, description
FROM coupon_templates WHERE id = 4;

INSERT INTO user_coupons (
  user_id, template_id, coupon_no, name, type, value, min_amount,
  applicable_type, applicable_ids, valid_start_time, valid_end_time,
  status, source_type, source_id, description
)
SELECT 
  105, 4,
  CONCAT('CP', DATE_FORMAT(NOW(), '%Y%m%d%H%i%s'), '4', LPAD(FLOOR(RAND()*1000), 3, '0')),
  name, type, value, min_amount,
  applicable_type, applicable_ids,
  NOW(), DATE_ADD(NOW(), INTERVAL valid_days DAY),
  1, 2, @order_id, description
FROM coupon_templates WHERE id = 4;

-- 第4步：发放优惠券 template_id 5 × 1 张
INSERT INTO user_coupons (
  user_id, template_id, coupon_no, name, type, value, min_amount,
  applicable_type, applicable_ids, valid_start_time, valid_end_time,
  status, source_type, source_id, description
)
SELECT 
  105, 5,
  CONCAT('CP', DATE_FORMAT(NOW(), '%Y%m%d%H%i%s'), '5', LPAD(FLOOR(RAND()*1000), 3, '0')),
  name, type, value, min_amount,
  applicable_type, applicable_ids,
  NOW(), DATE_ADD(NOW(), INTERVAL valid_days DAY),
  1, 2, @order_id, description
FROM coupon_templates WHERE id = 5;

COMMIT;

-- 第5步：验证开通结果
SELECT 
  u.id, u.nickname, u.phone,
  mp.name as plan_name, um.start_date, um.end_date,
  COUNT(DISTINCT uc.id) as coupon_count
FROM users u
LEFT JOIN user_memberships um ON u.id = um.user_id AND um.status = 1
LEFT JOIN member_plans mp ON um.plan_id = mp.id
LEFT JOIN user_coupons uc ON u.id = uc.user_id AND uc.source_id = @order_id
WHERE u.id = 105;
```

---

## 5. 验证结果

执行最后一条 SELECT 后，如果看到类似下面的结果，说明开通成功：

| id  | nickname | phone       | plan_name | start_date | end_date   | coupon_count |
|-----|----------|-------------|-----------|------------|------------|--------------|
| 105 | Estelle  | 18883275421 | 年度会员  | 2026-06-10 | 2027-06-10 | 3            |

- `plan_name = 年度会员` ✅
- `coupon_count = 3` ✅（2张会员专属券 + 1张品牌好礼）

然后打开 Admin 后台刷新页面，用户ID 105 的"是否会员"应该显示 **"是"**。

---

## 常见问题

**Q1: 执行 SQL 时报错 "Duplicate entry for key 'uk_user_active'"**
- 说明这个用户已经有会员记录了
- 先查一下：`SELECT * FROM user_memberships WHERE user_id = 105;`
- 如果要延期， UPDATE 那条记录的 `end_date` 即可

**Q2: 执行 SQL 时报错 "Table 'petway.member_orders' doesn't exist"**
- 说明数据库名不对，先确认数据库名：`SHOW DATABASES;`
- 然后切换：`USE 正确的数据库名;`

**Q3: MySQL 密码是什么？**
- 一般在项目目录的 `.env` 文件里搜索 `DB_PASSWORD` 或 `MYSQL_ROOT_PASSWORD`
- 如果找不到，可以用 `docker exec -it 容器名 env | grep -i pass` 查看

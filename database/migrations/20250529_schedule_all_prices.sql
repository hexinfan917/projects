-- ============================================
-- 排期表增加所有套餐价格字段
-- 支持营期级别配置所有套餐价格（覆盖路线默认价）
-- 日期: 2025-05-29
-- ============================================

SET @dbname = 'petway';
SET @tablename = 'route_schedules';

-- 大巴：单独人出行价格
SET @column_exists = (SELECT COUNT(*) FROM information_schema.columns 
  WHERE table_schema = @dbname AND table_name = @tablename AND column_name = 'single_person_price');
SET @sql = IF(@column_exists = 0, 
  'ALTER TABLE route_schedules ADD COLUMN single_person_price DECIMAL(10,2) DEFAULT NULL COMMENT "当日单独人出行价格(1人0宠)"',
  'SELECT "single_person_price already exists"');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 大巴：2人1宠价格
SET @column_exists = (SELECT COUNT(*) FROM information_schema.columns 
  WHERE table_schema = @dbname AND table_name = @tablename AND column_name = 'two_person_one_pet_price');
SET @sql = IF(@column_exists = 0, 
  'ALTER TABLE route_schedules ADD COLUMN two_person_one_pet_price DECIMAL(10,2) DEFAULT NULL COMMENT "当日2人1宠价格"',
  'SELECT "two_person_one_pet_price already exists"');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 大巴：1人2宠价格
SET @column_exists = (SELECT COUNT(*) FROM information_schema.columns 
  WHERE table_schema = @dbname AND table_name = @tablename AND column_name = 'one_person_two_pet_price');
SET @sql = IF(@column_exists = 0, 
  'ALTER TABLE route_schedules ADD COLUMN one_person_two_pet_price DECIMAL(10,2) DEFAULT NULL COMMENT "当日1人2宠价格"',
  'SELECT "one_person_two_pet_price already exists"');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 大巴：单独宠物价格
SET @column_exists = (SELECT COUNT(*) FROM information_schema.columns 
  WHERE table_schema = @dbname AND table_name = @tablename AND column_name = 'single_pet_price');
SET @sql = IF(@column_exists = 0, 
  'ALTER TABLE route_schedules ADD COLUMN single_pet_price DECIMAL(10,2) DEFAULT NULL COMMENT "当日单独宠物价格(0人1宠)"',
  'SELECT "single_pet_price already exists"');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 大巴：增加一人价格
SET @column_exists = (SELECT COUNT(*) FROM information_schema.columns 
  WHERE table_schema = @dbname AND table_name = @tablename AND column_name = 'extra_person_price');
SET @sql = IF(@column_exists = 0, 
  'ALTER TABLE route_schedules ADD COLUMN extra_person_price DECIMAL(10,2) DEFAULT NULL COMMENT "当日增加一人价格"',
  'SELECT "extra_person_price already exists"');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 大巴：增加一宠价格
SET @column_exists = (SELECT COUNT(*) FROM information_schema.columns 
  WHERE table_schema = @dbname AND table_name = @tablename AND column_name = 'extra_pet_price');
SET @sql = IF(@column_exists = 0, 
  'ALTER TABLE route_schedules ADD COLUMN extra_pet_price DECIMAL(10,2) DEFAULT NULL COMMENT "当日增加一宠价格"',
  'SELECT "extra_pet_price already exists"');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================
-- 自驾价格字段
-- ============================================

-- 自驾：单独人出行价格
SET @column_exists = (SELECT COUNT(*) FROM information_schema.columns 
  WHERE table_schema = @dbname AND table_name = @tablename AND column_name = 'self_drive_single_person_price');
SET @sql = IF(@column_exists = 0, 
  'ALTER TABLE route_schedules ADD COLUMN self_drive_single_person_price DECIMAL(10,2) DEFAULT NULL COMMENT "当日自驾单独人出行价格(1人0宠)"',
  'SELECT "self_drive_single_person_price already exists"');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 自驾：2人1宠价格
SET @column_exists = (SELECT COUNT(*) FROM information_schema.columns 
  WHERE table_schema = @dbname AND table_name = @tablename AND column_name = 'self_drive_two_person_one_pet_price');
SET @sql = IF(@column_exists = 0, 
  'ALTER TABLE route_schedules ADD COLUMN self_drive_two_person_one_pet_price DECIMAL(10,2) DEFAULT NULL COMMENT "当日自驾2人1宠价格"',
  'SELECT "self_drive_two_person_one_pet_price already exists"');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 自驾：1人2宠价格
SET @column_exists = (SELECT COUNT(*) FROM information_schema.columns 
  WHERE table_schema = @dbname AND table_name = @tablename AND column_name = 'self_drive_one_person_two_pet_price');
SET @sql = IF(@column_exists = 0, 
  'ALTER TABLE route_schedules ADD COLUMN self_drive_one_person_two_pet_price DECIMAL(10,2) DEFAULT NULL COMMENT "当日自驾1人2宠价格"',
  'SELECT "self_drive_one_person_two_pet_price already exists"');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 自驾：单独宠物价格
SET @column_exists = (SELECT COUNT(*) FROM information_schema.columns 
  WHERE table_schema = @dbname AND table_name = @tablename AND column_name = 'self_drive_single_pet_price');
SET @sql = IF(@column_exists = 0, 
  'ALTER TABLE route_schedules ADD COLUMN self_drive_single_pet_price DECIMAL(10,2) DEFAULT NULL COMMENT "当日自驾单独宠物价格(0人1宠)"',
  'SELECT "self_drive_single_pet_price already exists"');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 自驾：增加一人价格
SET @column_exists = (SELECT COUNT(*) FROM information_schema.columns 
  WHERE table_schema = @dbname AND table_name = @tablename AND column_name = 'self_drive_extra_person_price');
SET @sql = IF(@column_exists = 0, 
  'ALTER TABLE route_schedules ADD COLUMN self_drive_extra_person_price DECIMAL(10,2) DEFAULT NULL COMMENT "当日自驾增加一人价格"',
  'SELECT "self_drive_extra_person_price already exists"');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 自驾：增加一宠价格
SET @column_exists = (SELECT COUNT(*) FROM information_schema.columns 
  WHERE table_schema = @dbname AND table_name = @tablename AND column_name = 'self_drive_extra_pet_price');
SET @sql = IF(@column_exists = 0, 
  'ALTER TABLE route_schedules ADD COLUMN self_drive_extra_pet_price DECIMAL(10,2) DEFAULT NULL COMMENT "当日自驾增加一宠价格"',
  'SELECT "self_drive_extra_pet_price already exists"');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================
-- 历史数据迁移：将路线默认价复制到现有排期
-- （排期价为空时，前端会自动回退到路线价，这里做数据填充方便管理后台查看）
-- ============================================

-- 大巴套餐价
UPDATE route_schedules rs
JOIN routes r ON rs.route_id = r.id
SET rs.single_person_price = r.single_person_price
WHERE rs.single_person_price IS NULL AND r.single_person_price IS NOT NULL;

UPDATE route_schedules rs
JOIN routes r ON rs.route_id = r.id
SET rs.two_person_one_pet_price = r.two_person_one_pet_price
WHERE rs.two_person_one_pet_price IS NULL AND r.two_person_one_pet_price IS NOT NULL;

UPDATE route_schedules rs
JOIN routes r ON rs.route_id = r.id
SET rs.one_person_two_pet_price = r.one_person_two_pet_price
WHERE rs.one_person_two_pet_price IS NULL AND r.one_person_two_pet_price IS NOT NULL;

UPDATE route_schedules rs
JOIN routes r ON rs.route_id = r.id
SET rs.single_pet_price = r.single_pet_price
WHERE rs.single_pet_price IS NULL AND r.single_pet_price IS NOT NULL;

UPDATE route_schedules rs
JOIN routes r ON rs.route_id = r.id
SET rs.extra_person_price = r.extra_person_price
WHERE rs.extra_person_price IS NULL AND r.extra_person_price IS NOT NULL;

UPDATE route_schedules rs
JOIN routes r ON rs.route_id = r.id
SET rs.extra_pet_price = r.extra_pet_price
WHERE rs.extra_pet_price IS NULL AND r.extra_pet_price IS NOT NULL;

-- 自驾套餐价
UPDATE route_schedules rs
JOIN routes r ON rs.route_id = r.id
SET rs.self_drive_single_person_price = r.self_drive_single_person_price
WHERE rs.self_drive_single_person_price IS NULL AND r.self_drive_single_person_price IS NOT NULL;

UPDATE route_schedules rs
JOIN routes r ON rs.route_id = r.id
SET rs.self_drive_two_person_one_pet_price = r.self_drive_two_person_one_pet_price
WHERE rs.self_drive_two_person_one_pet_price IS NULL AND r.self_drive_two_person_one_pet_price IS NOT NULL;

UPDATE route_schedules rs
JOIN routes r ON rs.route_id = r.id
SET rs.self_drive_one_person_two_pet_price = r.self_drive_one_person_two_pet_price
WHERE rs.self_drive_one_person_two_pet_price IS NULL AND r.self_drive_one_person_two_pet_price IS NOT NULL;

UPDATE route_schedules rs
JOIN routes r ON rs.route_id = r.id
SET rs.self_drive_single_pet_price = r.self_drive_single_pet_price
WHERE rs.self_drive_single_pet_price IS NULL AND r.self_drive_single_pet_price IS NOT NULL;

UPDATE route_schedules rs
JOIN routes r ON rs.route_id = r.id
SET rs.self_drive_extra_person_price = r.self_drive_extra_person_price
WHERE rs.self_drive_extra_person_price IS NULL AND r.self_drive_extra_person_price IS NOT NULL;

UPDATE route_schedules rs
JOIN routes r ON rs.route_id = r.id
SET rs.self_drive_extra_pet_price = r.self_drive_extra_pet_price
WHERE rs.self_drive_extra_pet_price IS NULL AND r.self_drive_extra_pet_price IS NOT NULL;

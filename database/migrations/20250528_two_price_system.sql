-- ============================================
-- 两套价格系统迁移脚本
-- 日期: 2025-05-28
-- ============================================

-- 检查并添加缺失的现有字段
SET @dbname = 'petway';
SET @tablename = 'routes';

-- single_person_price
SET @column_exists = (SELECT COUNT(*) FROM information_schema.columns 
  WHERE table_schema = @dbname AND table_name = @tablename AND column_name = 'single_person_price');
SET @sql = IF(@column_exists = 0, 
  'ALTER TABLE routes ADD COLUMN single_person_price DECIMAL(10,2) DEFAULT NULL COMMENT "单独人出行价格(1人0宠)"',
  'SELECT "single_person_price already exists"');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- two_person_one_pet_price
SET @column_exists = (SELECT COUNT(*) FROM information_schema.columns 
  WHERE table_schema = @dbname AND table_name = @tablename AND column_name = 'two_person_one_pet_price');
SET @sql = IF(@column_exists = 0, 
  'ALTER TABLE routes ADD COLUMN two_person_one_pet_price DECIMAL(10,2) DEFAULT NULL COMMENT "2人1宠价格"',
  'SELECT "two_person_one_pet_price already exists"');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- one_person_two_pet_price
SET @column_exists = (SELECT COUNT(*) FROM information_schema.columns 
  WHERE table_schema = @dbname AND table_name = @tablename AND column_name = 'one_person_two_pet_price');
SET @sql = IF(@column_exists = 0, 
  'ALTER TABLE routes ADD COLUMN one_person_two_pet_price DECIMAL(10,2) DEFAULT NULL COMMENT "1人2宠价格"',
  'SELECT "one_person_two_pet_price already exists"');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- single_pet_price
SET @column_exists = (SELECT COUNT(*) FROM information_schema.columns 
  WHERE table_schema = @dbname AND table_name = @tablename AND column_name = 'single_pet_price');
SET @sql = IF(@column_exists = 0, 
  'ALTER TABLE routes ADD COLUMN single_pet_price DECIMAL(10,2) DEFAULT NULL COMMENT "单独宠物价格(0人1宠)"',
  'SELECT "single_pet_price already exists"');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- self_drive_discount
SET @column_exists = (SELECT COUNT(*) FROM information_schema.columns 
  WHERE table_schema = @dbname AND table_name = @tablename AND column_name = 'self_drive_discount');
SET @sql = IF(@column_exists = 0, 
  'ALTER TABLE routes ADD COLUMN self_drive_discount DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT "自驾优惠金额（旧字段，逐步废弃）"',
  'SELECT "self_drive_discount already exists"');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================
-- 新增自驾价格字段
-- ============================================

-- self_drive_base_price
SET @column_exists = (SELECT COUNT(*) FROM information_schema.columns 
  WHERE table_schema = @dbname AND table_name = @tablename AND column_name = 'self_drive_base_price');
SET @sql = IF(@column_exists = 0, 
  'ALTER TABLE routes ADD COLUMN self_drive_base_price DECIMAL(10,2) DEFAULT NULL COMMENT "自驾基础价格(1人1宠)"',
  'SELECT "self_drive_base_price already exists"');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- self_drive_single_person_price
SET @column_exists = (SELECT COUNT(*) FROM information_schema.columns 
  WHERE table_schema = @dbname AND table_name = @tablename AND column_name = 'self_drive_single_person_price');
SET @sql = IF(@column_exists = 0, 
  'ALTER TABLE routes ADD COLUMN self_drive_single_person_price DECIMAL(10,2) DEFAULT NULL COMMENT "自驾单独人出行价格(1人0宠)"',
  'SELECT "self_drive_single_person_price already exists"');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- self_drive_two_person_one_pet_price
SET @column_exists = (SELECT COUNT(*) FROM information_schema.columns 
  WHERE table_schema = @dbname AND table_name = @tablename AND column_name = 'self_drive_two_person_one_pet_price');
SET @sql = IF(@column_exists = 0, 
  'ALTER TABLE routes ADD COLUMN self_drive_two_person_one_pet_price DECIMAL(10,2) DEFAULT NULL COMMENT "自驾2人1宠价格"',
  'SELECT "self_drive_two_person_one_pet_price already exists"');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- self_drive_one_person_two_pet_price
SET @column_exists = (SELECT COUNT(*) FROM information_schema.columns 
  WHERE table_schema = @dbname AND table_name = @tablename AND column_name = 'self_drive_one_person_two_pet_price');
SET @sql = IF(@column_exists = 0, 
  'ALTER TABLE routes ADD COLUMN self_drive_one_person_two_pet_price DECIMAL(10,2) DEFAULT NULL COMMENT "自驾1人2宠价格"',
  'SELECT "self_drive_one_person_two_pet_price already exists"');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- self_drive_single_pet_price
SET @column_exists = (SELECT COUNT(*) FROM information_schema.columns 
  WHERE table_schema = @dbname AND table_name = @tablename AND column_name = 'self_drive_single_pet_price');
SET @sql = IF(@column_exists = 0, 
  'ALTER TABLE routes ADD COLUMN self_drive_single_pet_price DECIMAL(10,2) DEFAULT NULL COMMENT "自驾单独宠物价格(0人1宠)"',
  'SELECT "self_drive_single_pet_price already exists"');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- self_drive_extra_person_price
SET @column_exists = (SELECT COUNT(*) FROM information_schema.columns 
  WHERE table_schema = @dbname AND table_name = @tablename AND column_name = 'self_drive_extra_person_price');
SET @sql = IF(@column_exists = 0, 
  'ALTER TABLE routes ADD COLUMN self_drive_extra_person_price DECIMAL(10,2) DEFAULT NULL COMMENT "自驾增加一人价格"',
  'SELECT "self_drive_extra_person_price already exists"');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- self_drive_extra_pet_price
SET @column_exists = (SELECT COUNT(*) FROM information_schema.columns 
  WHERE table_schema = @dbname AND table_name = @tablename AND column_name = 'self_drive_extra_pet_price');
SET @sql = IF(@column_exists = 0, 
  'ALTER TABLE routes ADD COLUMN self_drive_extra_pet_price DECIMAL(10,2) DEFAULT NULL COMMENT "自驾增加一宠价格"',
  'SELECT "self_drive_extra_pet_price already exists"');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- route_schedules: self_drive_price
SET @tablename2 = 'route_schedules';
SET @column_exists = (SELECT COUNT(*) FROM information_schema.columns 
  WHERE table_schema = @dbname AND table_name = @tablename2 AND column_name = 'self_drive_price');
SET @sql = IF(@column_exists = 0, 
  'ALTER TABLE route_schedules ADD COLUMN self_drive_price DECIMAL(10,2) DEFAULT NULL COMMENT "当日自驾特殊定价"',
  'SELECT "self_drive_price already exists"');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================
-- 历史数据迁移
-- ============================================

-- 额外人宠自驾价：默认与大巴价相同
UPDATE routes SET self_drive_extra_person_price = extra_person_price WHERE self_drive_extra_person_price IS NULL;
UPDATE routes SET self_drive_extra_pet_price = extra_pet_price WHERE self_drive_extra_pet_price IS NULL;

-- 排期自驾价：默认与大巴排期价相同
UPDATE route_schedules SET self_drive_price = price WHERE self_drive_price IS NULL AND price IS NOT NULL;

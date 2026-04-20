-- 路线模块初始化脚本
-- 创建路线表
CREATE TABLE IF NOT EXISTS routes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  route_no VARCHAR(20) NOT NULL COMMENT '路线编号 R2024001',
  name VARCHAR(100) NOT NULL COMMENT '路线名称',
  route_type TINYINT NOT NULL COMMENT '1山野厨房 2海边度假 3森林露营 4主题派对 5自驾路线',
  title VARCHAR(200) COMMENT '副标题',
  cover_image VARCHAR(500) COMMENT '封面图',
  gallery JSON COMMENT '图集URL数组',
  description TEXT COMMENT '详细介绍',
  highlights JSON COMMENT '亮点标签',
  suitable_breeds JSON COMMENT '适合品种',
  unsuitable_breeds JSON COMMENT '不适合品种',
  duration VARCHAR(20) COMMENT '时长: 半日/1日/2日',
  difficulty TINYINT DEFAULT 3 COMMENT '难度 1-5',
  min_participants INT DEFAULT 4 COMMENT '最小成团人数',
  max_participants INT DEFAULT 12 COMMENT '最大人数',
  base_price DECIMAL(10,2) COMMENT '基础价格',
  safety_video_url VARCHAR(500) COMMENT '安全视频URL',
  safety_video_duration INT DEFAULT 180 COMMENT '视频时长秒',
  is_safety_required TINYINT DEFAULT 1 COMMENT '是否强制观看',
  status TINYINT DEFAULT 1 COMMENT '0下架 1上架',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_route_no (route_no),
  KEY idx_type_status (route_type, status),
  KEY idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='路线表';

-- 创建路线排期表
CREATE TABLE IF NOT EXISTS route_schedules (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  route_id BIGINT UNSIGNED NOT NULL COMMENT '路线ID',
  schedule_date DATE NOT NULL COMMENT '活动日期',
  start_time TIME COMMENT '开始时间',
  end_time TIME COMMENT '结束时间',
  price DECIMAL(10,2) COMMENT '当日价格',
  stock INT DEFAULT 12 COMMENT '剩余库存',
  sold INT DEFAULT 0 COMMENT '已售',
  status TINYINT DEFAULT 1 COMMENT '0关闭 1可售 2已满 3已结束',
  guide_id BIGINT COMMENT '领队ID',
  trainer_id BIGINT COMMENT '训犬师ID',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_route_date (route_id, schedule_date),
  KEY idx_date (schedule_date),
  KEY idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='路线排期表';

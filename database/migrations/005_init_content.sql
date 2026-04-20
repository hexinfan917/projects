-- 内容模块初始化脚本
-- 创建安全视频观看记录表
CREATE TABLE IF NOT EXISTS video_watches (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  route_id BIGINT UNSIGNED NOT NULL,
  video_url VARCHAR(500),
  watch_progress INT DEFAULT 0 COMMENT '观看进度秒',
  is_completed TINYINT DEFAULT 0 COMMENT '是否看完',
  completed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_route (user_id, route_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='视频观看记录';

-- 创建UGC内容表
CREATE TABLE IF NOT EXISTS contents (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  content_type TINYINT NOT NULL COMMENT '1攻略 2照片 3视频',
  author_id BIGINT UNSIGNED NOT NULL COMMENT '作者ID',
  route_id BIGINT UNSIGNED DEFAULT NULL COMMENT '关联路线',
  poi_id BIGINT UNSIGNED DEFAULT NULL COMMENT '关联POI',
  title VARCHAR(200) DEFAULT NULL,
  text_content TEXT COMMENT '文字内容',
  images JSON COMMENT '图片数组',
  video_url VARCHAR(500),
  video_duration INT DEFAULT 0,
  video_cover VARCHAR(500),
  tags JSON COMMENT '标签',
  location_name VARCHAR(100),
  longitude DECIMAL(10,7),
  latitude DECIMAL(10,7),
  view_count INT DEFAULT 0,
  like_count INT DEFAULT 0,
  comment_count INT DEFAULT 0,
  share_count INT DEFAULT 0,
  status TINYINT DEFAULT 1 COMMENT '0审核中 1已发布 2已下架',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_author (author_id),
  KEY idx_route (route_id),
  KEY idx_poi (poi_id),
  KEY idx_type_status (content_type, status),
  KEY idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='UGC内容表';

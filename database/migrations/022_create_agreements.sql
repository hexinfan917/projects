-- 协议/文档管理表（高风险活动确认书、出行前须知、宠物医疗授权书等）
-- 2025-05-15

CREATE TABLE IF NOT EXISTS agreements (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(200) NOT NULL COMMENT '协议标题',
  type VARCHAR(50) NOT NULL COMMENT '协议类型：risk_confirm|travel_notice|pet_medical|other',
  content TEXT NOT NULL COMMENT '协议内容（支持HTML）',
  sort_order INT DEFAULT 0 COMMENT '排序，越小越靠前',
  status TINYINT DEFAULT 1 COMMENT '0禁用 1启用',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_type_status (type, status),
  KEY idx_status (status),
  KEY idx_sort (sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='协议/文档管理表';

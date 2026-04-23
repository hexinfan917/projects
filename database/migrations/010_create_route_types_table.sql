-- 路线类型配置表
CREATE TABLE IF NOT EXISTS route_types (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(50) NOT NULL COMMENT '类型名称',
  icon VARCHAR(50) DEFAULT NULL COMMENT '图标标识',
  color VARCHAR(20) DEFAULT NULL COMMENT '主题色',
  sort_order INT DEFAULT 0 COMMENT '排序',
  status TINYINT DEFAULT 1 COMMENT '0禁用 1启用',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='路线类型配置表';

-- 插入默认类型数据
INSERT INTO route_types (id, name, icon, color, sort_order, status) VALUES
(1, '山野厨房', 'mountain', '#96C93D', 1, 1),
(2, '海边度假', 'beach', '#4ECDC4', 2, 1),
(3, '森林露营', 'camping', '#667EEA', 3, 1),
(4, '主题派对', 'party', '#FF8C42', 4, 1),
(5, '自驾路线', 'car', '#11998E', 5, 1)
ON DUPLICATE KEY UPDATE name = VALUES(name), icon = VALUES(icon), color = VALUES(color), status = VALUES(status);

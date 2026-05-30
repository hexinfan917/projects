-- 行程选配分类表
CREATE TABLE IF NOT EXISTS addon_categories (
    id INT PRIMARY KEY AUTO_INCREMENT COMMENT '主键ID',
    code VARCHAR(30) NOT NULL COMMENT '唯一标识码（如 dog_ticket, hotel）',
    name VARCHAR(50) NOT NULL COMMENT '分类名称（如 狗狗票, 酒店）',
    sort_order INT DEFAULT 0 COMMENT '排序',
    status TINYINT DEFAULT 1 COMMENT '0禁用 1启用',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    UNIQUE KEY uk_code (code),
    INDEX idx_status (status),
    INDEX idx_sort_order (sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='行程选配分类表';

-- 初始化现有分类数据
INSERT INTO addon_categories (code, name, sort_order, status) VALUES
('dog_ticket', '狗狗票', 1, 1),
('hotel', '酒店', 2, 1),
('amusement', '游乐项目', 3, 1)
ON DUPLICATE KEY UPDATE name = VALUES(name), status = 1;

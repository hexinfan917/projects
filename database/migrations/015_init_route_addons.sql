-- 行程选配表
CREATE TABLE IF NOT EXISTS route_addons (
    id INT PRIMARY KEY AUTO_INCREMENT COMMENT '主键ID',
    route_id INT NOT NULL COMMENT '关联线路ID',
    category VARCHAR(20) NOT NULL COMMENT '分类：dog_ticket(狗狗票) / hotel(酒店) / amusement(游乐项目)',
    name VARCHAR(100) NOT NULL COMMENT '名称',
    price DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT '售价',
    unit VARCHAR(20) DEFAULT '份' COMMENT '计价单位',
    description TEXT COMMENT '详细介绍/说明',
    stock INT DEFAULT 999 COMMENT '库存',
    sold INT DEFAULT 0 COMMENT '已售',
    limit_per_order INT DEFAULT 0 COMMENT '单订单限购数量，0表示不限',
    is_required TINYINT DEFAULT 0 COMMENT '是否必选 0否 1是',
    need_info TINYINT DEFAULT 0 COMMENT '是否需要填写资料 0否 1是',
    sort_order INT DEFAULT 0 COMMENT '排序',
    status TINYINT DEFAULT 1 COMMENT '0下架 1上架',
    extra_config JSON COMMENT '扩展配置：犬型限制、房型、场次等',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_route_id (route_id),
    INDEX idx_category (category),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='行程选配表';

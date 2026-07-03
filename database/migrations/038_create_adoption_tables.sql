-- 创建领养相关表

CREATE TABLE IF NOT EXISTS adoption_dogs (
    id INT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    name VARCHAR(50) NOT NULL COMMENT '狗狗名字',
    breed VARCHAR(50) NULL COMMENT '品种',
    gender VARCHAR(10) NULL COMMENT '性别',
    age VARCHAR(50) NULL COMMENT '年龄描述',
    weight VARCHAR(20) NULL COMMENT '体重',
    location VARCHAR(200) NULL COMMENT '所在城市/基地',
    cover_image VARCHAR(500) NULL COMMENT '封面图',
    images JSON NULL COMMENT '相册',
    story LONGTEXT NULL COMMENT '救助故事/性格描述',
    health_tags JSON NULL COMMENT '健康标签',
    adoption_requirements LONGTEXT NULL COMMENT '领养要求',
    status INT DEFAULT 1 COMMENT '状态: 0未开放 1可申请 2已领养 3已下架',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='领养狗狗档案表';

CREATE TABLE IF NOT EXISTS adoption_applications (
    id INT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    dog_id INT NOT NULL COMMENT '狗狗ID',
    openid VARCHAR(100) NOT NULL COMMENT '申请人openid',
    user_id INT NULL COMMENT '申请人用户ID',
    name VARCHAR(50) NOT NULL COMMENT '姓名',
    gender VARCHAR(10) NULL COMMENT '性别',
    age VARCHAR(20) NULL COMMENT '年龄',
    phone VARCHAR(20) NOT NULL COMMENT '电话',
    wechat VARCHAR(50) NULL COMMENT '微信号',
    city VARCHAR(100) NULL COMMENT '所在城市',
    address VARCHAR(300) NULL COMMENT '详细地址',
    housing VARCHAR(50) NULL COMMENT '住房情况',
    experience TEXT NULL COMMENT '养宠经验',
    reason TEXT NULL COMMENT '领养理由',
    status INT DEFAULT 0 COMMENT '状态: 0待审核 1已通过 2已拒绝 3已完成领养',
    admin_remark TEXT NULL COMMENT '管理后台备注',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_dog_openid (dog_id, openid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='领养申请表';

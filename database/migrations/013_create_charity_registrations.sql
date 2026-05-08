-- 公益活动报名表
CREATE TABLE IF NOT EXISTS charity_registrations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  activity_id BIGINT UNSIGNED NOT NULL COMMENT '活动ID',
  openid VARCHAR(100) NOT NULL COMMENT '小程序用户openid',
  name VARCHAR(50) NOT NULL COMMENT '姓名',
  phone VARCHAR(20) NOT NULL COMMENT '联系电话',
  participant_count INT DEFAULT 1 COMMENT '参与人数',
  agree_disclaimer TINYINT DEFAULT 0 COMMENT '是否同意免责条款: 0否 1是',
  city VARCHAR(100) COMMENT '所在城市/区域',
  remark TEXT COMMENT '备注',
  emergency_name VARCHAR(50) COMMENT '紧急联系人姓名',
  emergency_phone VARCHAR(20) COMMENT '紧急联系人电话',
  status TINYINT DEFAULT 0 COMMENT '0待审核 1已通过 2已拒绝 3已签到',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_activity_id (activity_id),
  KEY idx_openid (openid),
  KEY idx_status (status),
  UNIQUE KEY uk_activity_openid (activity_id, openid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='公益活动报名表';

-- 公益活动增加报名配置字段
ALTER TABLE charity_activities
  ADD COLUMN require_city TINYINT DEFAULT 0 COMMENT '是否必填城市: 0否 1是' AFTER max_participants,
  ADD COLUMN require_emergency TINYINT DEFAULT 0 COMMENT '是否必填紧急联系人: 0否 1是' AFTER require_city,
  ADD COLUMN disclaimer TEXT COMMENT '免责条款内容' AFTER require_emergency;

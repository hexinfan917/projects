-- 消息通知表
CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '接收用户ID，0为全局广播',
  title VARCHAR(200) NOT NULL COMMENT '通知标题',
  content TEXT NOT NULL COMMENT '通知内容',
  notify_type VARCHAR(50) DEFAULT 'system' COMMENT '类型: system系统 order订单 route路线',
  biz_id BIGINT UNSIGNED COMMENT '业务ID（如订单ID）',
  biz_type VARCHAR(50) COMMENT '业务类型',
  is_read TINYINT DEFAULT 0 COMMENT '0未读 1已读',
  read_at TIMESTAMP NULL,
  push_status TINYINT DEFAULT 0 COMMENT '0未推送 1已推送 2推送失败',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_user_read (user_id, is_read),
  KEY idx_type (notify_type),
  KEY idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='通知表';

-- 公益活动表
CREATE TABLE IF NOT EXISTS charity_activities (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(200) NOT NULL COMMENT '活动标题',
  subtitle VARCHAR(500) COMMENT '副标题',
  cover_image VARCHAR(500) COMMENT '封面图',
  images JSON COMMENT '活动图集',
  activity_type VARCHAR(50) DEFAULT 'volunteer' COMMENT '类型: volunteer义工 rescue救助 donate捐赠 adopt领养',
  content TEXT NOT NULL COMMENT '活动内容',
  location VARCHAR(200) COMMENT '活动地点',
  start_date DATE COMMENT '开始日期',
  end_date DATE COMMENT '结束日期',
  max_participants INT DEFAULT 0 COMMENT '0不限',
  current_participants INT DEFAULT 0,
  contact_name VARCHAR(50) COMMENT '联系人',
  contact_phone VARCHAR(20) COMMENT '联系电话',
  organizer VARCHAR(100) COMMENT '主办机构',
  status TINYINT DEFAULT 0 COMMENT '0草稿 1报名中 2进行中 3已结束 4已取消',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_type_status (activity_type, status),
  KEY idx_start_date (start_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='公益活动表';

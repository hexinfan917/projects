#!/bin/bash
# 生产环境定时备份脚本
# 备份内容：MySQL、Redis、上传文件、证书、配置
# 保留策略：保留最近 7 天备份

set -e

BACKUP_DIR="/opt/petway/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_NAME="petway_backup_${TIMESTAMP}"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_NAME}"
LOG_FILE="${BACKUP_DIR}/backup.log"

# 数据库配置
DB_ROOT_PASSWORD="Petway123"
REDIS_PASSWORD="Petway123"

# 创建备份目录
mkdir -p "${BACKUP_PATH}"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] 备份开始: ${BACKUP_NAME}" | tee -a "${LOG_FILE}"

# 1. 备份 MySQL
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 备份 MySQL ..." | tee -a "${LOG_FILE}"
docker exec petway-mysql mysqldump -uroot -p${DB_ROOT_PASSWORD} \
  --single-transaction --routines --triggers --databases petway \
  > "${BACKUP_PATH}/mysql_petway.sql" 2>>"${LOG_FILE}"

if [ -s "${BACKUP_PATH}/mysql_petway.sql" ]; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] MySQL 备份成功: $(ls -lh ${BACKUP_PATH}/mysql_petway.sql | awk '{print $5}')" | tee -a "${LOG_FILE}"
else
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] MySQL 备份失败!" | tee -a "${LOG_FILE}"
  exit 1
fi

# 2. 备份 Redis
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 备份 Redis ..." | tee -a "${LOG_FILE}"
docker exec petway-redis redis-cli -a ${REDIS_PASSWORD} BGSAVE
sleep 3
docker cp petway-redis:/data/dump.rdb "${BACKUP_PATH}/redis_dump.rdb"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Redis 备份成功" | tee -a "${LOG_FILE}"

# 3. 备份上传文件
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 备份上传文件 ..." | tee -a "${LOG_FILE}"
if [ -d "/opt/petway/backend/file-service/uploads" ]; then
  cp -a "/opt/petway/backend/file-service/uploads" "${BACKUP_PATH}/uploads"
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] 上传文件备份成功" | tee -a "${LOG_FILE}"
else
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] 上传文件目录不存在，跳过" | tee -a "${LOG_FILE}"
fi

# 4. 备份证书
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 备份证书 ..." | tee -a "${LOG_FILE}"
if [ -d "/opt/petway/certs" ]; then
  cp -a "/opt/petway/certs" "${BACKUP_PATH}/certs"
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] 证书备份成功" | tee -a "${LOG_FILE}"
else
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] 证书目录不存在，跳过" | tee -a "${LOG_FILE}"
fi

# 5. 备份 Docker 配置和环境变量
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 备份配置文件 ..." | tee -a "${LOG_FILE}"
cp -a "/opt/petway/docker" "${BACKUP_PATH}/docker_config"
if [ -f "/opt/petway/docker/prod/.env" ]; then
  cp "/opt/petway/docker/prod/.env" "${BACKUP_PATH}/env_backup"
fi
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 配置文件备份成功" | tee -a "${LOG_FILE}"

# 6. 打包备份
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 打包备份 ..." | tee -a "${LOG_FILE}"
tar -czf "${BACKUP_DIR}/${BACKUP_NAME}.tar.gz" -C "${BACKUP_DIR}" "${BACKUP_NAME}"
rm -rf "${BACKUP_PATH}"

BACKUP_SIZE=$(ls -lh "${BACKUP_DIR}/${BACKUP_NAME}.tar.gz" | awk '{print $5}')
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 打包完成: ${BACKUP_SIZE}" | tee -a "${LOG_FILE}"

# 7. 清理 7 天前的旧备份
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 清理 7 天前的旧备份 ..." | tee -a "${LOG_FILE}"
DELETED=$(find "${BACKUP_DIR}" -name "petway_backup_*.tar.gz" -mtime +7 -type f)
if [ -n "${DELETED}" ]; then
  echo "${DELETED}" | while read -r file; do
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 删除旧备份: $(basename ${file})" | tee -a "${LOG_FILE}"
  done
  find "${BACKUP_DIR}" -name "petway_backup_*.tar.gz" -mtime +7 -type f -delete
else
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] 无需要清理的旧备份" | tee -a "${LOG_FILE}"
fi

# 8. 输出备份结果
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 备份完成: ${BACKUP_NAME}.tar.gz (${BACKUP_SIZE})" | tee -a "${LOG_FILE}"
echo "----------------------------------------" | tee -a "${LOG_FILE}"

import paramiko

HOST = "101.43.50.236"
USER = "ubuntu"
KEY_FILE = "D:/projects/petway.pem"

def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, key_filename=KEY_FILE, timeout=15)

    # 检查当前 .env 配置
    print("=== Checking current .env ===")
    stdin, stdout, stderr = ssh.exec_command("cat /opt/petway/docker/prod/.env | grep WECHAT")
    current = stdout.read().decode()
    print(current if current else "(not found)")

    # 更新 .env
    env_content = """DB_ROOT_PASSWORD=Petway123
DB_USER=petway
DB_PASSWORD=Petway123
REDIS_PASSWORD=Petway123
JWT_SECRET=petway_jwt_secret_key_2024_change_me_at_least_32_chars
WECHAT_APPID=wxdf099f340581f93d
WECHAT_APPSECRET=0692f41ecc987e3696df9548e5a5b2ca
WECHAT_MCHID=1745520876
WECHAT_APIKEY=qaec9lm5xci1322g59stwnnb55jdue1w
WECHAT_NOTIFY_URL=https://tailtravel.westilt.com/api/v1/pay/notify
OSS_ACCESS_KEY_ID=your_oss_key
OSS_ACCESS_KEY_SECRET=your_oss_secret
OSS_BUCKET=your_bucket
OSS_ENDPOINT=oss-cn-hangzhou.aliyuncs.com
"""

    print("\n=== Updating .env ===")
    stdin, stdout, stderr = ssh.exec_command(f"echo '{env_content}' | sudo tee /opt/petway/docker/prod/.env > /dev/null")
    stdout.read()
    print(".env updated")

    # 验证更新
    print("\n=== Verifying .env ===")
    stdin, stdout, stderr = ssh.exec_command("cat /opt/petway/docker/prod/.env | grep WECHAT")
    print(stdout.read().decode())

    # 重启 user-service
    print("\n=== Restarting user-service ===")
    stdin, stdout, stderr = ssh.exec_command("cd /opt/petway/docker/prod && sudo docker compose up -d --force-recreate user-service")
    print(stdout.read().decode())

    # 检查状态
    print("\n=== Checking user-service status ===")
    stdin, stdout, stderr = ssh.exec_command("sudo docker ps --format 'table {{.Names}}\t{{.Status}}' | grep user")
    print(stdout.read().decode())

    # 测试登录
    print("\n=== Testing login API ===")
    stdin, stdout, stderr = ssh.exec_command("curl -s -X POST http://localhost:8001/api/v1/auth/wechat/login -H 'Content-Type: application/json' -d '{\"code\":\"test\",\"phone_code\":\"test\"}'")
    print(stdout.read().decode()[:500])

    ssh.close()
    print("\nDone! Please test phone login on the miniapp.")

if __name__ == "__main__":
    main()

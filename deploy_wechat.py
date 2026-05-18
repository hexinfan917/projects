import paramiko
import json

HOST = "101.43.50.236"
USER = "ubuntu"
KEY_FILE = "D:/projects/petway.pem"

def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, key_filename=KEY_FILE, timeout=15)

    # Update .env using sudo tee
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

    print("=== Updating .env ===")
    stdin, stdout, stderr = ssh.exec_command(f"echo '{env_content}' | sudo tee /opt/petway/docker/prod/.env > /dev/null")
    stdout.read()
    print(".env updated")

    print("\n=== Updating docker-compose.yml ===")
    stdin, stdout, stderr = ssh.exec_command("sed -i 's/WECHAT_PAY_SANDBOX=true/WECHAT_PAY_SANDBOX=false/' /opt/petway/docker/prod/docker-compose.yml")
    stdout.read()
    print("sandbox mode disabled")

    print("\n=== Rebuilding pay-service ===")
    stdin, stdout, stderr = ssh.exec_command("cd /opt/petway/docker/prod && sudo docker compose build --no-cache pay-service", timeout=180)
    out = stdout.read().decode()
    print(out[-1000:] if len(out) > 1000 else out)

    print("\n=== Starting pay-service ===")
    stdin, stdout, stderr = ssh.exec_command("cd /opt/petway/docker/prod && sudo docker compose up -d pay-service")
    print(stdout.read().decode())

    print("\n=== Checking status ===")
    stdin, stdout, stderr = ssh.exec_command("sudo docker ps --format 'table {{.Names}}\\t{{.Status}}' | grep pay")
    print(stdout.read().decode())

    print("\n=== Testing login ===")
    stdin, stdout, stderr = ssh.exec_command("curl -s -X POST https://tailtravel.westilt.com/api/v1/auth/test/login -H 'Content-Type: application/json' -d '{\"test_id\":\"1\"}'")
    login_res = json.loads(stdout.read().decode())
    token = login_res["data"]["access_token"]
    print(f"Token: {token[:30]}...")

    print("\n=== Creating member order ===")
    stdin, stdout, stderr = ssh.exec_command(f"curl -s -X POST https://tailtravel.westilt.com/api/v1/member/orders -H 'Authorization: Bearer {token}' -H 'Content-Type: application/json' -d '{{\"plan_id\":3}}'")
    order_res = json.loads(stdout.read().decode())
    order_id = order_res["data"]["order_id"]
    print(f"Order ID: {order_id}")

    print(f"\n=== Testing real pay for order {order_id} ===")
    stdin, stdout, stderr = ssh.exec_command(f"curl -s -X POST https://tailtravel.westilt.com/api/v1/member/orders/{order_id}/pay -H 'Authorization: Bearer {token}'")
    pay_res = stdout.read().decode()
    print(f"Pay response: {pay_res[:500]}")

    ssh.close()
    print("\nDone!")

if __name__ == "__main__":
    main()

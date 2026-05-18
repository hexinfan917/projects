import paramiko
import json

HOST = "101.43.50.236"
USER = "ubuntu"
KEY_FILE = "D:/projects/petway.pem"

def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, key_filename=KEY_FILE, timeout=15)

    print("=== Uploading docker-compose.yml ===")
    sftp = ssh.open_sftp()
    sftp.put("docker/prod/docker-compose.yml", "/opt/petway/docker/prod/docker-compose.yml")
    sftp.close()

    print("\n=== Building pay-service ===")
    stdin, stdout, stderr = ssh.exec_command("cd /opt/petway/docker/prod && sudo docker compose build --no-cache pay-service", timeout=180)
    out = stdout.read().decode()
    print(out[-1500:] if len(out) > 1500 else out)

    print("\n=== Starting pay-service ===")
    stdin, stdout, stderr = ssh.exec_command("cd /opt/petway/docker/prod && sudo docker compose up -d pay-service", timeout=60)
    print(stdout.read().decode())

    print("\n=== Checking status ===")
    stdin, stdout, stderr = ssh.exec_command("sudo docker ps --format 'table {{.Names}}\\t{{.Status}}' | grep pay")
    print(stdout.read().decode())

    print("\n=== Testing login ===")
    stdin, stdout, stderr = ssh.exec_command("curl -s -X POST https://tailtravel.westilt.com/api/v1/auth/test/login -H 'Content-Type: application/json' -d '{\"test_id\":\"1\"}'")
    login_res = stdout.read().decode()
    token = json.loads(login_res)["data"]["access_token"]
    print(f"Token: {token[:30]}...")

    print("\n=== Creating member order ===")
    stdin, stdout, stderr = ssh.exec_command(f"curl -s -X POST https://tailtravel.westilt.com/api/v1/member/orders -H 'Authorization: Bearer {token}' -H 'Content-Type: application/json' -d '{{\"plan_id\":3}}'")
    order_res = stdout.read().decode()
    print(f"Order response: {order_res[:200]}")
    order_id = json.loads(order_res)["data"]["order_id"]

    print(f"\n=== Testing pay for order {order_id} ===")
    stdin, stdout, stderr = ssh.exec_command(f"curl -s -X POST https://tailtravel.westilt.com/api/v1/member/orders/{order_id}/pay -H 'Authorization: Bearer {token}'")
    pay_res = stdout.read().decode()
    print(f"Pay response: {pay_res}")

    ssh.close()
    print("\nDone!")

if __name__ == "__main__":
    main()

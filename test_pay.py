import paramiko
import json

HOST = "101.43.50.236"
USER = "ubuntu"
KEY_FILE = "D:/projects/petway.pem"

def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, key_filename=KEY_FILE, timeout=15)

    print("=== Pay-service logs ===")
    stdin, stdout, stderr = ssh.exec_command("sudo docker logs petway-pay-service --tail 50")
    print(stdout.read().decode())

    print("\n=== Testing pay ===")
    stdin, stdout, stderr = ssh.exec_command("curl -s -X POST https://tailtravel.westilt.com/api/v1/auth/test/login -H 'Content-Type: application/json' -d '{\"test_id\":\"1\"}'")
    token = json.loads(stdout.read().decode())["data"]["access_token"]

    stdin, stdout, stderr = ssh.exec_command(f"curl -s -X POST https://tailtravel.westilt.com/api/v1/member/orders -H 'Authorization: Bearer {token}' -H 'Content-Type: application/json' -d '{{\"plan_id\":3}}'")
    order_id = json.loads(stdout.read().decode())["data"]["order_id"]

    stdin, stdout, stderr = ssh.exec_command(f"curl -s -X POST https://tailtravel.westilt.com/api/v1/member/orders/{order_id}/pay -H 'Authorization: Bearer {token}'")
    print(stdout.read().decode())

    ssh.close()

if __name__ == "__main__":
    main()

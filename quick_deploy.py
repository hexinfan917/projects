import paramiko
import os
import sys

HOST = "101.43.50.236"
USER = "ubuntu"
KEY_FILE = "D:/projects/petway.pem"
REMOTE_PATH = "/opt/petway"

def ssh_exec(ssh, cmd, timeout=120):
    print(f">>> {cmd}")
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=timeout, get_pty=True)
    out = stdout.read().decode('utf-8', errors='ignore')
    err = stderr.read().decode('utf-8', errors='ignore')
    if out.strip():
        print(out)
    if err.strip():
        print(err, file=sys.stderr)
    return out, err

def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f"Connecting to {HOST} as {USER}...")
    try:
        ssh.connect(HOST, username=USER, key_filename=KEY_FILE, timeout=15)
    except Exception as e:
        print(f"Connection failed: {e}")
        sys.exit(1)
    print("Connected!\n")

    sftp = ssh.open_sftp()

    # Upload modified files
    files_to_upload = [
        ("docker/prod/docker-compose.yml", f"{REMOTE_PATH}/docker/prod/docker-compose.yml"),
        ("backend/common/config.py", f"{REMOTE_PATH}/backend/common/config.py"),
        ("backend/file-service/main.py", f"{REMOTE_PATH}/backend/file-service/main.py"),
    ]

    print("=== Uploading modified files ===")
    for local, remote in files_to_upload:
        print(f"  {local} -> {remote}")
        sftp.put(local, remote)

    # Ensure .env exists with JWT_SECRET
    print("\n=== Checking .env ===")
    out, _ = ssh_exec(ssh, f"cat {REMOTE_PATH}/docker/.env 2>/dev/null | grep JWT_SECRET || echo 'MISSING'")
    if "MISSING" in out:
        print("Creating .env with JWT_SECRET...")
        ssh_exec(ssh, f"echo 'JWT_SECRET=petway_jwt_secret_key_2024_change_me_at_least_32_chars' | sudo tee -a {REMOTE_PATH}/docker/.env")

    # Rebuild and restart
    print("\n=== Rebuilding all services ===")
    ssh_exec(ssh, f"cd {REMOTE_PATH}/docker/prod && sudo docker compose down", timeout=60)
    ssh_exec(ssh, f"cd {REMOTE_PATH}/docker/prod && sudo docker compose up -d --build", timeout=300)

    # Check status
    print("\n=== Service Status ===")
    ssh_exec(ssh, "sudo docker ps --format 'table {{.Names}}\\t{{.Status}}\\t{{.Ports}}'")

    sftp.close()
    ssh.close()
    print("\nDeployment finished!")

if __name__ == "__main__":
    main()

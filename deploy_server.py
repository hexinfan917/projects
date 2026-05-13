import paramiko
import os
import sys
import tarfile
import io
import time

HOST = "101.43.50.236"
USER = "ubuntu"
KEY_FILE = "D:/projects/petway.pem"
REMOTE_PATH = "/opt/petway"
SOURCE_DIR = "D:/projects"

EXCLUDE_DIRS = {
    '.git', 'node_modules', 'venv', '.venv', '__pycache__',
    '.umi', '.umi-production', '.npm-cache', 'dist',
    'logs', '.cache', '.umi-test', 'coverage', '.turbo',
    'build', 'output', 'tmp', 'temp'
}

def ssh_exec(ssh, cmd, timeout=60):
    """Execute command with streaming output to avoid paramiko timeout on long ops"""
    print(f">>> {cmd}")
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=timeout, get_pty=True)
    out_lines = []
    err_lines = []
    
    while not stdout.channel.exit_status_ready():
        if stdout.channel.recv_ready():
            data = stdout.channel.recv(4096).decode('utf-8', errors='ignore')
            out_lines.append(data)
            print(data, end='')
        if stdout.channel.recv_stderr_ready():
            data = stdout.channel.recv_stderr(4096).decode('utf-8', errors='ignore')
            err_lines.append(data)
            print(data, end='', file=sys.stderr)
        time.sleep(0.3)
    
    # Drain remaining
    out_lines.append(stdout.read().decode('utf-8', errors='ignore'))
    err_lines.append(stderr.read().decode('utf-8', errors='ignore'))
    
    out = ''.join(out_lines)
    err = ''.join(err_lines)
    return out, err

def ssh_exec_simple(ssh, cmd, timeout=30):
    """Simple exec for short commands"""
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=timeout, get_pty=True)
    out = stdout.read().decode('utf-8', errors='ignore')
    err = stderr.read().decode('utf-8', errors='ignore')
    return out, err

def create_tarball(source_dir):
    print(f"Packing project code from: {source_dir}")
    buffer = io.BytesIO()
    count = 0
    with tarfile.open(fileobj=buffer, mode="w:gz") as tar:
        for root, dirs, files in os.walk(source_dir):
            dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS and not d.startswith('.')]
            for file in files:
                if file.endswith(('.log', '.pyc', '.pyo')) or file in EXCLUDE_DIRS:
                    continue
                filepath = os.path.join(root, file)
                arcname = os.path.relpath(filepath, source_dir).replace(chr(92), "/")
                tar.add(filepath, arcname=arcname)
                count += 1
                if count % 500 == 0:
                    print(f"  Added {count} files...")
    buffer.seek(0)
    size_mb = len(buffer.getvalue()) / (1024 * 1024)
    print(f"Tarball ready: {size_mb:.2f} MB, {count} files")
    return buffer

def wait_for_docker(ssh, max_wait=300):
    print("Waiting for Docker installation to complete...")
    for i in range(max_wait):
        out, _ = ssh_exec_simple(ssh, "docker --version 2>/dev/null")
        if "Docker version" in out:
            print("Docker is ready!")
            return True
        if i % 10 == 0:
            print(f"  still waiting... ({i}s)")
        time.sleep(1)
    return False

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

    # Step 1: Check env
    print("=== Step 1: Environment Check ===")
    out, _ = ssh_exec_simple(ssh, "cat /etc/os-release | grep -E '^(NAME|VERSION|ID)=' ")
    print(out.strip())
    out, _ = ssh_exec_simple(ssh, "docker --version 2>/dev/null || echo 'NEED_INSTALL'")
    docker_installed = "Docker version" in out

    # Step 2: Install Docker (background to avoid timeout)
    if not docker_installed:
        print("\n=== Step 2: Install Docker (background) ===")
        install_script = '''#!/bin/bash
set -e
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq apt-transport-https ca-certificates curl gnupg lsb-release
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://mirrors.aliyun.com/docker-ce/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg --yes
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://mirrors.aliyun.com/docker-ce/linux/ubuntu $(lsb_release -cs) stable" > /etc/apt/sources.list.d/docker.list
apt-get update -qq
apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker
usermod -aG docker ubuntu
echo "DOCKER_INSTALL_DONE" > /tmp/docker_install.status
'''
        remote_script = "/tmp/install_docker.sh"
        with sftp.file(remote_script, 'w') as f:
            f.write(install_script)
        ssh_exec_simple(ssh, f"chmod +x {remote_script}")
        print("Starting Docker install in background...")
        ssh_exec_simple(ssh, f"sudo nohup bash {remote_script} > /tmp/install_docker.log 2>&1 &")
        
        if not wait_for_docker(ssh, max_wait=300):
            print("Docker install failed or timed out. Check /tmp/install_docker.log")
            ssh.close()
            sys.exit(1)
    else:
        print("Docker already installed.")

    # Step 3: Upload code
    print("\n=== Step 3: Upload Project Code ===")
    ssh_exec(ssh, f"sudo mkdir -p {REMOTE_PATH} && sudo rm -rf {REMOTE_PATH}/*")
    ssh_exec(ssh, f"sudo chown -R $USER:$USER {REMOTE_PATH}")

    tarball = create_tarball(SOURCE_DIR)
    remote_tar = f"/home/{USER}/project.tar.gz"
    print(f"Uploading {len(tarball.getvalue())} bytes...")
    sftp.putfo(tarball, remote_tar)
    print("Upload done.")

    ssh_exec(ssh, f"tar -xzf {remote_tar} -C {REMOTE_PATH} && rm {remote_tar}")
    out, _ = ssh_exec_simple(ssh, f"ls -la {REMOTE_PATH}/ | head -15")
    print(out)

    # Step 4: Create .env
    print("\n=== Step 4: Configure Environment ===")
    env_content = """DB_ROOT_PASSWORD=Petway123
DB_USER=petway
DB_PASSWORD=Petway123
REDIS_PASSWORD=Petway123
JWT_SECRET=petway_jwt_secret_key_2024_change_me_at_least_32_chars
WECHAT_APPID=your_wechat_appid
WECHAT_APPSECRET=your_wechat_appsecret
OSS_ACCESS_KEY_ID=your_oss_key
OSS_ACCESS_KEY_SECRET=your_oss_secret
OSS_BUCKET=your_bucket
OSS_ENDPOINT=oss-cn-hangzhou.aliyuncs.com
"""
    with sftp.file(f"{REMOTE_PATH}/docker/.env", 'w') as f:
        f.write(env_content)
    print(".env created.")

    # Step 5: Build and start
    print("\n=== Step 5: Build & Start Services ===")
    ssh_exec(ssh, f"cd {REMOTE_PATH}/docker/prod && sudo docker compose down 2>/dev/null; sudo docker compose build --no-cache", timeout=300)
    ssh_exec(ssh, f"cd {REMOTE_PATH}/docker/prod && sudo docker compose up -d", timeout=60)

    # Step 6: Init database
    print("\n=== Step 6: Initialize Database ===")
    print("Waiting for MySQL...")
    for i in range(30):
        out, _ = ssh_exec_simple(ssh, f"sudo docker exec petway-mysql mysqladmin ping -h localhost -u root -pPetway123 2>/dev/null")
        if "mysqld is alive" in out:
            print("MySQL ready!")
            break
        time.sleep(2)
    else:
        print("MySQL not ready, checking logs...")
        ssh_exec_simple(ssh, "sudo docker logs petway-mysql --tail 20")

    ssh_exec(ssh, f"cd {REMOTE_PATH} && for f in database/migrations/*.sql; do echo \"Running $f...\"; sudo docker exec -i petway-mysql mysql -uroot -pPetway123 petway < \"$f\" 2>/dev/null || true; done", timeout=120)

    # Step 7: Status check
    print("\n=== Step 7: Service Status ===")
    out, _ = ssh_exec_simple(ssh, "sudo docker ps --format 'table {{.Names}}\\t{{.Status}}\\t{{.Ports}}'")
    print(out)
    out, _ = ssh_exec_simple(ssh, "curl -s -o /dev/null -w '%{http_code}' http://localhost:80/docs || echo 'Gateway not ready'")
    print(f"Gateway health check: {out.strip()}")

    sftp.close()
    ssh.close()
    print("\n====================")
    print("Deployment finished!")
    print("API Gateway: http://101.43.50.236/docs")
    print("====================")

if __name__ == "__main__":
    main()

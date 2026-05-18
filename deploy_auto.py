#!/usr/bin/env python3
"""
尾巴旅行 - 一键自动部署脚本
用法: python deploy_auto.py [--full]
  --full: 重新构建所有服务镜像（耗时较长，仅在代码有结构性变更时使用）
功能: 同步代码 → 重启服务 → 健康检查

部署策略:
- Gateway: 使用 volume 挂载代码，同步后重启容器即可生效
- 其他服务: 默认不重建，使用 --full 时才会重新构建镜像
"""
import paramiko
import os
import sys
import tarfile
import io
import time
import argparse

HOST = "101.43.50.236"
USER = "ubuntu"
KEY_FILE = "D:/projects/petway.pem"
REMOTE_PATH = "/opt/petway"
SOURCE_DIR = "D:/projects"

EXCLUDE_DIRS = {
    '.git', 'node_modules', 'venv', '.venv', '__pycache__',
    '.umi', '.umi-production', '.npm-cache', 'dist',
    'logs', '.cache', '.umi-test', 'coverage', '.turbo',
    'build', 'output', 'tmp', 'temp', '.swc'
}


def ssh_exec(ssh, cmd, timeout=120):
    """Execute command with streaming output"""
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
    
    out_lines.append(stdout.read().decode('utf-8', errors='ignore'))
    err_lines.append(stderr.read().decode('utf-8', errors='ignore'))
    
    out = ''.join(out_lines)
    err = ''.join(err_lines)
    exit_code = stdout.channel.exit_status
    return out, err, exit_code


def ssh_exec_simple(ssh, cmd, timeout=30):
    """Simple exec for short commands"""
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=timeout, get_pty=True)
    out = stdout.read().decode('utf-8', errors='ignore')
    err = stderr.read().decode('utf-8', errors='ignore')
    exit_code = stdout.channel.exit_status
    return out, err, exit_code


def create_tarball(source_dir):
    print(f"Packing backend code from: {source_dir}")
    buffer = io.BytesIO()
    count = 0
    # Only sync backend and docker directories
    sync_paths = ['backend', 'docker']
    with tarfile.open(fileobj=buffer, mode="w:gz") as tar:
        for subdir in sync_paths:
            full_path = os.path.join(source_dir, subdir)
            if not os.path.exists(full_path):
                continue
            for root, dirs, files in os.walk(full_path):
                dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS and not d.startswith('.')]
                for file in files:
                    if file.endswith(('.log', '.pyc', '.pyo')):
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


def health_check(ssh):
    """Check all services health (Docker mode compatible)"""
    print("\n=== Health Check ===")
    
    # In Docker mode, services don't expose ports to host directly.
    # Use docker exec to check health from inside containers.
    docker_checks = [
        ("Gateway", "sudo docker exec petway-gateway curl -s -o /dev/null -w '%{http_code}' http://localhost:8000/health || echo 'FAIL'"),
        ("User Service", "sudo docker exec petway-user-service curl -s -o /dev/null -w '%{http_code}' http://localhost:8000/health || echo 'FAIL'"),
        ("Route Service", "sudo docker exec petway-route-service curl -s -o /dev/null -w '%{http_code}' http://localhost:8000/health || echo 'FAIL'"),
        ("Order Service", "sudo docker exec petway-order-service curl -s -o /dev/null -w '%{http_code}' http://localhost:8000/health || echo 'FAIL'"),
        ("Content Service", "sudo docker exec petway-content-service curl -s -o /dev/null -w '%{http_code}' http://localhost:8000/health || echo 'FAIL'"),
        ("Pay Service", "sudo docker exec petway-pay-service curl -s -o /dev/null -w '%{http_code}' http://localhost:8000/health || echo 'FAIL'"),
        ("Map Service", "sudo docker exec petway-map-service curl -s -o /dev/null -w '%{http_code}' http://localhost:8000/health || echo 'FAIL'"),
        ("Message Service", "sudo docker exec petway-message-service curl -s -o /dev/null -w '%{http_code}' http://localhost:8000/health || echo 'FAIL'"),
        ("File Service", "sudo docker exec petway-file-service curl -s -o /dev/null -w '%{http_code}' http://localhost:8000/health || echo 'FAIL'"),
        ("Charity Service", "sudo docker exec petway-charity-service curl -s -o /dev/null -w '%{http_code}' http://localhost:8000/health || echo 'FAIL'"),
    ]
    
    all_ok = True
    for name, cmd in docker_checks:
        out, err, code = ssh_exec_simple(ssh, cmd)
        status = out.strip()
        if status in ('200', '401', '422'):
            print(f"  ✓ {name}: OK ({status})")
        else:
            print(f"  ✗ {name}: FAIL ({status})")
            all_ok = False
    
    # Check gateway routing from host (port 80 exposed)
    print("\n  Gateway routing check:")
    routing_checks = [
        ("Routes API", "curl -s 'http://localhost:80/api/v1/routes?page_size=1' | head -c 80"),
        ("Contents API", "curl -s 'http://localhost:80/api/v1/contents/banners' | head -c 80"),
        ("Admin Routes", "curl -s 'http://localhost:80/api/v1/admin/routes?page=1&page_size=1' | head -c 80"),
    ]
    for name, cmd in routing_checks:
        out, err, code = ssh_exec_simple(ssh, cmd)
        if '"code":500' in out or 'Service unavailable' in out:
            print(f"    ✗ {name}: 500 ERROR")
            all_ok = False
        elif out and out != 'FAIL':
            print(f"    ✓ {name}: OK")
        else:
            print(f"    ✗ {name}: FAIL")
            all_ok = False
    
    return all_ok


def main():
    parser = argparse.ArgumentParser(description='PetWay Auto Deploy')
    parser.add_argument('--full', action='store_true', help='Full rebuild of all service images')
    args = parser.parse_args()

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

    # Step 1: Upload code
    print("=== Step 1: Upload Backend Code ===")
    tarball = create_tarball(SOURCE_DIR)
    remote_tar = f"/home/{USER}/backend.tar.gz"
    print(f"Uploading {len(tarball.getvalue())} bytes...")
    sftp.putfo(tarball, remote_tar)
    print("Upload done.")

    # Extract to remote path
    ssh_exec(ssh, f"cd {REMOTE_PATH} && tar -xzf {remote_tar} && rm {remote_tar}", timeout=30)
    print("Code extracted.\n")

    # Step 1.5: Ensure .env file exists
    print("=== Step 1.5: Ensure .env file ===")
    env_path = f"{REMOTE_PATH}/docker/.env"
    try:
        sftp.stat(env_path)
        print("  .env exists, keeping existing config.")
    except FileNotFoundError:
        print("  .env not found, creating from example...")
        ssh_exec(ssh, f"cp {REMOTE_PATH}/docker/.env.example {env_path}")
        print("  Created .env from .env.example")
        print("  ⚠️  WARNING: Please edit .env and set real passwords/secrets!")

    # Step 2: Deploy
    compose_dir = f"{REMOTE_PATH}/docker/prod"
    
    if args.full:
        print("=== Step 2: Full Rebuild (all services) ===")
        print("  Stopping services...")
        ssh_exec(ssh, f"cd {compose_dir} && sudo docker compose down", timeout=60)
        print("  Building images...")
        out, err, code = ssh_exec(ssh, f"cd {compose_dir} && sudo docker compose build --no-cache", timeout=300)
        if code != 0:
            print(f"  Build failed! Exit code: {code}")
            print(err[-2000:] if len(err) > 2000 else err)
        print("  Starting services...")
        ssh_exec(ssh, f"cd {compose_dir} && sudo docker compose up -d", timeout=60)
    else:
        print("=== Step 2: Quick Deploy (gateway volume mount) ===")
        print("  Restarting gateway container...")
        ssh_exec(ssh, "sudo docker restart petway-gateway", timeout=30)
        print("  Waiting for gateway to be ready...")
        time.sleep(5)
        
        # Check if gateway is using correct routes
        out, _, _ = ssh_exec_simple(ssh, "sudo docker logs petway-gateway --tail 5 2>&1")
        if 'DOCKER' in out:
            print("  Gateway is running in DOCKER mode ✓")
        else:
            print("  Warning: Gateway mode unclear, checking...")
            print(out)

    # Step 3: Health check with retries
    print("\n=== Step 3: Health Check ===")
    max_retries = 5
    for i in range(max_retries):
        print(f"\n  Attempt {i+1}/{max_retries}...")
        if health_check(ssh):
            print("\n  ✅ All services are healthy!")
            break
        if i < max_retries - 1:
            print("  Waiting 5s before retry...")
            time.sleep(5)
    else:
        print("\n  ❌ Health check failed after all retries")
        print("  Checking gateway logs...")
        out, _, _ = ssh_exec_simple(ssh, "sudo docker logs petway-gateway --tail 20")
        print(out)
        sftp.close()
        ssh.close()
        sys.exit(1)

    # Step 4: Check container status
    print("\n=== Step 4: Container Status ===")
    out, _, _ = ssh_exec_simple(ssh, "sudo docker ps --format 'table {{.Names}}\\t{{.Status}}\\t{{.Ports}}'")
    print(out)

    sftp.close()
    ssh.close()
    print("\n" + "="*50)
    print("🎉 Deployment completed successfully!")
    print("="*50)
    print(f"API Gateway: http://{HOST}/docs")
    print(f"Admin Panel: https://tailtravel.westilt.com/admin/")
    if not args.full:
        print("\nNote: Only gateway was restarted. Use --full to rebuild all services.")


if __name__ == "__main__":
    main()

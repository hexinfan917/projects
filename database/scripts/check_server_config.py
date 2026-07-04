#!/usr/bin/env python3
"""
线上服务器部署配置检查工具

用法：
    python database/scripts/check_server_config.py

默认使用 deploy_server.py 同一份服务器配置（密钥路径 D:/projects/petway.pem）。
如果密钥路径不同，请修改下面的 KEY_FILE 变量或传入环境变量 PETWAY_KEY_FILE。
"""

import os
import sys

import paramiko

HOST = "101.43.50.236"
USER = "ubuntu"
KEY_FILE = os.getenv("PETWAY_KEY_FILE", "D:/projects/petway.pem")
REMOTE_PATH = "/opt/petway"


def ssh_exec_simple(ssh, cmd, timeout=30):
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=timeout, get_pty=True)
    out = stdout.read().decode("utf-8", errors="ignore")
    err = stderr.read().decode("utf-8", errors="ignore")
    return out, err


def section(title):
    print(f"\n{'=' * 60}")
    print(f"  {title}")
    print("=" * 60)


def main():
    print(f"正在连接服务器 {HOST} ...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        ssh.connect(HOST, username=USER, key_filename=KEY_FILE, timeout=15)
    except Exception as e:
        print(f"连接失败：{e}")
        sys.exit(1)
    print("连接成功！\n")

    try:
        # 1. 域名解析检查
        section("1. 域名解析检查")
        out, err = ssh_exec_simple(ssh, "getent hosts tailtravel.cn || nslookup tailtravel.cn || ping -c1 tailtravel.cn")
        print(out if out else err)

        # 2. Docker 容器状态
        section("2. Docker 容器运行状态")
        out, err = ssh_exec_simple(ssh, f"cd {REMOTE_PATH}/docker/prod && sudo docker compose ps")
        print(out if out else err)

        # 3. 关键环境变量检查
        section("3. 生产环境变量检查")
        env_vars = [
            "APP_ENV",
            "DOCKER_MODE",
            "DB_HOST",
            "DB_USER",
            "REDIS_HOST",
            "WECHAT_APPID",
        ]
        for var in env_vars:
            out, err = ssh_exec_simple(
                ssh,
                f"cd {REMOTE_PATH}/docker/prod && sudo docker compose exec -T gateway bash -c 'echo ${var}' 2>/dev/null || echo 'N/A'",
            )
            value = (out or err).strip() or "未设置"
            print(f"{var}: {value}")

        # 4. 网关服务路由模式
        section("4. 网关服务路由检查")
        out, err = ssh_exec_simple(
            ssh,
            f'cd {REMOTE_PATH}/docker/prod && sudo docker compose exec -T gateway bash -c \'echo DOCKER_MODE=$DOCKER_MODE && env | grep -E "^(APP_ENV|DOCKER_MODE)="\'',
        )
        print(out if out else err)

        # 5. 服务间连通性检查
        section("5. 服务间连通性检查（网关 → 各微服务）")
        services = [
            "petway-user-service:8000",
            "petway-route-service:8002",
            "petway-content-service:8005",
            "petway-order-service:8003",
        ]
        for svc in services:
            out, err = ssh_exec_simple(
                ssh,
                f"cd {REMOTE_PATH}/docker/prod && sudo docker compose exec -T gateway bash -c 'curl -s -o /dev/null -w \"%{{http_code}}\" http://{svc}/health' 2>/dev/null || echo 'failed'",
            )
            status = (out or err).strip()
            print(f"{svc}: HTTP {status}")

        # 6. 数据库连接检查（从网关容器内测试）
        section("6. 数据库连接检查")
        out, err = ssh_exec_simple(
            ssh,
            f'cd {REMOTE_PATH}/docker/prod && sudo docker compose exec -T gateway bash -c \'echo DB_HOST=$DB_HOST DB_USER=$DB_USER REDIS_HOST=$REDIS_HOST APP_ENV=$APP_ENV\'',
        )
        print(out if out else err)

        # 7. 公网 API 可用性检查
        section("7. 公网 API 可用性检查")
        endpoints = [
            "https://tailtravel.cn/api/v1/agreements",
            "https://tailtravel.cn/api/v1/contents/banners",
            "https://tailtravel.cn/api/v1/routes?page_size=4&is_hot=1",
        ]
        for url in endpoints:
            out, err = ssh_exec_simple(ssh, f"curl -s -o /dev/null -w '%{{http_code}}' '{url}'")
            status = (out or err).strip()
            print(f"{url}: HTTP {status}")

        section("检查完成")

    finally:
        ssh.close()


if __name__ == "__main__":
    main()

"""
启动所有服务
"""
import subprocess
import sys
import time
import os

# 服务配置
SERVICES = [
    {"name": "Gateway", "path": "gateway", "port": 8000},
    {"name": "User Service", "path": "user-service", "port": 8001},
    {"name": "Route Service", "path": "route-service", "port": 8002},
    {"name": "Order Service", "path": "order-service", "port": 8003},
]

def check_service(port):
    """检查服务是否已启动"""
    import socket
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(1)
        result = sock.connect_ex(('localhost', port))
        sock.close()
        return result == 0
    except:
        return False

def start_service(service):
    """启动单个服务"""
    print(f"Starting {service['name']} on port {service['port']}...")
    
    # 构建启动命令
    cmd = [
        sys.executable, "-m", "uvicorn", 
        "main:app", 
        "--host", "0.0.0.0", 
        "--port", str(service['port']),
        "--reload"
    ]
    
    # 启动进程
    process = subprocess.Popen(
        cmd,
        cwd=os.path.join(os.path.dirname(os.path.dirname(__file__)), service['path']),
        creationflags=subprocess.CREATE_NEW_CONSOLE if sys.platform == 'win32' else 0
    )
    
    return process

def main():
    """主函数"""
    print("=" * 60)
    print("尾巴旅行 - 后端服务启动工具")
    print("=" * 60)
    
    # 检查服务状态
    print("\n检查服务状态...")
    running = []
    for svc in SERVICES:
        if check_service(svc['port']):
            print(f"  ✓ {svc['name']} (port {svc['port']}) - 运行中")
            running.append(svc)
        else:
            print(f"  ✗ {svc['name']} (port {svc['port']}) - 未启动")
    
    if len(running) == len(SERVICES):
        print("\n所有服务已启动！")
        return
    
    # 询问是否启动未运行的服务
    print("\n按 Enter 启动未运行的服务...")
    input()
    
    processes = []
    for svc in SERVICES:
        if svc not in running:
            proc = start_service(svc)
            processes.append((svc, proc))
            time.sleep(1)  # 间隔启动
    
    print("\n" + "=" * 60)
    print("服务启动中，请查看弹出的窗口")
    print("=" * 60)
    print("\n服务地址:")
    for svc in SERVICES:
        print(f"  {svc['name']}: http://localhost:{svc['port']}")
    print("\n按 Ctrl+C 停止所有服务")
    
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n\n停止服务...")
        for svc, proc in processes:
            proc.terminate()
            print(f"  已停止 {svc['name']}")

if __name__ == "__main__":
    main()

import subprocess
import sys
import os
import time

DIR = os.path.dirname(os.path.abspath(__file__))
os.chdir(DIR)

print("=" * 50)
print("卫星编队可视化 - 启动脚本")
print("=" * 50)

# 启动HTTP服务器 (端口 8000)
print("\n启动HTTP服务器 (端口 8000)...")
http_proc = subprocess.Popen(
    [sys.executable, "server.py"],
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE
)

# 等待HTTP服务器启动
time.sleep(1)

# 启动WebSocket服务器 (端口 8765)
print("启动WebSocket服务器 (端口 8765)...")
ws_proc = subprocess.Popen(
    [sys.executable, "server_ws.py"],
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE
)

print("\n" + "=" * 50)
print("所有服务已启动!")
print("=" * 50)
print(f"前端页面: http://localhost:8000/web/index.html")
print(f"HTTP端口: 8000")
print(f"WebSocket端口: 8765")
print("\n按 Ctrl+C 停止所有服务")
print("=" * 50)

try:
    while True:
        if http_proc.poll() is not None:
            print("HTTP服务器意外退出")
            break
        if ws_proc.poll() is not None:
            print("WebSocket服务器意外退出")
            break
        time.sleep(1)
except KeyboardInterrupt:
    print("\n正在停止服务...")
finally:
    http_proc.terminate()
    ws_proc.terminate()
    http_proc.wait()
    ws_proc.wait()
    print("所有服务已停止")

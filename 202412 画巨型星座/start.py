import subprocess
import sys
import os
import time
import threading
import http.server
import socketserver

# 导入 CSV API 服务
from api_csv import start_csv_api

DIR = os.path.dirname(os.path.abspath(__file__))
os.chdir(DIR)

print("=" * 50)
print("卫星编队可视化 - 启动脚本")
print("=" * 50)

# ======================== 多线程 HTTP 服务器 ========================
class ThreadedHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    allow_reuse_address = True
    daemon_threads = True  # 确保线程在退出时被清理

class CacheControlHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        # Serve from project root so /web/index.html works
        super().__init__(*args, directory=DIR, **kwargs)

    def end_headers(self):
        # 禁用浏览器缓存，确保刷新时拿到最新代码
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, format, *args):
        # 简化日志输出
        print(f"[HTTP] {args[0]}")

def start_http_server(port=8000):
    httpd = ThreadedHTTPServer(("", port), CacheControlHandler)
    print(f"HTTP服务器已启动: http://localhost:{port}")
    print(f"访问地址: http://localhost:{port}/web/index.html")
    try:
        httpd.serve_forever()
    except Exception as e:
        print(f"HTTP服务器错误: {e}")

# ======================== 启动服务 ========================

# 在后台线程启动 HTTP 服务器
http_thread = threading.Thread(target=start_http_server, args=(8000,), daemon=True)
http_thread.start()

# 等待HTTP服务器启动
time.sleep(0.5)

# 在后台线程启动 CSV API 服务（端口 8080）
csv_api_thread = threading.Thread(target=start_csv_api, daemon=True)
csv_api_thread.start()

# 等待CSV API 服务启动
time.sleep(0.5)

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
print(f"HTTP端口:   8000 (前端静态资源)")
print(f"CSV API:    8080 (CSV 预处理 API)")
print(f"WebSocket:  8765 (实时轨道递推)")
print("\n按 Ctrl+C 停止所有服务")
print("=" * 50)

try:
    while True:
        if ws_proc.poll() is not None:
            print("WebSocket服务器意外退出")
            break
        time.sleep(1)
except KeyboardInterrupt:
    print("\n正在停止服务...")
finally:
    ws_proc.terminate()
    ws_proc.wait()
    print("所有服务已停止")


# TODO: 定义卫星上行协议格式（载荷、校验、时序控制），见项目 issue tracker
# 协议需求：
# - 给每颗卫星发送的指令格式
# - 校验机制
# - 亮灭时间控制

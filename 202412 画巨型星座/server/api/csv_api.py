"""
CSV API 处理器

⚠️ 已废弃 (DEPRECATED) - 2026-04-20
此文件已被 `server/fastapi_app/routes/csv.py` 替代。
保留仅用于向后兼容 `main.py` 旧入口点。
新入口点请使用 `main_fastapi.py`。

提供 HTTP API 用于 CSV 数据查询和下载。
"""

from __future__ import annotations
import json
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from typing import Optional

from ..services.csv_service import CsvService


class CsvApiHandler(BaseHTTPRequestHandler):
    """
    CSV 数据 API 处理器。

    端点：
    - GET /api/csv-data   - 获取完整 CSV 数据
    - GET /api/csv-info   - 获取 CSV 元信息
    - GET /api/csv-range?start=0&end=100 - 获取指定范围数据
    """

    _csv_service: Optional[CsvService] = None

    @classmethod
    def set_csv_service(cls, service: CsvService) -> None:
        """设置 CSV 服务实例"""
        cls._csv_service = service

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)

        if parsed.path == "/api/csv-data":
            self._handle_csv_data(params)
        elif parsed.path == "/api/csv-info":
            self._handle_csv_info()
        elif parsed.path == "/api/csv-range":
            self._handle_csv_range(params)
        else:
            self._send_error(404, "Not Found")

    def do_OPTIONS(self) -> None:
        """处理 CORS 预检请求"""
        self.send_response(200)
        self._add_cors_headers()
        self.end_headers()

    def _add_cors_headers(self) -> None:
        """添加 CORS 头"""
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _handle_csv_data(self, params: dict) -> None:
        """返回完整 CSV 数据"""
        if self._csv_service is None or not self._csv_service.is_loaded:
            self._send_error(503, "CSV 数据未加载")
            return

        try:
            fmt = params.get("format", ["compact"])[0]
            data = self._csv_service.get_full_data(fmt)
            self._send_json(data)
        except ValueError as e:
            self._send_error(400, str(e))

    def _handle_csv_info(self) -> None:
        """返回 CSV 元信息"""
        if self._csv_service is None or not self._csv_service.is_loaded:
            self._send_error(503, "CSV 数据未加载")
            return

        info = self._csv_service.get_info()
        self._send_json(info)

    def _handle_csv_range(self, params: dict) -> None:
        """返回指定时间范围的数据"""
        if self._csv_service is None or not self._csv_service.is_loaded:
            self._send_error(503, "CSV 数据未加载")
            return

        try:
            start = int(params.get("start", ["0"])[0])
            end = int(params.get("end", [str(len(self._csv_service.meta.total_timestamps))])[0])
            data = self._csv_service.get_range(start, end)
            self._send_json(data)
        except (ValueError, IndexError) as e:
            self._send_error(400, f"参数错误: {e}")

    def _send_json(self, data: dict) -> None:
        """发送 JSON 响应"""
        json_bytes = self._csv_service.compress_json(data)

        self.send_response(200)
        self._add_cors_headers()

        if len(json_bytes) != len(json.dumps(data, separators=(",", ":")).encode("utf-8")):
            self.send_header("Content-Encoding", "gzip")

        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", len(json_bytes))
        self.end_headers()
        self.wfile.write(json_bytes)

    def _send_error(self, code: int, message: str) -> None:
        """发送错误响应"""
        self.send_response(code)
        self._add_cors_headers()
        self.send_header("Content-Type", "application/json")
        body = json.dumps({"error": message, "code": code}).encode("utf-8")
        self.send_header("Content-Length", len(body))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format: str, *args) -> None:
        """简化日志输出"""
        print(f"[CSV-API] {args[0]}")

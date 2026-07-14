"""
FastAPI WebSocket 模块

整合 WebSocket 服务到 FastAPI 应用，替代独立的 websockets 服务器。
"""

from .manager import ConnectionManager

__all__ = ["ConnectionManager"]

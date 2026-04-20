"""
FastAPI WebSocket 路由

提供 /ws 端点处理 WebSocket 连接。
"""

from __future__ import annotations
import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from .manager import ConnectionManager

router = APIRouter()


@router.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    """
    WebSocket 连接端点。

    每个客户端通过 /ws/{client_id} 连接，获得独立的计算会话。
    消息收发由 ClientSession._push_loop 处理。
    """
    manager: ConnectionManager = websocket.scope["app"].state.ws_manager
    if manager is None:
        await websocket.close(code=1011, reason="WebSocket 服务未初始化")
        return

    session = await manager.connect(websocket, client_id)
    if session is None:
        return

    try:
        await session.start()
        # session._push_loop 负责发送数据和接收消息
        # 这里只等待推送循环结束（客户端断开或服务停止）
        if session.push_task:
            await session.push_task
    except WebSocketDisconnect:
        print(f"[WS-Router] 客户端 {client_id} 断开连接")
    except asyncio.CancelledError:
        print(f"[WS-Router] 客户端 {client_id} 任务取消")
    except Exception as e:
        print(f"[WS-Router] 客户端 {client_id} 异常: {e}")
    finally:
        await manager.disconnect(client_id)


@router.get("/ws/stats")
async def get_ws_stats():
    """获取 WebSocket 服务统计信息"""
    # This is an HTTP endpoint, accessed via regular request
    # We need to get the manager from app state via dependency
    from fastapi import Request
    # For HTTP endpoints in the same router, we can't access app.state directly
    # Return a placeholder; stats can be accessed via app.state.ws_manager
    return {"status": "ok", "note": "Use app.state.ws_manager for stats"}

"""
服务端主入口 - 多客户端版本

使用示例:
    python server_main.py

功能:
- 创建 WsService 实例
- 每个客户端拥有独立的 PropagationService
- 支持最多 10 个并发客户端
"""

import asyncio
import sys
import os

# 添加项目根目录到路径
DIR = os.path.dirname(os.path.abspath(__file__))
os.chdir(DIR)
if DIR not in sys.path:
    sys.path.insert(0, DIR)

from server.services import WsService, PropagationService
from server.core import Constellation
from server.propagators import PerturbedOrbitPropagator
from server.infrastructure import RingBuffer
from server.config import AppConfig, ConstellationSetup


def create_propagation_service() -> PropagationService:
    """
    创建独立的 PropagationService 实例。
    
    每个客户端调用此函数创建独立实例，互不干扰。
    """
    try:
        # 加载配置
        config = AppConfig.load(os.path.join(DIR, 'config', 'default.yaml'))
        
        # 创建星座设置
        setup = ConstellationSetup(config)
        
        # 创建星座实例
        constellation = setup.create_constellation()
        
        # 创建推进器
        propagator = PerturbedOrbitPropagator()
        
        # 创建缓冲区
        buffer = RingBuffer(capacity=3600)
        
        # 创建服务
        return PropagationService(
            constellation=constellation,
            propagator=propagator,
            buffer=buffer,
        )
        
    except Exception as e:
        print(f"[ERROR] 创建 PropagationService 失败: {e}")
        raise


async def main():
    """主入口"""
    print("=" * 70)
    print("巨型星座 3D 可视化系统 - WebSocket 服务端")
    print("多客户端版本（每个客户端独立计算）")
    print("=" * 70)
    print()
    
    # 测试创建服务工厂
    print("[INIT] 测试创建 PropagationService...")
    try:
        test_service = create_propagation_service()
        print(f"[INIT] 测试成功: step={test_service.current_step}, state={test_service.state.value}")
        del test_service  # 释放测试实例
    except Exception as e:
        print(f"[ERROR] 测试失败: {e}")
        return 1
    
    # 创建 WsService
    print("[INIT] 创建 WsService...")
    ws_service = WsService(
        propagation_service_factory=create_propagation_service,
        host="0.0.0.0",
        port=8765,
    )
    
    # 启动服务
    try:
        await ws_service.start()
        print("[INIT] 服务已启动，等待客户端连接...")
        print("[INIT] 按 Ctrl+C 停止服务")
        print()
        
        # 保持运行
        while ws_service.is_running:
            await asyncio.sleep(1)
            
    except KeyboardInterrupt:
        print("\n[SHUTDOWN] 收到停止信号...")
    except Exception as e:
        print(f"\n[ERROR] 服务异常: {e}")
        import traceback
        traceback.print_exc()
        return 1
    finally:
        await ws_service.stop()
        print("[SHUTDOWN] 服务已停止")
        
    return 0


if __name__ == "__main__":
    try:
        exit_code = asyncio.run(main())
        sys.exit(exit_code)
    except Exception as e:
        print(f"[FATAL] 程序异常退出: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

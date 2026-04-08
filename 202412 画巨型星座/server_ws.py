import asyncio
import json
import time
import websockets
import numpy as np
from propagate_stream import StreamPropagator

PORT = 8765
INITIAL_PUSH = 30  # 首次推送30秒
COMPUTE_INTERVAL = 10  # 每计算10步推送一次
PUSH_INTERVAL = 10  # 推送间隔（秒），与前端消费速率同步

async def handler(websocket):
    print(f"客户端连接: {websocket.remote_address}")
    propagator = StreamPropagator(buffer_capacity=3600)
    propagator.is_running = True
    
    try:
        # JIT 预热
        print("JIT 预热中...")
        propagator.compute_step()
        propagator.buffer.pop_front(1)  # 丢弃预热数据
        propagator.current_step = 0
        propagator.sateOEmat = propagator.sateOEmat.copy()  # 重置状态
        print("JIT 预热完成")
        
        # 预计算30秒
        print("预计算30秒数据...")
        for _ in range(INITIAL_PUSH):
            while propagator.buffer.is_full():
                await asyncio.sleep(0.1)
            propagator.compute_step()
        print("预计算完成，开始推送")
        
        # 首次推送30秒
        data = propagator.get_and_pop(INITIAL_PUSH)
        data_list = [step.tolist() for step in data]
        await websocket.send(json.dumps({
            "type": "data",
            "data": data_list,
            "is_first": True
        }))
        
        # 后续推送循环
        while propagator.is_running:
            cycle_start = time.time()
            
            # 计算10步
            for _ in range(COMPUTE_INTERVAL):
                while propagator.buffer.is_full():
                    await asyncio.sleep(0.1)
                if not propagator.is_running:
                    break
                propagator.compute_step()
            
            if not propagator.is_running:
                break
            
            # 推送新计算的10秒数据
            data = propagator.get_and_pop(COMPUTE_INTERVAL)
            if data:
                data_list = [step.tolist() for step in data]
                await websocket.send(json.dumps({
                    "type": "data",
                    "data": data_list,
                    "is_first": False
                }))
            
            # FIX: 等待到推送周期结束，确保推送频率与前端消费同步
            elapsed = time.time() - cycle_start
            if elapsed < PUSH_INTERVAL:
                await asyncio.sleep(PUSH_INTERVAL - elapsed)
            
            # 接收控制指令（非阻塞）
            try:
                msg = await asyncio.wait_for(websocket.recv(), timeout=0.01)
                cmd = json.loads(msg)
                if cmd.get('type') == 'command':
                    if cmd['cmd'] == 'stop':
                        propagator.is_paused = True
                        print("收到停止指令，暂停计算")
                    elif cmd['cmd'] == 'pause':
                        propagator.is_paused = True
                        print("收到暂停指令")
                    elif cmd['cmd'] == 'resume':
                        propagator.is_paused = False
                        propagator.is_running = True
                        print("收到恢复指令")
            except asyncio.TimeoutError:
                pass
            except websockets.exceptions.ConnectionClosed:
                print("客户端断开连接")
                propagator.is_running = False
                break
            
            # 如果暂停，等待
            while propagator.is_paused and propagator.is_running:
                await asyncio.sleep(0.1)
    
    except websockets.exceptions.ConnectionClosed:
        print("客户端断开连接")
    finally:
        propagator.is_running = False
        print("计算引擎已停止")

async def main():
    print(f"WebSocket服务器启动: ws://localhost:{PORT}")
    async with websockets.serve(handler, "0.0.0.0", PORT):
        await asyncio.Future()

if __name__ == "__main__":
    asyncio.run(main())

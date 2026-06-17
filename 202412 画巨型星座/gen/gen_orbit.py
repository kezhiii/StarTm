# -*- coding: utf-8 -*-
"""
轨道递推生成器

使用已有的轨道递推模块计算卫星轨道，并保存为CSV格式。
输出格式与 test_1.csv 一致：
timestamp,sat_id,a,e,i,OMG,omg,f,X,Y,Z,Vx,Vy,Vz
"""

import os
import sys

# 添加项目根目录到路径
DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if DIR not in sys.path:
    sys.path.insert(0, DIR)

import numpy as np
from server.core import Constellation
from server.propagators import PerturbedOrbitPropagator


def generate_csv(
    center_oe_path: str,
    deputy_oe_path: str,
    output_path: str,
    duration_seconds: int = 3600,
    dt: float = 1.0,
    start_timestamp: str = "20210817053300"
):
    """
    生成轨道递推CSV文件。
    
    Args:
        center_oe_path: 主星轨道根数文件路径
        deputy_oe_path: 从星轨道根数文件路径
        output_path: 输出CSV文件路径
        duration_seconds: 递推时长（秒）
        dt: 时间步长（秒）
        start_timestamp: 起始时间戳
    """
    print(f"[Gen] 加载轨道根数...")
    print(f"  主星: {center_oe_path}")
    print(f"  从星: {deputy_oe_path}")
    
    # 创建星座
    constellation = Constellation.from_input_files(center_oe_path, deputy_oe_path)
    print(f"[Gen] 星座创建成功: {constellation.sat_count} 颗卫星")
    
    # 创建推进器
    propagator = PerturbedOrbitPropagator()
    print(f"[Gen] 推进器: {propagator.get_name()}")
    
    # 计算时间戳
    def seconds_to_timestamp(base_ts: str, offset_seconds: int) -> str:
        """将基础时间戳加上秒偏移"""
        # 解析基础时间戳
        year = int(base_ts[0:4])
        month = int(base_ts[4:6])
        day = int(base_ts[6:8])
        hour = int(base_ts[8:10])
        minute = int(base_ts[10:12])
        second = int(base_ts[12:14])
        
        # 加上偏移
        total_seconds = hour * 3600 + minute * 60 + second + offset_seconds
        days_offset = total_seconds // 86400
        remaining_seconds = total_seconds % 86400
        
        hour = remaining_seconds // 3600
        minute = (remaining_seconds % 3600) // 60
        second = remaining_seconds % 60
        
        day += days_offset
        
        # 简化处理：假设每月30天
        while day > 30:
            day -= 30
            month += 1
            if month > 12:
                month = 1
                year += 1
        
        return f"{year}{month:02d}{day:02d}{hour:02d}{minute:02d}{second:02d}"
    
    # 打开输出文件
    save_interval = 60  # 每60秒保存一次
    print(f"[Gen] 开始递推: {duration_seconds} 秒, dt={dt} 秒, 保存间隔={save_interval} 秒")
    print(f"[Gen] 输出文件: {output_path}")
    
    with open(output_path, 'w', encoding='utf-8') as f:
        # 写入表头
        f.write("timestamp,sat_id,a,e,i,OMG,omg,f,X,Y,Z,Vx,Vy,Vz\n")
        
        # 先递推一步计算初始惯性状态
        constellation = propagator.propagate_constellation(constellation, dt, 0)
        
        # 递推
        for step in range(duration_seconds):
            # 每save_interval秒保存一次
            if step % save_interval == 0:
                # 计算当前时间戳
                timestamp = seconds_to_timestamp(start_timestamp, step)
                
                # 获取当前星座快照
                snapshot = constellation.get_snapshot(timestamp)
                snapshot.seconds = step
                
                # 写入CSV
                for snap in snapshot.satellites:
                    oe = snap.orbit_elements
                    pos = snap.position
                    vel = snap.velocity
                    line = f"{timestamp},{snap.sat_id},{oe[0]},{oe[1]},{oe[2]},{oe[3]},{oe[4]},{oe[5]},{pos[0]},{pos[1]},{pos[2]},{vel[0]},{vel[1]},{vel[2]}\n"
                    f.write(line)
            
            # 递推一步
            constellation = propagator.propagate_constellation(constellation, dt, step + 1)
            
            # 进度显示
            if (step + 1) % 600 == 0:
                print(f"  已完成: {step + 1}/{duration_seconds} 秒")
    
    print(f"[Gen] 递推完成！")
    print(f"[Gen] 输出文件: {output_path}")
    
    # 统计文件大小
    file_size = os.path.getsize(output_path)
    print(f"[Gen] 文件大小: {file_size / 1024:.1f} KB")


if __name__ == "__main__":
    # 默认参数
    input_dir = os.path.join(DIR, "Input")
    output_dir = os.path.join(DIR, "Output")
    
    # 确保输出目录存在
    os.makedirs(output_dir, exist_ok=True)
    
    # 生成CSV
    generate_csv(
        center_oe_path=os.path.join(input_dir, "hexagonal_4layers_centerOEmat.txt"),
        deputy_oe_path=os.path.join(input_dir, "hexagonal_4layers_deputyOEmat.txt"),
        output_path=os.path.join(output_dir, "generated.csv"),
        duration_seconds=7200,  # 1小时
        dt=1.0,  # 1秒步长
        start_timestamp="20210817053300"
    )

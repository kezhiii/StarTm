# -*- coding: utf-8 -*-
"""
轨道根数转换脚本
读取 deputyOEmat.txt，将真近点角 f 转换为平近点角 M，保存为 CSV 格式
"""

import numpy as np
from pathlib import Path


def f_To_M(e, f_deg):
    """
    真近点角 f (deg) -> 平近点角 M (deg)
    
    参数:
        e: 偏心率
        f_deg: 真近点角 (度)
    
    返回:
        M_deg: 平近点角 (度), 范围 [0, 360)
    """
    f = np.radians(f_deg)
    E = 2 * np.arctan2(np.sqrt(1 - e) * np.sin(f / 2),
                        np.sqrt(1 + e) * np.cos(f / 2))
    M = E - e * np.sin(E)
    M_deg = np.degrees(M) % 360  # 确保范围在 [0, 360)
    return M_deg


def convert_to_csv(input_path, output_path):
    """
    读取轨道根数文件，转换 f -> M，保存为 CSV
    
    输入格式: 6行 × N列 (a, e, i, OMG, omg, f)
    输出格式: CSV (sat_id, a, e, i, OMG, omg, M)
    """
    print(f"读取文件: {input_path}")
    
    # 读取数据
    data = np.loadtxt(input_path)
    n_sats = data.shape[1]
    print(f"卫星数量: {n_sats}")
    
    # 转换 f -> M (第6行，索引5)
    for j in range(n_sats):
        e = data[1, j]  # 偏心率
        f = data[5, j]  # 真近点角 (deg)
        data[5, j] = f_To_M(e, f)  # 转换为平近点角 (deg)
    
    # 将角度范围调整为 0-360
    for j in range(n_sats):
        data[2, j] = data[2, j] % 360  # i (倾角)
        data[3, j] = data[3, j] % 360  # OMG (升交点赤经)
        data[4, j] = data[4, j] % 360  # omg (近地点幅角)
        data[5, j] = data[5, j] % 360  # M (平近点角)
    
    # 保存为CSV
    print(f"保存文件: {output_path}")
    with open(output_path, 'w', encoding='utf-8') as f:
        # 写入表头
        f.write("sat_id,a,e,i,OMG,omg,M\n")
        # 写入数据
        for j in range(n_sats):
            row = [j] + data[:, j].tolist()
            f.write(",".join(f"{v:.2f}" for v in row) + "\n")
    
    print(f"转换完成！共 {n_sats} 颗卫星")


if __name__ == "__main__":
    # 路径配置
    base_dir = Path(__file__).resolve().parent.parent
    input_dir = base_dir / "Input"
    output_dir = base_dir / "Output"
    
    # 确保输出目录存在
    output_dir.mkdir(exist_ok=True)
    
    # 转换 hexagonal_3layers_deputyOEmat.txt
    convert_to_csv(
        input_dir / "hexagonal_3layers_deputyOEmat.txt",
        output_dir / "hexagonal_3layers_M_360.csv"
    )

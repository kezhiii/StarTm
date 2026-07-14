# -*- coding: utf-8 -*-
"""
矩形编队生成器 (Hill坐标系直接控制)
卫星按矩形网格排列在 y-z 平面 (沿轨-法向)
"""

import numpy as np
from pathlib import Path

# ========== 主星轨道根数 ==========
center_OE_original = np.array([
    6.878132147e+03,  # a (km)
    0.000000000e+00,  # e
    3.000000000e+01,  # i (deg)
    -1.532244000e+00, # OMG (deg)
    4.680493740e+02,  # omg (deg)
    9.382887800e+01   # f (deg)
])


def to_m_rad(oe_km_deg):
    """km, deg -> m, rad"""
    oe = oe_km_deg.copy()
    oe[0] = oe[0] * 1000.0
    oe[2:] = np.radians(oe[2:])
    return oe


def to_km_deg(oe_m_rad):
    """m, rad -> km, deg"""
    oe = oe_m_rad.copy()
    oe[0] = oe[0] / 1000.0
    oe[2:] = np.degrees(oe[2:])
    return oe


def f_To_M(e, f):
    """真近点角 -> 平近点角"""
    E = 2 * np.arctan2(np.sqrt(1 - e) * np.sin(f / 2),
                        np.sqrt(1 + e) * np.cos(f / 2))
    M = E - e * np.sin(E)
    return M


def M_To_f(e, M):
    """平近点角 -> 真近点角"""
    E = M
    for _ in range(50):
        dE = (M - (E - e * np.sin(E))) / (1 - e * np.cos(E))
        E += dE
        if abs(dE) < 1e-15:
            break
    f = 2 * np.arctan2(np.sqrt(1 + e) * np.sin(E / 2),
                        np.sqrt(1 - e) * np.cos(E / 2))
    return f


def hill_to_doe(centerOE, y_m, z_m, u_arg=None):
    """
    Hill坐标偏移 -> 轨道根数偏差
    
    Hill坐标系:
    - x: 径向 (指向地心)
    - y: 沿轨方向 (运动方向)
    - z: 法向方向 (垂直轨道平面)
    
    对于近圆轨道:
    - y (沿轨) ≈ a * dM (平近点角差)
    - z (法向) ≈ a * di * sin(u) (倾角差 × 纬度幅角正弦)
    """
    a = centerOE[0]  # m
    
    # 沿轨偏移: y = a * dM
    dM = y_m / a  # rad
    
    # 法向偏移: z = a * di * sin(u)
    if u_arg is None:
        u = centerOE[4] + centerOE[5]
    else:
        u = u_arg
    sin_u = np.sin(u)
    
    if abs(sin_u) < 0.01:
        print(f"  [警告] sin(u)={sin_u:.4f} 接近零，法向偏移无法实现")
        di = 0
    else:
        di = z_m / (a * sin_u)  # rad，补偿 sin(u) 因子
    
    da = 0
    de = 0
    dOMG = 0
    domg = 0
    
    return np.array([da, de, di, dOMG, domg, dM])


def generate_rectangular_formation(n_satellites, spacing_y=2000, spacing_z=2000):
    """
    生成正方形编队 (y-z平面)
    
    参数:
        n_satellites: 总卫星数
        spacing_y: 沿轨方向间距 (米)
        spacing_z: 法向方向间距 (米)
    """
    # 计算网格尺寸 (尽量接近正方形)
    side = int(np.sqrt(n_satellites))
    rows = side
    cols = side
    
    # 调整确保总数匹配
    while rows * cols < n_satellites:
        cols += 1
    
    # 主星
    centerOE = to_m_rad(center_OE_original)
    
    # 在 f→M 转换前计算纬度幅角 u = ω + f
    u_arg = centerOE[4] + centerOE[5]  # ω + f (rad)
    print(f"  纬度幅角 u = ω + f = {np.degrees(u_arg) % 360:.1f}°, sin(u) = {np.sin(u_arg):.4f}")
    
    centerOE[5] = f_To_M(centerOE[1], centerOE[5])
    
    deputies = []
    sat_count = 0
    
    for row in range(rows):
        for col in range(cols):
            if sat_count >= n_satellites:
                break
            
            # 计算网格位置 (中心为原点)
            y_idx = col - (cols - 1) / 2.0
            z_idx = row - (rows - 1) / 2.0
            
            # Hill坐标偏移 (米)
            y_m = y_idx * spacing_y  # 沿轨
            z_m = z_idx * spacing_z  # 法向
            
            # 转换为轨道根数偏差 (传入精确纬度幅角)
            dOE = hill_to_doe(centerOE, y_m, z_m, u_arg=u_arg)
            
            # 从星轨道根数
            deputyOE = centerOE + dOE
            
            # M -> f
            deputyOE[5] = M_To_f(deputyOE[1], deputyOE[5])
            
            deputies.append(deputyOE)
            sat_count += 1
    
    deputy_matrix = np.array(deputies, dtype=float).T
    
    # 转换为 km, deg
    center_km_deg = to_km_deg(centerOE)
    deputy_km_deg = np.zeros_like(deputy_matrix)
    for i in range(deputy_matrix.shape[1]):
        deputy_km_deg[:, i] = to_km_deg(deputy_matrix[:, i])
    
    return center_km_deg, deputy_km_deg, rows, cols


def save_formation(center, deputy, prefix="generated"):
    """保存编队"""
    base = Path(__file__).resolve().parent / "Input"
    
    center_path = base / f"{prefix}_centerOEmat.txt"
    deputy_path = base / f"{prefix}_deputyOEmat.txt"
    
    with open(str(center_path), "w", encoding="utf-8") as f:
        for v in center:
            f.write(f"  {v:.9e}\n")
    
    with open(str(deputy_path), "w", encoding="utf-8") as f:
        for row in deputy:
            line = "  ".join(f"{v:.9e}" for v in row)
            f.write(f"  {line}\n")
    
    print(f"已保存: {center_path}")
    print(f"已保存: {deputy_path}")


def verify_hill_positions(deputy_km_deg, center_km_deg, rows, cols, spacing_y, spacing_z):
    """验证Hill坐标位置"""
    print("\n--- Hill坐标验证 ---")
    
    a = center_km_deg[0] * 1000  # m
    # 从轨道根数计算纬度幅角 (center_km_deg 单位: km, deg)
    u_deg = center_km_deg[4] + center_km_deg[5]  # ω + f (deg)
    sin_u = np.sin(np.radians(u_deg))
    
    for idx in [0, 1, 2, -2, -1]:
        dep = deputy_km_deg[:, idx]
        dM = np.radians(dep[5] - center_km_deg[5])  # rad
        di = np.radians(dep[2] - center_km_deg[2])  # rad
        
        y_est = a * dM  # 沿轨偏移 (m)
        z_est = a * di * sin_u  # 法向偏移 (m)，含 sin(u) 因子
        
        print(f"  卫星{idx}: y≈{y_est:.0f}m, z≈{z_est:.0f}m")


if __name__ == "__main__":
    spacing_y = 1500  # 沿轨间距 1.5km
    spacing_z = 2000  # 法向间距 2km
    
    for n in [21, 50, 100, 200]:
        print("\n" + "=" * 60)
        print(f"生成 {n} 颗卫星的正方形编队")
        print("=" * 60)
        
        center, deputy, rows, cols = generate_rectangular_formation(
            n, 
            spacing_y=spacing_y,
            spacing_z=spacing_z
        )
        
        print(f"\n--- 网格结构 ---")
        print(f"  行数 (法向): {rows}")
        print(f"  列数 (沿轨): {cols}")
        print(f"  总卫星数: {n}")
        print(f"  沿轨间距: {spacing_y}m")
        print(f"  法向间距: {spacing_z}m")
        print(f"  沿轨总宽度: {(cols-1) * spacing_y}m")
        print(f"  法向总高度: {(rows-1) * spacing_z}m")
        
        verify_hill_positions(deputy, center, rows, cols, spacing_y, spacing_z)
        
        save_formation(center, deputy, f"{n}sats_rect")

# -*- coding: utf-8 -*-
"""
动态层级卫星编队生成器
保持间距格式，根据卫星总数自动增加层数
"""

import numpy as np
from pathlib import Path

# ========== 主星轨道根数 (来自原始 centerOEmat.txt) ==========
# 原始单位: km, deg
center_OE_original = np.array([
    6.878132147e+03,  # a (km)
    0.000000000e+00,  # e
    3.000000000e+01,  # i (deg)
    -1.532244000e+00, # OMG (deg)
    4.680493740e+02,  # omg (deg)
    9.382887800e+01   # f (deg)
])

# 转换为 m, rad (用于 ROE 计算)
def to_m_rad(oe_km_deg):
    """将 km, deg 转换为 m, rad"""
    oe = oe_km_deg.copy()
    oe[0] = oe[0] * 1000.0  # km -> m
    oe[2:] = np.radians(oe[2:])  # deg -> rad
    return oe


def to_km_deg(oe_m_rad):
    """将 m, rad 转换为 km, deg"""
    oe = oe_m_rad.copy()
    oe[0] = oe[0] / 1000.0
    oe[2:] = np.degrees(oe[2:])
    return oe


def f_To_M(e, f):
    """真近点角 f -> 平近点角 M"""
    E = 2 * np.arctan2(np.sqrt(1 - e) * np.sin(f / 2),
                        np.sqrt(1 + e) * np.cos(f / 2))
    M = E - e * np.sin(E)
    return M


def M_To_f(e, M):
    """平近点角 M -> 真近点角 f"""
    E = M
    for _ in range(50):
        dE = (M - (E - e * np.sin(E))) / (1 - e * np.cos(E))
        E += dE
        if abs(dE) < 1e-15:
            break
    f = 2 * np.arctan2(np.sqrt(1 + e) * np.sin(E / 2),
                        np.sqrt(1 - e) * np.cos(E / 2))
    return f


def ROETodOE(centerOE, ROE):
    """
    相对轨道根数 (ROE) -> 轨道根数偏差 (dOE)
    """
    a = centerOE[0]
    e = centerOE[1]
    i = centerOE[2]
    omg = centerOE[4]
    M = centerOE[5]
    
    ae = ROE[0]
    xd = ROE[1]
    yd = ROE[2]
    zmax = ROE[3]
    beta = ROE[4]
    psi = ROE[5]
    
    da = 0
    de = np.sqrt((ae / (2 * a))**2 + ae / a * e * np.cos(beta - M) + e**2) - e
    di = zmax / a * np.cos(omg + M + yd / a - psi)
    dOMG = zmax / (a * np.sin(i)) * np.sin(omg + M + yd / a - psi)
    dM = np.arctan2(ae * np.sin(beta - M), ae * np.cos(beta - M) + 2 * a * e)
    domg = yd / a - dM - dOMG * np.cos(i)
    
    return np.array([da, de, di, dOMG, domg, dM])


def calculate_layers(n_satellites, base_sats=3):
    """
    计算层数和每层卫星数
    
    规则：
    - 保持标准圆形（卫星数能整除360°）
    - 使用倍增序列：3, 6, 12, 24, 48, ...
    - 最后一层使用剩余卫星数的最近合法数
    - 确保总数精确匹配
    
    参数:
        n_satellites: 总卫星数
        base_sats: 基础卫星数 (默认3)
    """
    # 合法的卫星数序列（能整除360°）
    valid_counts = [3, 4, 5, 6, 8, 9, 10, 12, 15, 16, 18, 20, 24, 30, 36, 40, 45, 48, 60, 72, 90, 96, 120, 180, 360]
    
    # 特殊情况
    if n_satellites <= base_sats:
        return [{"layer": 1, "ae": 1000, "zmax": 1000, "n_sats": n_satellites, "spacing": 360.0 / n_satellites}]
    
    # 使用贪心算法：每层使用倍增序列，最后一层使用剩余卫星数的最近合法数
    layers = []
    remaining = n_satellites
    layer_idx = 1
    
    while remaining > 0:
        ae = layer_idx * 1000
        
        # 使用倍增序列：3, 6, 12, 24, 48, ...
        ideal_n = base_sats * (2 ** (layer_idx - 1))
        
        # 如果剩余卫星数小于等于理想数，或者这是最后一层
        if remaining <= ideal_n or layer_idx >= 10:  # 最多10层
            # 找到小于等于remaining的最大合法数
            n_layer = valid_counts[0]
            for vc in valid_counts:
                if vc <= remaining:
                    n_layer = vc
                else:
                    break
            
            # 如果剩余卫星数不是合法数，需要调整
            if remaining not in valid_counts:
                # 找到最接近的合法数（可以略大于remaining）
                best_n = n_layer
                best_diff = remaining - n_layer
                
                # 也考虑略大于remaining的合法数
                for vc in valid_counts:
                    if vc >= remaining:
                        if vc - remaining < best_diff:
                            best_n = vc
                            best_diff = vc - remaining
                        break
                
                n_layer = best_n
        else:
            n_layer = ideal_n
        
        layers.append({
            "layer": layer_idx,
            "ae": ae,
            "zmax": ae,
            "n_sats": n_layer,
            "spacing": 360.0 / n_layer
        })
        
        remaining -= n_layer
        layer_idx += 1
        
        # 防止无限循环
        if layer_idx > 20:
            break
    
    # 调整总数确保精确匹配
    total = sum(l["n_sats"] for l in layers)
    diff = total - n_satellites
    
    if diff != 0:
        # 调整最后一层
        last_layer = layers[-1]
        last_layer["n_sats"] -= diff
        last_layer["spacing"] = 360.0 / last_layer["n_sats"]
    
    return layers


def generate_formation(n_satellites, base_sats=3):
    """
    动态层级编队生成
    
    参数:
        n_satellites: 总卫星数
        base_sats: 基础卫星数 (默认3)
    """
    # 计算层数和每层卫星数
    layers = calculate_layers(n_satellites, base_sats)
    
    # 主星 (原始格式: km, deg -> m, rad)
    centerOE = to_m_rad(center_OE_original)
    centerOE[5] = f_To_M(centerOE[1], centerOE[5])
    
    deputies = []
    
    for layer in layers:
        ae = layer["ae"]
        zmax = layer["zmax"]
        n_sats = layer["n_sats"]
        
        for j in range(n_sats):
            # ROE 参数
            ROE = np.array([
                ae,  # ae (m)
                0,   # xd (m)
                0,   # yd (m)
                zmax,  # zmax (m)
                2 * np.pi / n_sats * (j + 1),  # beta (rad)
                2 * np.pi / n_sats * (j + 1) + np.pi / 2  # psi (rad)
            ])
            
            # 计算轨道根数偏差
            dOE = ROETodOE(centerOE, ROE)
            
            # 从星轨道根数
            deputyOE = centerOE + dOE
            
            # M -> f
            deputyOE[5] = M_To_f(deputyOE[1], deputyOE[5])
            
            deputies.append(deputyOE)
    
    deputy_matrix = np.array(deputies, dtype=float).T
    
    # 转换为 km, deg
    center_km_deg = to_km_deg(centerOE)
    deputy_km_deg = np.zeros_like(deputy_matrix)
    for i in range(deputy_matrix.shape[1]):
        deputy_km_deg[:, i] = to_km_deg(deputy_matrix[:, i])
    
    return center_km_deg, deputy_km_deg, layers


def save_formation(center, deputy, prefix="generated"):
    """保存编队轨道根数到文件"""
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


def print_layer_info(layers):
    """打印层信息"""
    print("\n--- 层结构 ---")
    total = 0
    for layer in layers:
        ae = layer["ae"]
        n = layer["n_sats"]
        spacing = 2 * np.pi * ae / n
        total += n
        print(f"  第{layer['layer']}层: ae={ae}m, zmax={layer['zmax']}m, "
              f"卫星数={n}, 间距≈{spacing:.0f}m")
    print(f"  总计: {total}颗")


if __name__ == "__main__":
    # 测试不同卫星数
    for n in [21, 50, 100, 200, 500]:
        print("\n" + "=" * 60)
        print(f"生成 {n} 颗卫星的编队")
        print("=" * 60)
        
        center, deputy, layers = generate_formation(n)
        print_layer_info(layers)
        save_formation(center, deputy, f"{n}sats_dynamic")

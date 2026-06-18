# -*- coding: utf-8 -*-
"""
正六边形晶格卫星编队生成器 (修正版)
使用六边形轴向坐标生成晶格，确保相邻卫星间距严格为 1km
编队平面：沿轨 (y) - 法向 (z) 平面
参考：gen_rect.py (Hill坐标系控制) 和 gen_dynamic.py (ROE参数)
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

# ========== 单位转换函数 ==========
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

# ========== 六边形晶格生成函数 (核心修正) ==========
def generate_hexagonal_positions(n_layers, spacing=1000):
    """
    生成正六边形晶格位置 (沿轨 y - 法向 z 平面)
    使用轴向坐标 (Axial Coordinates) 确保完美的蜂窝状结构，相邻间距严格为 spacing。
    
    参数:
        n_layers: 层数 (n_layers=2 表示中心+2环 = 19颗)
        spacing: 相邻卫星间距 (m)，默认 1000m (1km)
        
    返回:
        positions: [(y, z), ...] 晶格位置列表 (单位: m)
    """
    positions = [(0.0, 0.0)]  # 层0: 中心
    
    for k in range(1, n_layers + 1):
        # 遍历轴向坐标 (q, r)
        # 第 k 层的点满足 max(|q|, |r|, |s|) == k，其中 s = -q - r
        for q in range(-k, k + 1):
            for r in range(-k, k + 1):
                s = -q - r
                if max(abs(q), abs(r), abs(s)) == k:
                    # 将轴向坐标转换为笛卡尔坐标
                    # 这里我们将 x_cart 映射为沿轨方向 (y_hill)
                    # 将 y_cart 映射为法向方向 (z_hill)
                    y_hill = spacing * (q + r * 0.5)
                    z_hill = spacing * (r * np.sqrt(3) / 2)
                    positions.append((y_hill, z_hill))
                    
    return positions

# ========== Hill坐标 -> 轨道根数偏差 (ROE 相位耦合) ==========
def ROETodOE(centerOE, ROE):
    """
    相对轨道根数 (ROE) -> 轨道根数偏差 (dOE)
    ROE = [ae, xd, yd, zmax, beta, psi]
    参考 gen_dynamic.py
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


def hill_to_roe(y_m, z_m, theta0):
    """
    Hill 坐标偏移 (y: 沿轨, z: 法向) -> ROE 参数
    
    将六边形晶格位置映射为 ROE 参数，使得:
    - 编队在主星视角下保持刚体旋转（构型不变）
    - 沿轨和法向运动具有 π/2 相位差（相位耦合）
    
    推导: ROETodOE 的 CW 正变换给出 (e=0):
        y(θ) = -ae * cos(θ - β)
        z(θ) =  ae * sin(θ - β)
    要求在 θ=θ₀ (初始纬度幅角) 时 (y, z) = (y_m, z_m):
        y_m = -ae * cos(θ₀ - β)  =>  cos(θ₀ - β) = -y_m/r
        z_m =  ae * sin(θ₀ - β)  =>  sin(θ₀ - β) =  z_m/r
    因此: θ₀ - β = atan2(z_m, -y_m)
          β = θ₀ - atan2(z_m, -y_m)
    ψ = β + π/2 保证法向和沿轨运动 90° 相位差（刚体旋转条件）
    
    参数:
        y_m: 沿轨偏移 (m)
        z_m: 法向偏移 (m)
        theta0: 主星初始纬度幅角 ω + M (rad)
    """
    r = np.sqrt(y_m**2 + z_m**2)

    if r < 1e-6:
        # 中心卫星：与主星重合
        return np.array([0.0, 0.0, 0.0, 0.0, 0.0, 0.0])

    ae = r
    xd = 0.0
    yd = 0.0
    zmax = r
    beta = theta0 - np.arctan2(z_m, -y_m)
    psi = beta + np.pi / 2

    return np.array([ae, xd, yd, zmax, beta, psi])

# ========== 主生成函数 ==========
def generate_hexagonal_formation(n_layers, spacing=1000):
    """
    生成正六边形晶格编队
    
    参数:
        n_layers: 层数
        spacing: 相邻卫星间距 (m)
        
    返回:
        center_km_deg: 主星轨道根数 (km, deg)
        deputy_km_deg: 从星轨道根数矩阵 (km, deg), shape: (6, N)
        positions: 晶格位置列表
    """
    # 主星轨道根数 (转换为 m, rad)
    centerOE = to_m_rad(center_OE_original)
    
    # f -> M 转换（ROE 中使用平近点角 M）
    centerOE[5] = f_To_M(centerOE[1], centerOE[5])
    
    # 主星初始纬度幅角 θ₀ = ω + M (用于 hill_to_roe 映射)
    theta0 = centerOE[4] + centerOE[5]
    
    # 生成晶格位置
    positions = generate_hexagonal_positions(n_layers, spacing)
    
    deputies = []
    for y_m, z_m in positions:
        # 1. Hill 坐标 -> ROE 参数（相位耦合：ψ = β + π/2）
        ROE = hill_to_roe(y_m, z_m, theta0)
        
        # 2. ROE -> 轨道根数偏差
        dOE = ROETodOE(centerOE, ROE)
        
        # 3. 从星轨道根数 = 主星 + 偏差
        deputyOE = centerOE + dOE
        
        # 4. M -> f (转换回真近点角)
        deputyOE[5] = M_To_f(deputyOE[1], deputyOE[5])
        
        deputies.append(deputyOE)
    
    deputy_matrix = np.array(deputies, dtype=float).T
    
    # 转换为 km, deg
    center_km_deg = to_km_deg(centerOE)
    deputy_km_deg = np.zeros_like(deputy_matrix)
    for i in range(deputy_matrix.shape[1]):
        deputy_km_deg[:, i] = to_km_deg(deputy_matrix[:, i])
        
    return center_km_deg, deputy_km_deg, positions

# ========== 保存与打印函数 ==========
def save_formation(center, deputy, prefix="hexagonal"):
    """保存编队轨道根数到文件"""
    base = Path(__file__).resolve().parent / "Input"
    base.mkdir(exist_ok=True)  # 确保目录存在
    
    center_path = base / f"{prefix}_centerOEmat.txt"
    deputy_path = base / f"{prefix}_deputyOEmat.txt"
    
    with open(str(center_path), "w", encoding="utf-8") as f:
        for v in center:
            f.write(f"  {v:.9e}\n")
            
    with open(str(deputy_path), "w", encoding="utf-8") as f:
        for row in deputy:
            line = "   ".join(f"{v:.9e}" for v in row)
            f.write(f"  {line}\n")
            
    print(f"已保存: {center_path}")
    print(f"已保存: {deputy_path}")

def print_formation_info(n_layers, positions, spacing=1000):
    """打印编队信息并验证间距"""
    total_sats = len(positions)
    print(f"\n{'='*60}")
    print(f"正六边形晶格编队 - {n_layers} 层")
    print(f"{'='*60}")
    print(f"  层数: {n_layers}")
    print(f"  设计相邻间距: {spacing} m")
    print(f"  总卫星数: {total_sats}")
    
    # 验证最近邻距离
    print(f"\n  --- 间距验证 (随机抽取前5颗卫星的最近邻) ---")
    pos_array = np.array(positions)
    for i in range(min(5, total_sats)):
        p1 = pos_array[i]
        # 计算到所有其他卫星的距离
        dists = np.linalg.norm(pos_array - p1, axis=1)
        # 排除自身 (距离为0)
        dists = dists[dists > 1e-6]
        if len(dists) > 0:
            min_dist = np.min(dists)
            print(f"    卫星 {i} {tuple(p1)} -> 最近邻距离: {min_dist:.2f} m")

# ========== 主程序 ==========
if __name__ == "__main__":
    spacing = 1000  # 1 km
    
    # 生成 2层、3层、4层六边形编队
    # 2层: 1 + 6 + 12 = 19颗
    # 3层: 1 + 6 + 12 + 18 = 37颗
    # 4层: 1 + 6 + 12 + 18 + 24 = 61颗
    for n_layers in [3, 4, 5]:
        print(f"\n>>> 开始生成 {n_layers} 层编队...")
        
        # 生成编队
        center, deputy, positions = generate_hexagonal_formation(n_layers, spacing)
        
        # 打印信息
        print_formation_info(n_layers, positions, spacing)
        
        # 保存
        save_formation(center, deputy, f"hexagonal_{n_layers}layers")
        
        print(f"\n  生成完成！")
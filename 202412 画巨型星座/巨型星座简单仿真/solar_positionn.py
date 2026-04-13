import numpy as np
from numba import jit
@jit
def solar_position(JD):
    """
    计算太阳的地心赤道位置向量，给定儒略日期 (JD)。
    """
    # 天文单位 (m)
    AU = 149597870.691e3

    # 计算自J2000以来的儒略日数
    n = JD - 2451545

    # 计算自J2000年以来的儒略世纪数
    cy = n / 36525

    # 计算平均近点角 (deg)
    M = 357.528 + 0.9856003 * n
    M = np.mod(M,360)  # 保证角度在 [0, 360) 范围内

    # 计算平均黄经 (deg)
    L = 280.460 + 0.98564736 * n
    L = np.mod(L,360)  # 保证角度在 [0, 360) 范围内

    # 计算表观黄经 (deg)
    # radians角度转换为弧度
    lamda = L + 1.915 * np.sin(np.radians(M)) + 0.020 * np.sin(np.radians(2 * M))
    lamda = np.mod(lamda,360)  # 保证角度在 [0, 360) 范围内

    # 计算黄道倾角 (deg)
    eps = 23.439 - 0.0000004 * n

    # 计算单位向量 (地球到太阳的单位向量)
    u = np.array([np.cos(np.radians(lamda)), 
                  np.sin(np.radians(lamda)) * np.cos(np.radians(eps)), 
                  np.sin(np.radians(lamda)) * np.sin(np.radians(eps))])

    # 计算地球到太阳的距离 (km)
    rS = (1.00014 - 0.01671 * np.cos(np.radians(M)) - 0.000140 * np.cos(np.radians(2 * M))) * AU

    # 计算太阳的地心位置向量 (km)
    r_sun = rS * u

    return r_sun

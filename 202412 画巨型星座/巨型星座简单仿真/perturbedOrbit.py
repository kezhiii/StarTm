import numpy as np

from M_To_ff import M_To_f
from orbitElementsToInertiastate import OrbitElementsToInertiastate
from atmospheree import atmosphere
from solar_positionn import solar_position
from lunar_positionn import lunar_position
from numba import jit
import config
RE=config.RE
J2=config.J2
wE=np.squeeze(config.wE)
mu_moon=config.mu_moon
JD0= config.JD0
mu=config.mu
mu_sun=config.mu_sun
@jit
def PerturbedOrbit(OE,ts,step):

    JD = JD0 + ts * (step - 1)
    
    # ---------------------------参数初始化---------------------------
    a = OE[0]
    e = OE[1]
    i = OE[2]
    OMG = OE[3]
    w = OE[4]
    M = OE[5]
    f = M_To_f(e, M)  # 假设 M_To_f 是之前实现的函数
    phi = w + f  # 纬度幅角
    n = np.sqrt(mu / a**3)  # 角速度
    p = a * (1 - e**2)  # 半通径

    # 计算惯性状态
    
    Inertialstate = OrbitElementsToInertiastate(OE)  

    #* pylance无法识别R和V是三维向量，注解出来他们是数组来确保下面的代码段高亮显示
    # R = Inertialstate[:3].reshape((3, 1))  # 位置向量，形状 (3,)
    # V = Inertialstate[3:].reshape((3, 1))  # 速度向量，形状 (3,)
    R: np.ndarray = Inertialstate[:3]  # 位置矢量
    V: np.ndarray = Inertialstate[3:]   # 速度矢量

    r = np.linalg.norm(R)   #计算模长
    ur = R / r   # 径向单位矢量
    H = np.cross(R, V)
    
    uh = H / np.linalg.norm(H)  # 法向单位矢量
    
    s = np.cross(uh, ur)
    us = s / np.linalg.norm(s)  # 迹向单位矢量

    # -----------------------计算轨道根数变化率------------------------
    # J2摄动
    adot_J2 = 0
    edot_J2 = 0
    idot_J2 = 0
    OMGdot_J2 = -1.5 * n * J2 * (RE / a)**2 * (1 - e**2)**(-2) * np.cos(i)
    wdot_J2 = 1.5 * n * J2 * RE**2 * a**(-2) * (1 - e**2)**(-2) * (2 - 2.5 * np.sin(i)**2)
    Mdot_J2 = 1.5 * n * J2 * RE**2 * a**(-2) * (1 - e**2)**(-1.5) * (1 - 1.5 * np.sin(i)**2)

    # 大气阻力摄动
    CD = 2.2  # 阻力系数
    m = 300  # 质量 (kg)
    A = np.pi / 4 * (1**2)  # 横截面积 (m^2)
    alt = (r - RE) / 1000  # 海拔高度 (km)
    rho = atmosphere(alt)  
    #!--------------------------------------------------------------
    Vrel = V - np.cross(wE, R)  # 相对于大气的速度矢量 (m/s)
    vrel = np.linalg.norm(Vrel)  # 相对于大气的速度大小 (m/s)
    uv = Vrel / vrel  # 相对速度单位矢量
    ap_drag = -0.01 * rho * vrel**2 / 2 * uv  # 大气阻力摄动加速度 (m/s^2)
    apr_drag = np.dot(ap_drag, ur)  # LVLH坐标系下的大气阻力摄动分量
    aps_drag = np.dot(ap_drag, us)
    aph_drag = np.dot(ap_drag, uh)

    # 太阳引力摄动
    R_S = solar_position(JD)  # 确定太阳的标称位置矢量
    r_S = np.linalg.norm(R_S)
    R_rel = R_S - R  # 确定地心惯性系下太阳相对位置矢量
    r_rel = np.linalg.norm(R_rel)
    q = np.dot(R, (2 * R_S - R) / r_S**2)  # 详见 Appendix F
    F = (q**2 - 3 * q + 3) * q / (1 + (1 - q)**1.5)
    ap_sun = mu_sun / r_rel**3 * (F * R_S - R)  # 太阳引力摄动加速度
    apr_sun = np.dot(ap_sun, ur)  # LVLH坐标系下的太阳引力摄动分量
    aps_sun = np.dot(ap_sun, us)
    aph_sun = np.dot(ap_sun, uh)

    # 月球引力摄动
    R_m = lunar_position(JD)  # 确定月球的标称位置矢量
    r_m = np.linalg.norm(R_m)
    R_rel = R_m - R  # 确定地心惯性系下月球相对位置矢量
    r_rel = np.linalg.norm(R_rel)
    q = np.dot(R, (2 * R_m - R) / r_m**2)  # 详见 Appendix F
    F = (q**2 - 3 * q + 3) * q / (1 + (1 - q)**1.5)
    ap_moon = mu_moon / r_rel**3 * (F * R_m - R)  # 月球引力摄动加速度
    apr_moon = np.dot(ap_moon, ur)  # LVLH坐标系下的月球引力摄动分量
    aps_moon = np.dot(ap_moon, us)
    aph_moon = np.dot(ap_moon, uh)

    # 摄动加速度汇总
    # apr_ms = apr_drag+apr_sun+apr_moon
    # aps_ms = aps_drag+aps_sun+aps_moon
    # aph_ms = aph_drag+aph_sun+aph_moon
    apr_ms = apr_drag
    aps_ms = aps_drag
    aph_ms = aph_drag
    # apr_ms = 0
    # aps_ms = 0
    # aph_ms = 0

    # 高斯变分方程
    if e != 0:
        adot = adot_J2 + 2 / n / np.sqrt(1 - e**2) * (apr_ms * e * np.sin(f) + aps_ms * (1 + e * np.cos(f)))
        edot = edot_J2 + np.sqrt(1 - e**2) / n / a * (apr_ms * np.sin(f) + aps_ms * (np.cos(f) + (e + np.cos(f)) / (1 + e * np.cos(f))))
        idot = idot_J2 + r * np.cos(phi) / n / a**2 / np.sqrt(1 - e**2) * aph_ms
        OMGdot = OMGdot_J2 + r * np.sin(phi) / n / a**2 / np.sqrt(1 - e**2) / np.sin(i) * aph_ms
        wdot = wdot_J2 + np.sqrt(1 - e**2) / n / a / e * (-apr_ms * np.cos(f) + aps_ms * (1 + r / p) * np.sin(f)) - np.cos(i) * OMGdot
        Mdot = n + Mdot_J2 - (1 - e**2) / n / a / e * (-apr_ms * (np.cos(f) - 2 * e * r / p) + aps_ms * (1 + r / p) * np.sin(f))
    else:
        adot = adot_J2 + 2 / n * aps_ms
        edot = edot_J2 + 1 / n / a * (apr_ms * np.sin(f) + 2 * aps_ms * np.cos(f))
        idot = idot_J2 + np.cos(phi) / n / a * aph_ms
        OMGdot = OMGdot_J2 + np.sin(phi) / n / a / np.sin(i) * aph_ms
        wdot = 0
        Mdot = n + wdot_J2 + Mdot_J2 - 2 / n / a * apr_ms - np.sin(phi) * np.cos(i) / n / a / np.sin(i) * aph_ms

    # ----------------------------更新轨道根数------------------------
    anext = a + adot * ts
    enext = e + edot * ts
    inext = i + idot * ts
    OMGnext = OMG + OMGdot * ts
    wnext = w + wdot * ts
    Mnext = M + Mdot * ts

    OEnext = [anext, enext, inext, OMGnext, wnext, Mnext]
    
    return OEnext
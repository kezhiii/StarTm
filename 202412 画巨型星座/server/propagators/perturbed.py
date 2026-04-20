"""
摄动轨道推进器

迁移自 perturbedOrbit.py，使用纯 numpy 计算。
保持与旧代码完全相同的计算逻辑。
"""

from __future__ import annotations
import os
import sys

import numpy as np

# 添加项目根目录到路径，以便导入旧模块
# perturbed.py is in server/propagators/, so we need to go up 2 levels to get project root
_project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)

# 导入旧 config.py 模块（使用绝对路径避免与 server.config 冲突）
import importlib.util
_config_path = os.path.join(_project_root, "config.py")
_spec = importlib.util.spec_from_file_location("old_config", _config_path)
_old_config = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_old_config)

mu = _old_config.mu
RE = _old_config.RE
J2 = _old_config.J2
wE = _old_config.wE
mu_moon = _old_config.mu_moon
mu_sun = _old_config.mu_sun
days = _old_config.days
JD0 = _old_config.JD0
deg = _old_config.deg

from .base import OrbitPropagator
from ..core.satellite import Satellite
from ..core.constellation import Constellation
from ..core.orbit_elements import OrbitElements
from ..core.inertial_state import InertialState
from ..core.physical_props import PhysicalProps


# ======================== 导入旧模块的函数 ========================
from M_To_ff import M_To_f
from f_To_MM import f_To_M
from orbitElementsToInertiastate import OrbitElementsToInertiastate
from atmospheree import atmosphere
from solar_positionn import solar_position
from lunar_positionn import lunar_position


# ======================== 单步递推 ========================

def _perturbed_orbit_step(oe_array: np.ndarray, ts: float, step: int) -> np.ndarray:
    """
    摄动轨道递推一步。
    
    完全复制 perturbedOrbit.py 的逻辑，确保计算结果一致。
    
    Args:
        oe_array: [a(m), e, i(rad), OMG(rad), omg(rad), M(rad)]
        ts: 时间步长 (秒)
        step: 当前步数（用于计算儒略日）
    
    Returns:
        新的 [a(m), e, i(rad), OMG(rad), omg(rad), M(rad)]
    """
    # 常量
    _mu = mu
    _RE = RE
    _J2 = J2
    _wE = np.array([0.0, 0.0, 7.2921159e-5])
    _mu_moon = mu_moon
    _mu_sun = mu_sun
    _JD0 = JD0
    _days_val = days
    
    JD = _JD0 + ts * step / _days_val
    
    # 解包轨道根数
    a = oe_array[0]
    e = oe_array[1]
    i = oe_array[2]
    OMG = oe_array[3]
    w = oe_array[4]
    M = oe_array[5]
    
    # f = M -> f
    f = M_To_f(e, M)
    phi = w + f  # 纬度幅角
    n = np.sqrt(_mu / a**3)  # 角速度
    p = a * (1 - e**2)  # 半通径
    
    # 计算惯性状态
    oe_for_inertial = np.array([a, e, i, OMG, w, f])
    inertial = OrbitElementsToInertiastate(oe_for_inertial)
    
    R = inertial[:3]  # 位置矢量
    V = inertial[3:]   # 速度矢量
    
    r = np.linalg.norm(R)
    ur = R / r  # 径向单位矢量
    H = np.cross(R, V)
    uh = H / np.linalg.norm(H)  # 法向单位矢量
    s = np.cross(uh, ur)
    us = s / np.linalg.norm(s)  # 迹向单位矢量
    
    # ======================== J2 摄动 ========================
    adot_J2 = 0.0
    edot_J2 = 0.0
    idot_J2 = 0.0
    OMGdot_J2 = -1.5 * n * _J2 * (_RE / a)**2 * (1 - e**2)**(-2) * np.cos(i)
    wdot_J2 = 1.5 * n * _J2 * _RE**2 * a**(-2) * (1 - e**2)**(-2) * (2 - 2.5 * np.sin(i)**2)
    Mdot_J2 = 1.5 * n * _J2 * _RE**2 * a**(-2) * (1 - e**2)**(-1.5) * (1 - 1.5 * np.sin(i)**2)
    
    # ======================== 大气阻力摄动 ========================
    CD = 2.2
    mass = 300.0
    A = np.pi / 4.0 * (1.0**2)
    alt = (r - _RE) / 1000.0  # 海拔高度 (km)
    rho = atmosphere(alt)
    
    Vrel = V - np.cross(_wE, R)
    vrel = np.linalg.norm(Vrel)
    uv = Vrel / vrel
    ap_drag = -0.01 * rho * vrel**2 / 2.0 * uv
    apr_drag = np.dot(ap_drag, ur)
    aps_drag = np.dot(ap_drag, us)
    aph_drag = np.dot(ap_drag, uh)
    
    # ======================== 太阳引力摄动 ========================
    R_S = solar_position(JD)
    r_S = np.linalg.norm(R_S)
    R_rel = R_S - R
    r_rel = np.linalg.norm(R_rel)
    q = np.dot(R, (2.0 * R_S - R) / r_S**2)
    F = (q**2 - 3.0 * q + 3.0) * q / (1.0 + (1.0 - q)**1.5)
    ap_sun = _mu_sun / r_rel**3 * (F * R_S - R)
    apr_sun = np.dot(ap_sun, ur)
    aps_sun = np.dot(ap_sun, us)
    aph_sun = np.dot(ap_sun, uh)
    
    # ======================== 月球引力摄动 ========================
    R_m = lunar_position(JD)
    r_m = np.linalg.norm(R_m)
    R_rel = R_m - R
    r_rel = np.linalg.norm(R_rel)
    q = np.dot(R, (2.0 * R_m - R) / r_m**2)
    F = (q**2 - 3.0 * q + 3.0) * q / (1.0 + (1.0 - q)**1.5)
    ap_moon = _mu_moon / r_rel**3 * (F * R_m - R)
    apr_moon = np.dot(ap_moon, ur)
    aps_moon = np.dot(ap_moon, us)
    aph_moon = np.dot(ap_moon, uh)
    
    # 摄动加速度汇总（当前仅使用大气阻力）
    apr_ms = apr_drag
    aps_ms = aps_drag
    aph_ms = aph_drag
    
    # ======================== 高斯变分方程 ========================
    if e != 0:
        adot = adot_J2 + 2.0 / n / np.sqrt(1 - e**2) * (apr_ms * e * np.sin(f) + aps_ms * (1 + e * np.cos(f)))
        edot = edot_J2 + np.sqrt(1 - e**2) / n / a * (apr_ms * np.sin(f) + aps_ms * (np.cos(f) + (e + np.cos(f)) / (1 + e * np.cos(f))))
        idot = idot_J2 + r * np.cos(phi) / n / a**2 / np.sqrt(1 - e**2) * aph_ms
        OMGdot = OMGdot_J2 + r * np.sin(phi) / n / a**2 / np.sqrt(1 - e**2) / np.sin(i) * aph_ms
        wdot = wdot_J2 + np.sqrt(1 - e**2) / n / a / e * (-apr_ms * np.cos(f) + aps_ms * (1 + r / p) * np.sin(f)) - np.cos(i) * OMGdot
        Mdot = n + Mdot_J2 - (1 - e**2) / n / a / e * (-apr_ms * (np.cos(f) - 2 * e * r / p) + aps_ms * (1 + r / p) * np.sin(f))
    else:
        adot = adot_J2 + 2.0 / n * aps_ms
        edot = edot_J2 + 1.0 / n / a * (apr_ms * np.sin(f) + 2.0 * aps_ms * np.cos(f))
        idot = idot_J2 + np.cos(phi) / n / a * aph_ms
        OMGdot = OMGdot_J2 + np.sin(phi) / n / a / np.sin(i) * aph_ms
        wdot = 0.0
        Mdot = n + wdot_J2 + Mdot_J2 - 2.0 / n / a * apr_ms - np.sin(phi) * np.cos(i) / n / a / np.sin(i) * aph_ms
    
    # ======================== 更新轨道根数 ========================
    anext = a + adot * ts
    enext = e + edot * ts
    inext = i + idot * ts
    OMGnext = OMG + OMGdot * ts
    wnext = w + wdot * ts
    Mnext = M + Mdot * ts
    
    return np.array([anext, enext, inext, OMGnext, wnext, Mnext])


def _compute_inertial_state(oe_array: np.ndarray) -> np.ndarray:
    """
    从轨道根数计算惯性状态。
    
    Args:
        oe_array: [a(m), e, i(rad), OMG(rad), omg(rad), f(rad)]
    
    Returns:
        [X(m), Y(m), Z(m), Vx(m/s), Vy(m/s), Vz(m/s)]
    """
    # 确保 f 在 [0, 2*pi] 范围内
    f = oe_array[5]
    while f > 2 * np.pi:
        f -= 2 * np.pi
    while f < 0:
        f += 2 * np.pi
    
    oe_with_f = np.array([oe_array[0], oe_array[1], oe_array[2], oe_array[3], oe_array[4], f])
    return OrbitElementsToInertiastate(oe_with_f)


# ======================== 星座批量递推 (JIT) ========================

def _propagate_constellation_batch(
    sateOEmat: np.ndarray,
    dt: float,
    step: int
) -> tuple[np.ndarray, np.ndarray]:
    """
    批量递推整个星座。
    
    Args:
        sateOEmat: shape (N, 6), [a(m), e, i(rad), OMG(rad), omg(rad), M(rad)]
        dt: 时间步长 (秒)
        step: 当前步数
    
    Returns:
        (new_sateOEmat, inertial_states)
        new_sateOEmat: shape (N, 6), 新的轨道根数
        inertial_states: shape (N, 6), [X(m), Y(m), Z(m), Vx(m/s), Vy(m/s), Vz(m/s)]
    """
    Nsate = sateOEmat.shape[0]
    new_oe = np.zeros((Nsate, 6))
    new_inertial = np.zeros((Nsate, 6))
    
    for num in range(Nsate):
        # 递推轨道根数 (M 模式)
        oe_with_M = sateOEmat[num].copy()
        oe_with_M[5] = f_To_M(oe_with_M[1], oe_with_M[5])  # f -> M
        new_oe[num] = _perturbed_orbit_step(oe_with_M, dt, step)
        
        # M -> f
        new_oe[num, 5] = M_To_f(new_oe[num, 1], new_oe[num, 5])
        
        # 计算惯性状态
        new_inertial[num] = _compute_inertial_state(new_oe[num])
    
    return new_oe, new_inertial


# ======================== 推进器类 ========================

class PerturbedOrbitPropagator(OrbitPropagator):
    """
    摄动轨道推进器。
    
    支持 J2 摄动 + 大气阻力 + 太阳引力 + 月球引力。
    使用 numpy 进行批量计算。
    """
    
    def __init__(self):
        pass
    
    def propagate_satellite(self, satellite: Satellite, dt: float, step: int) -> Satellite:
        """
        递推单颗卫星状态。
        
        Args:
            satellite: 当前卫星状态
            dt: 时间步长 (秒)
            step: 当前步数
        
        Returns:
            递推后的新卫星状态
        """
        # 轨道根数 -> numpy 数组 [a(m), e, i(rad), OMG(rad), omg(rad), M(rad)]
        oe = satellite.orbit_elements
        oe_array = np.array([oe.a, oe.e, oe.i, oe.OMG, oe.omg, oe.f])
        
        # f -> M
        oe_array[5] = f_To_M(oe_array[1], oe_array[5])
        
        # 递推一步
        new_oe_array = _perturbed_orbit_step(oe_array, dt, step)
        
        # M -> f
        new_oe_array[5] = M_To_f(new_oe_array[1], new_oe_array[5])
        
        # 计算惯性状态
        inertial_array = _compute_inertial_state(new_oe_array)
        
        # 创建新卫星对象
        new_sat = Satellite(
            sat_id=satellite.sat_id,
            orbit_elements=OrbitElements.from_numpy(new_oe_array),
            inertial_state=InertialState.from_numpy(inertial_array),
            physical_props=satellite.physical_props,
            light_state=satellite.light_state
        )
        
        return new_sat
    
    def propagate_constellation(self, constellation: Constellation, dt: float, step: int) -> Constellation:
        """
        批量递推整个星座。
        
        Args:
            constellation: 当前星座状态
            dt: 时间步长 (秒)
            step: 当前步数
        
        Returns:
            递推后的新星座状态
        """
        sateOEmat = constellation.get_numpy_matrix()
        new_oe, new_inertial = _propagate_constellation_batch(sateOEmat, dt, step)
        constellation.update_from_numpy_matrix(new_oe)
        inertial_states = [
            InertialState.from_numpy(new_inertial[i])
            for i in range(new_inertial.shape[0])
        ]
        constellation.update_inertial_states(inertial_states)
        return constellation
    
    def get_name(self) -> str:
        return "PerturbedOrbit (J2 + Drag + Sun + Moon)"

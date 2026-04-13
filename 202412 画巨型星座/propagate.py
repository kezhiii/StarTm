import numpy as np
import time
import os
import pandas as pd
import config
from numba import jit, prange
from perturbedOrbit import PerturbedOrbit
from M_To_ff import M_To_f
from f_To_MM import f_To_M
from orbitElementsToInertiastate import OrbitElementsToInertiastate

# ======================== 参数设置 ========================
ts_prop = 1          # 递推步长 (s)
ts_save = 60         # 保存间隔 (s)
T_total = 86400      # 总时长 (s), 1天
Nstep = T_total      # 总步数
Nsave = Nstep // ts_save  # 保存次数 = 1440

# 起始日期
START_YEAR = config.Year
START_MONTH = config.Month
START_DAY = config.Day

# ======================== 读取输入 ========================
# 主星: 6个轨道根数 (km, deg)
centerOE = np.loadtxt('Input/centerOEmat.txt')  # (6,)
# 从星: 6行×21列 (km, deg)
deputyOE = np.loadtxt('Input/deputyOEmat.txt')   # (6, 21)
Nsate = 1 + deputyOE.shape[1]  # 卫星总数 = 1 + 21 = 22

# ======================== 组装卫星矩阵 ========================
sateOEmat = np.zeros((Nsate, 6))
sateOEmat[0] = centerOE
sateOEmat[1:] = deputyOE.T  # 转置后 (21, 6)

# ======================== 单位转换 ========================
# a: km → m
sateOEmat[:, 0] *= 1000
# i, OMG, omg, f: deg → rad
sateOEmat[:, 2:] *= config.deg

# ======================== JIT 核心函数 ========================
@jit(nopython=True, parallel=True)
def propagate_all(sateOEmat_init, ts_prop, ts_save, Nstep, Nsave):
    Nsate = sateOEmat_init.shape[0]
    sateOEmat = sateOEmat_init.copy()
    all_OE = np.zeros((Nsave, Nsate, 6))
    all_inertial = np.zeros((Nsave, Nsate, 6))

    save_idx = 0
    for step in range(Nstep):
        # 并行处理所有卫星
        for num in prange(Nsate):
            sateOE = sateOEmat[num].copy()
            # f → M
            sateOE[5] = f_To_M(sateOE[1], sateOE[5])
            # 轨道递推
            sateOE = PerturbedOrbit(sateOE, ts_prop, step)
            # M → f
            sateOE[5] = M_To_f(sateOE[1], sateOE[5])
            sateOEmat[num] = sateOE

        # 保存
        if (step + 1) % ts_save == 0:
            for num in prange(Nsate):
                inertial = OrbitElementsToInertiastate(sateOEmat[num])
                all_OE[save_idx, num] = sateOEmat[num]
                all_inertial[save_idx, num] = inertial
            save_idx += 1

    return all_OE, all_inertial

# ======================== 时间戳转换 ========================
def seconds_to_timestamp(start_year, start_month, start_day, total_seconds):
    """将秒数转换为 YYYYMMDDHHMMSS 整数格式"""
    days_offset = int(total_seconds) // 86400
    seconds_in_day = int(total_seconds) % 86400

    hour = seconds_in_day // 3600
    minute = (seconds_in_day % 3600) // 60
    second = seconds_in_day % 60

    # 简单日期推进 (适用于短时间范围)
    day = start_day + days_offset
    month = start_month
    year = start_year

    # 处理月末 (简化处理, 仅适用于8月)
    days_in_month = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    if (year % 4 == 0 and year % 100 != 0) or (year % 400 == 0):
        days_in_month[1] = 29

    while day > days_in_month[month - 1]:
        day -= days_in_month[month - 1]
        month += 1
        if month > 12:
            month = 1
            year += 1

    return year * 10000000000 + month * 100000000 + day * 1000000 + hour * 10000 + minute * 100 + second

# ======================== 主循环 ========================
print(f'开始轨道递推: {Nsate}颗卫星, {Nstep}步, 步长{ts_prop}s')
print(f'保存间隔: {ts_save}s, 共保存{Nsave}次')
print(f'起始时间: {START_YEAR}-{START_MONTH:02d}-{START_DAY:02d} 00:00:00')
start_time = time.time()

# JIT 预热
print('JIT 预热中...')
_ = propagate_all(sateOEmat[:1], ts_prop, ts_save, 10, 1)

print('开始正式计算...')
all_OE, all_inertial = propagate_all(sateOEmat, ts_prop, ts_save, Nstep, Nsave)

elapsed = time.time() - start_time
print(f'递推完成, 总耗时 {elapsed:.1f}s')

# ======================== 单位转换 (输出) ========================
# a: m → km
all_OE_out = all_OE.copy()
all_OE_out[:, :, 0] /= 1000
# i, OMG, omg, f: rad → deg
all_OE_out[:, :, 2:] /= config.deg

# 位置: m → km, 速度: m/s → km/s
all_inertial_out = all_inertial.copy() / 1000

# ======================== 生成时间戳 ========================
timestamps = []
for t_idx in range(Nsave):
    total_seconds = (t_idx + 1) * ts_save  # t_idx=0 对应 60s
    ts = seconds_to_timestamp(START_YEAR, START_MONTH, START_DAY, total_seconds)
    timestamps.append(ts)

# ======================== 保存CSV ========================
os.makedirs('Output', exist_ok=True)

# 展平数据
rows = []
for t_idx in range(Nsave):
    for s_idx in range(Nsate):
        row = [
            timestamps[t_idx],   # YYYYMMDDHHMMSS
            s_idx,               # 卫星编号
            *all_OE_out[t_idx, s_idx],      # a(km), e, i(deg), OMG(deg), omg(deg), f(deg)
            *all_inertial_out[t_idx, s_idx] # X(km), Y(km), Z(km), Vx(km/s), Vy(km/s), Vz(km/s)
        ]
        rows.append(row)

columns = [
    'timestamp', 'sat_id',
    'a', 'e', 'i', 'OMG', 'omg', 'f',
    'X', 'Y', 'Z', 'Vx', 'Vy', 'Vz'
]
df = pd.DataFrame(rows, columns=columns)

output_path = 'Output/propagation_result.csv'
df.to_csv(output_path, index=False, float_format='%.6f')
print(f'结果已保存至 {output_path}')
print(f'  总行数: {len(rows)} ({Nsave}时间点 × {Nsate}卫星)')

# ======================== 验证输出 ========================
print('\n===== 验证输出 =====')
print(f'初始时刻 主星轨道根数:')
print(f'  a = {all_OE_out[0, 0, 0]:.3f} km')
print(f'  e = {all_OE_out[0, 0, 1]:.6f}')
print(f'  i = {all_OE_out[0, 0, 2]:.3f} deg')
print(f'最终时刻 (timestamp={timestamps[-1]}) 主星轨道根数:')
print(f'  a = {all_OE_out[-1, 0, 0]:.3f} km')
print(f'  e = {all_OE_out[-1, 0, 1]:.6f}')
print(f'  i = {all_OE_out[-1, 0, 2]:.3f} deg')
print(f'主星初始位置: ({all_inertial_out[0, 0, 0]:.3f}, {all_inertial_out[0, 0, 1]:.3f}, {all_inertial_out[0, 0, 2]:.3f}) km')
print(f'主星初始速度: ({all_inertial_out[0, 0, 3]:.3f}, {all_inertial_out[0, 0, 4]:.3f}, {all_inertial_out[0, 0, 5]:.3f}) km/s')
print(f'主星位置模长: {np.linalg.norm(all_inertial_out[0, 0, :3]):.3f} km')
print(f'主星速度模长: {np.linalg.norm(all_inertial_out[0, 0, 3:]):.3f} km/s')
print(f'时间戳范围: {timestamps[0]} ~ {timestamps[-1]}')

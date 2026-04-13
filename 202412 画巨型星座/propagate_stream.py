import numpy as np
import config
from numba import jit
from perturbedOrbit import PerturbedOrbit
from M_To_ff import M_To_f
from f_To_MM import f_To_M
from orbitElementsToInertiastate import OrbitElementsToInertiastate

# ======================== 参数设置 ========================
START_YEAR = config.Year
START_MONTH = config.Month
START_DAY = config.Day

# ======================== 读取输入 ========================
centerOE = np.loadtxt('Input/centerOEmat.txt')
deputyOE = np.loadtxt('Input/deputyOEmat.txt')
Nsate = 1 + deputyOE.shape[1]

# ======================== 组装卫星矩阵 ========================
sateOEmat = np.zeros((Nsate, 6))
sateOEmat[0] = centerOE
sateOEmat[1:] = deputyOE.T

# 单位转换
sateOEmat[:, 0] *= 1000  # a: km → m
sateOEmat[:, 2:] *= config.deg  # 角度: deg → rad

# ======================== 时间戳转换 ========================
def seconds_to_timestamp(start_year, start_month, start_day, total_seconds):
    days_offset = int(total_seconds) // 86400
    seconds_in_day = int(total_seconds) % 86400
    hour = seconds_in_day // 3600
    minute = (seconds_in_day % 3600) // 60
    second = seconds_in_day % 60
    day = start_day + days_offset
    month = start_month
    year = start_year
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

# ======================== 单步计算 (JIT) ========================
@jit(nopython=True)
def compute_one_step(sateOEmat, step):
    """计算1秒，返回所有卫星的轨道根数和惯性状态"""
    Nsate = sateOEmat.shape[0]
    result = np.zeros((Nsate, 14))  # timestamp, sat_id, a, e, i, OMG, omg, f, X, Y, Z, Vx, Vy, Vz
    
    for num in range(Nsate):
        sateOE = sateOEmat[num].copy()
        # f → M
        sateOE[5] = f_To_M(sateOE[1], sateOE[5])
        # 轨道递推
        sateOE = PerturbedOrbit(sateOE, 1, step)
        # M → f
        sateOE[5] = M_To_f(sateOE[1], sateOE[5])
        sateOEmat[num] = sateOE
        
        # 惯性状态
        inertial = OrbitElementsToInertiastate(sateOE)
        
        # 组装结果
        result[num, 0] = step + 1  # 时间戳（秒）
        result[num, 1] = num  # 卫星编号
        result[num, 2] = sateOE[0] / 1000  # a: m → km
        result[num, 3] = sateOE[1]  # e
        result[num, 4] = sateOE[2] / config.deg  # i: rad → deg
        result[num, 5] = sateOE[3] / config.deg  # OMG: rad → deg
        result[num, 6] = sateOE[4] / config.deg  # omg: rad → deg
        result[num, 7] = sateOE[5] / config.deg  # f: rad → deg
        result[num, 8] = inertial[0] / 1000  # X: m → km
        result[num, 9] = inertial[1] / 1000  # Y: m → km
        result[num, 10] = inertial[2] / 1000  # Z: m → km
        result[num, 11] = inertial[3] / 1000  # Vx: m/s → km/s
        result[num, 12] = inertial[4] / 1000  # Vy: m/s → km/s
        result[num, 13] = inertial[5] / 1000  # Vz: m/s → km/s
    
    return result

# ======================== 环形缓冲区 ========================
class RingBuffer:
    def __init__(self, capacity=3600):
        self.capacity = capacity
        self.data = []
    
    def append(self, step_data):
        if len(self.data) >= self.capacity:
            return False
        self.data.append(step_data)
        return True
    
    def pop_front(self, n_seconds):
        if n_seconds > len(self.data):
            n_seconds = len(self.data)
        result = self.data[:n_seconds]
        self.data = self.data[n_seconds:]
        return result
    
    def is_full(self):
        return len(self.data) >= self.capacity
    
    def length(self):
        return len(self.data)

# ======================== 流式递推引擎 ========================
class StreamPropagator:
    def __init__(self, buffer_capacity=3600):
        self.buffer = RingBuffer(buffer_capacity)
        self.current_step = 0
        self.is_running = False
        self.is_paused = False
        self.sateOEmat = sateOEmat.copy()
    
    def compute_step(self):
        """计算1秒，返回是否成功"""
        if self.buffer.is_full():
            return False
        
        result = compute_one_step(self.sateOEmat, self.current_step)
        
        # 生成时间戳
        timestamp = seconds_to_timestamp(START_YEAR, START_MONTH, START_DAY, self.current_step + 1)
        result[:, 0] = timestamp
        
        self.buffer.append(result)
        self.current_step += 1
        return True
    
    def get_and_pop(self, n_seconds):
        """获取并弹出前N秒数据"""
        return self.buffer.pop_front(n_seconds)
    
    def has_data(self, n_seconds):
        """检查是否有N秒数据"""
        return self.buffer.length() >= n_seconds

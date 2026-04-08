import numpy as np
from numba import jit
import matplotlib.pyplot as plt
import config
from perturbedOrbit import PerturbedOrbit
from M_To_ff import M_To_f
from orbitElementsToInertiastate import OrbitElementsToInertiastate
from  InertiastateToOrbitElements import InertiastateToOrbitElements
from f_To_MM import f_To_M
import time
import pandas as pd
# 1. 读取CSV文件到数组Sate
def read_csv_to_sate(file_path):
    columns = ['编号', 'a', 'e', 'i', 'OMG', 'omg', 'f']
    data = pd.read_csv(file_path,  names=columns, skiprows=1)
    # 将数值列转换为 float 类型
    # numeric_columns = ['a', 'e', 'i', 'OMG', 'omg', 'f']
    # for col in numeric_columns:
    #     data[col] = pd.to_numeric(data[col], errors='coerce')  # 强制转换为数值，无法转换的变为 NaN

    return data.values  # 将DataFrame转换为NumPy数组


if __name__ == "__main__":
    file_path = '1星轨道根数.csv'
    data = read_csv_to_sate(file_path)*1000
    ts = 1
    sateOE = data[0][1:].copy()
    data[0][1:] = InertiastateToOrbitElements(sateOE)
    for i in range(100):
        sateOE = data[0][1:].copy()

        sateOE[5] = f_To_M(sateOE[1], sateOE[5])  # f转M 真近点角转平近点角，只需要自己的偏心率e和真近点角f
        # 平近点角差
        sateOE[:] = PerturbedOrbit(sateOE[:], ts, i)  # 计算和修正卫星的扰动轨道
        sateOE[5] = M_To_f(sateOE[1], sateOE[5])  # M转f 计算修正后轨道的真近点角
        data[0][1:] = sateOE  # 赋值给总的轨道六要素矩阵

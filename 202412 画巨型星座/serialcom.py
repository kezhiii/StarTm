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
'''
在 MATLAB 中，列向量 和 行向量 是通过明确的形状来区分的。
MATLAB 是基于矩阵运算的语言，所有数据的存储方式都是矩阵形式（即二维数组）。
在 MATLAB 中，向量是特定的矩阵，既可以是列向量（一个 $n \times 1$ 的矩阵），
也可以是行向量（一个 $1 \times n$ 的矩阵）。
Python 中的 numpy 库不像 MATLAB 那样严格区分行列向量。
numpy 默认使用一维数组来表示向量，它不强制要求使用列向量或行向量。
这是因为 numpy 更侧重于对数组进行广泛的广播操作，并且 numpy 可以自动处理不同维度的数组。
'''
#! 星座参数
H = 400e3  # 轨道高度 (m)
inclination = 55 * config.deg
F = 0
Pnum = 60#轨道数
Snum = 60#每个轨道卫星数
Nnum = Pnum * Snum#总卫星数


@jit
def funcserial(sateOEmat,sateOETra):
     #循环3600次，3600颗星
    for num in range(Nnum):
        S = (num+1) % Snum
        if S == 0:
            S = Snum
        P = (num+1 - S) // Snum
        sateOEmat[num, :] = [
            config.RE + H + 0 * (np.random.rand() - 0.5) * 2,  # 半长轴
            0.01 * np.random.rand(),                   # 偏心率
            inclination + 0.01 * config.deg * (np.random.rand() - 0.5) * 2,  # 倾角
            2 * np.pi / Pnum * P + 0.01 * config.deg * (np.random.rand() - 0.5) * 2,  # 升交点赤经
            0.1 * config.deg * (np.random.rand() - 0.5) * 2,  # 近地点幅角
            2 * np.pi / Snum * S + 2 * np.pi * F * P / Snum / Pnum + 0.1 * config.deg * (np.random.rand() - 0.5) * 2  # 真近点角
        ]
        # 提取需要处理的角度参数
        i_new = sateOEmat[num, 2]  # 倾角
        OMG_new = sateOEmat[num, 3]  # 升交点赤经
        omg_new = sateOEmat[num, 4]  # 近地点幅角
        f_new = sateOEmat[num, 5]  # 真近点角

        # 处理倾角范围 (0-π)
        if i_new > np.pi:
            i_new -= np.pi

        # 处理升交点赤经范围 (0-2π)
        if OMG_new > 2 * np.pi:
            OMG_new -= np.pi  # 注意：这里按你提供的代码使用了减π，通常是减2π
        elif OMG_new < 0:
            OMG_new = 2 * np.pi + OMG_new

        # 处理近地点幅角范围 (0-2π)
        if omg_new > 2 * np.pi:
            omg_new -= 2 * np.pi
        elif omg_new < 0:
            omg_new = 2 * np.pi + omg_new

        # 处理真近点角范围 (0-2π)
        if f_new > 2 * np.pi:
            f_new -= 2 * np.pi
        elif f_new < 0:
            f_new = 2 * np.pi + f_new

        # 将处理后的角度参数写回
        sateOEmat[num, 2] = i_new
        sateOEmat[num, 3] = OMG_new
        sateOEmat[num, 4] = omg_new
        sateOEmat[num, 5] = f_new
        # sateOEmat[num, :] = [
        #     config.RE + H + 0 * (- 0.5) * 2,  # 半长轴
        #     0,                   # 偏心率
        #     inclination + 0.01 * config.deg * ( - 0.5) * 2,  # 倾角
        #     2 * np.pi / Pnum * P + 0.01 * config.deg * ( - 0.5) * 2,  # 升交点赤经
        #     0.1 * config.deg * ( - 0.5) * 2,  # 近地点幅角
        #     2 * np.pi / Snum * S + 2 * np.pi * F * P / Snum / Pnum + 0.1 * config.deg * ( - 0.5) * 2  # 真近点角
        # ]
        sateOETra[num, :] = np.concatenate((OrbitElementsToInertiastate(sateOEmat[num, :])/1000,np.array([0.03]),np.array([3])))


    # 轨道计算
    ts = 3
    Nstep = 1897
    all_sateOETra = np.zeros((28800, Nnum, 6))
    all_sateOEmat = np.zeros((28800, Nnum, 6))
    #迭代1000次，每次迭代3600颗星，共循环360万次
    # for step in range(Nstep):
    #     for num in range(Nnum):
    #
    #
    #         #没有卫星之间的相互依赖，仅仅依赖卫星自己的状态参数与部分常量
    #         sateOE = sateOEmat[num, :].copy()     #复制某个卫星的轨道六要素
    #         sateOE[5] = f_To_M(sateOE[1], sateOE[5])    # f转M 真近点角转平近点角，只需要自己的偏心率e和真近点角f
    #         #平近点角差
    #         sateOE[:] = PerturbedOrbit(sateOE[:], ts, step)     # 计算和修正卫星的扰动轨道
    #         sateOE[5] = M_To_f(sateOE[1], sateOE[5])    # M转f 计算修正后轨道的真近点角
    #         sateOEmat[num, :] = sateOE     #赋值给总的轨道六要素矩阵
    #
    #         sateOETra[num, :6] = OrbitElementsToInertiastate(sateOEmat[num, :])     #计算新的惯性系状态矢量
    #         sateOEmat[num, :] = InertiastateToOrbitElements(sateOETra[num, :6])
    #     all_sateOETra[step, :, :] = sateOETra[:, :6]
    #     all_sateOEmat[step, :, :] = sateOEmat

    return sateOEmat,sateOETra
    # return all_sateOEmat,all_sateOETra
if __name__ == "__main__":
    start_time = time.time()
    #! 随机生成轨道数据
    sateOEmat = np.zeros((Nnum, 6))     #轨道六要素矩阵
    sateOETra = np.zeros((Nnum, 8))     #转换得到的惯性系状态矢量
    # all_sateOEmat,all_sateOETra=funcserial(sateOEmat,sateOETra)
    sateOEmat, sateOETra=funcserial(sateOEmat,sateOETra)
    end_time = time.time()    
    print(end_time-start_time)
    data_to_save1 = []
    data_to_save2 = []

    ###演化过程保存
    # for step in range(28800):
    #     for num in range(Nnum):
    #         row = [step, num] + all_sateOEmat[step, num, :].tolist()
    #         row = [step, num] + all_sateOETra[step, num, :].tolist()
    #         data_to_save1.append(row)
    #         data_to_save2.append(row)
    # # 保存数据
    # # 列名
    # columns = ['时间步', '编号', 'a', 'e', 'i', 'OMG', 'omg', 'f']
    # columns2 = ['时间步', '编号', 'X', 'Y', 'Z', 'Vx', 'Vy', 'Vz']
    # # 创建 DataFrame
    # df = pd.DataFrame(data_to_save1, columns=columns)
    # df2 = pd.DataFrame(data_to_save2, columns=columns2)
    # # 保存到 CSV 文件
    # df.to_csv('两星轨道根数.csv', index=False)
    # df2.to_csv('两星惯性系状态.csv', index=False)
    # 画图
    ###
    for num in range(Nnum):
        row_orbit = [num] + sateOEmat[ num, :].tolist()
        row_inertial = [num] + sateOETra[ num, :].tolist()
        data_to_save1.append(row_orbit)
        data_to_save2.append(row_inertial)
    columns = [ '编号', 'a', 'e', 'i', 'OMG', 'omg', 'f']
    columns2 = [ '编号', 'X', 'Y', 'Z', 'Vx', 'Vy', 'Vz', 'cd_star', 'rcs']
    # 创建 DataFrame
    print(len(data_to_save1[0]))
    print(len(columns))

    df = pd.DataFrame(data_to_save1, columns=columns)
    df2 = pd.DataFrame(data_to_save2, columns=columns2)
    # 保存到 CSV 文件
    df.to_csv('3600星轨道根数km.csv', index=False)
    df2.to_csv('3600星惯性系状态km.csv', sep=' ',index=False)
    fig = plt.figure()
    ax = fig.add_subplot(111, projection='3d')
    for num in range(Nnum):
        ax.scatter(sateOETra[num, 0], sateOETra[num, 1], sateOETra[num, 2], c='b', marker='*')
    ax.set_xlabel('x (km)')
    ax.set_ylabel('y (km)')
    ax.set_zlabel('z (km)')
    plt.show()
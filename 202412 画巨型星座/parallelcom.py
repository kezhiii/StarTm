import numpy as np
import matplotlib.pyplot as plt
import config
from numba import jit
from perturbedOrbit import PerturbedOrbit
from M_To_ff import M_To_f
from orbitElementsToInertiastate import OrbitElementsToInertiastate
from f_To_MM import f_To_M
from mpi4py import MPI
import time
import pandas as pd
import os

'''
在 MATLAB 中，列向量 和 行向量 是通过明确的形状来区分的。
MATLAB 是基于矩阵运算的语言，所有数据的存储方式都是矩阵形式（即二维数组）。
在 MATLAB 中，向量是特定的矩阵，既可以是列向量（一个 $n \times 1$ 的矩阵），
也可以是行向量（一个 $1 \times n$ 的矩阵）。
Python 中的 numpy 库不像 MATLAB 那样严格区分行列向量。
numpy 默认使用一维数组来表示向量，它不强制要求使用列向量或行向量。
这是因为 numpy 更侧重于对数组进行广泛的广播操作，并且 numpy 可以自动处理不同维度的数组。
'''


comm=MPI.COMM_WORLD
rank = comm.Get_rank()
size = comm.Get_size()

#! 星座参数
H = 508e3  # 轨道高度 (m)
inclination = 55 * config.deg
F = 0
Pnum = 60#轨道数
Snum = 60#每个轨道卫星数
Nnum = Pnum * Snum#总卫星数
# @jit
# def initparallel():
    # me=rank    #当前进程号
    # MY=size-1   #最大进程号
    # m_num=Nnum//size
    
    #每个进程均匀分配卫星数，若不够均分则向下取整，最后一个进程分配剩余卫星
    #各个进程只计算自己进程内元素
    # if(rank!=size-1):
    #     this_num=m_num
    #     curnum=rank*this_num
    # else:
    #     this_num=Nnum-((size-1)*m_num)
    #     curnum=(Nnum-this_num)
    # mpi_sateOEmat=np.zeros((this_num,6))
    # mpi_sateOETra=np.zeros((this_num,6))
    # for num in range(curnum,curnum+this_num):
    #     S=num % Snum

    #     if S == 0:
    #         S = Snum
    #     P = (num - S) // Snum
    #     mpi_sateOEmat[num-curnum, :] = np.array([
    #         config.RE + H + 0 * (np.random.rand() - 0.5) * 2,  # 半长轴
    #         0.01 * np.random.rand(),                   # 偏心率
    #         inclination + 0.01 * config.deg * (np.random.rand() - 0.5) * 2,  # 倾角
    #         2 * np.pi / Pnum * P + 0.01 * config.deg * (np.random.rand() - 0.5) * 2,  # 升交点赤经
    #         0.1 * config.deg * (np.random.rand() - 0.5) * 2,  # 近地点幅角
    #         2 * np.pi / Snum * S + 2 * np.pi * F * P / Snum / Pnum + 0.1 * config.deg * (np.random.rand() - 0.5) * 2  # 真近点角
    #     ])

        
        # mpi_sateOEmat[num-curnum, :] = np.array([
        #     config.RE + H + 0 * (- 0.5) * 2,  # 半长轴
        #     0,                   # 偏心率
        #     inclination + 0.01 * config.deg * ( - 0.5) * 2,  # 倾角
        #     2 * np.pi / Pnum * P + 0.01 * config.deg * ( - 0.5) * 2,  # 升交点赤经
        #     0.1 * config.deg * ( - 0.5) * 2,  # 近地点幅角
        #     2 * np.pi / Snum * S + 2 * np.pi * F * P / Snum / Pnum + 0.1 * config.deg * ( - 0.5) * 2  # 真近点角
        # ])
        # mpi_sateOETra[num-curnum, :] = OrbitElementsToInertiastate(mpi_sateOEmat[num-curnum])

    # if(me!=MY):
    #     # mpi_sateOEmat=np.zeros((m_num,6))
    #     # mpi_sateOETra=np.zeros((m_num,6))
    #     mpi_sateOEmat[:,:]=sateOEmat[me*m_num:(me+1)*m_num,:]
    #     mpi_sateOETra[:,:]=sateOETra[me*m_num:(me+1)*m_num,:]
    # else:
    #     # mpi_sateOEmat=np.zeros((Nnum-(size-1)*m_num,6))
    #     # mpi_sateOETra=np.zeros((Nnum-(size-1)*m_num,6))
    #     mpi_sateOEmat[:,:]=sateOEmat[me*m_num:,:]
    #     mpi_sateOETra[:,:]=sateOETra[me*m_num:,:]
    # return mpi_sateOETra,mpi_sateOEmat,m_num
@jit
def funcparallel():
    # 轨道计算
    ts = 10     
    Nstep = 10000
    m_num=Nnum//size
    #迭代1000次，每次迭代this_num颗星，共循环this_num千次
    if(rank!=size-1):
        this_num=m_num
        curnum=rank*this_num
    else:
        this_num=Nnum-((size-1)*m_num)
        curnum=(Nnum-this_num)
    mpi_sateOEmat=np.zeros((this_num,6))
    mpi_sateOETra=np.zeros((this_num,6))
    for num in range(curnum,curnum+this_num):
        S=num % Snum

        if S == 0:
            S = Snum
        P = (num - S) // Snum
        mpi_sateOEmat[num-curnum, :] = np.array([
            config.RE + H + 0 * (np.random.rand() - 0.5) * 2,  # 半长轴
            0.01 * np.random.rand(),                   # 偏心率
            inclination + 0.01 * config.deg * (np.random.rand() - 0.5) * 2,  # 倾角
            2 * np.pi / Pnum * P + 0.01 * config.deg * (np.random.rand() - 0.5) * 2,  # 升交点赤经
            0.1 * config.deg * (np.random.rand() - 0.5) * 2,  # 近地点幅角
            2 * np.pi / Snum * S + 2 * np.pi * F * P / Snum / Pnum + 0.1 * config.deg * (np.random.rand() - 0.5) * 2  # 真近点角
        ])
    mpi_sateOETra[num-curnum, :] = OrbitElementsToInertiastate(mpi_sateOEmat[num-curnum])
        
    for step in range(Nstep):
        for num in range(this_num):
            #没有卫星之间的相互依赖，仅仅依赖卫星自己的状态参数与部分常量
            sateOE = mpi_sateOEmat[num, :].copy()     #复制某个卫星的轨道六要素
            sateOE[5] = f_To_M(sateOE[1], sateOE[5])    # f转M 真近点角转平近点角，只需要自己的偏心率e和真近点角f
            sateOE[:] = PerturbedOrbit(sateOE[:], ts, step)     # 计算和修正卫星的扰动轨道
            sateOE[5] = M_To_f(sateOE[1], sateOE[5])    # M转f 计算修正后轨道的真近点角
            mpi_sateOEmat[num, :] = sateOE     #赋值给总的轨道六要素矩阵
            mpi_sateOETra[num, :] = OrbitElementsToInertiastate(mpi_sateOEmat[num, :])     #计算新的惯性系状态矢量
    return mpi_sateOEmat,mpi_sateOETra


    # sateOETra[num, :] = OrbitElementsToInertiastate(sateOEmat[num])
def mpi_gather(mpi_sateOEmat,mpi_sateOETra):
    

    # 使用 comm.gather 收集数据到根进程
    if rank == 0:
        sateOEmat = np.array([])
        sateOETra = np.array([])
    else:
        sateOEmat = None
        sateOETra = None
    sateOEmat = comm.gather(mpi_sateOEmat, root=0)
    sateOETra = comm.gather(mpi_sateOETra, root=0)
    if rank == 0:
        # 将收集的数据转换为一个 (12, 6) 的数组
        sateOEmat = np.vstack(sateOEmat)  # 按行拼接数据
        sateOETra = np.vstack(sateOETra)
    return sateOEmat,sateOETra
if __name__ == "__main__":
    start_time = time.time()
    # #! 随机生成轨道数据

    # sateOEmat = np.zeros((Nnum, 6))     #轨道六要素矩阵
    # sateOETra = np.zeros((Nnum, 6))     #转换得到的惯性系状态矢量

    # # 循环3600次，3600颗星
    # if(rank==0):
    #     for num in range(Nnum):
    #         S = num % Snum
    #         if S == 0:
    #             S = Snum
    #         P = (num - S) // Snum
    #         sateOEmat[num, :] = np.array([
    #             config.RE + H + 0 * (np.random.rand() - 0.5) * 2,  # 半长轴
    #             0.01 * np.random.rand(),                   # 偏心率
    #             inclination + 0.01 * config.deg * (np.random.rand() - 0.5) * 2,  # 倾角
    #             2 * np.pi / Pnum * P + 0.01 * config.deg * (np.random.rand() - 0.5) * 2,  # 升交点赤经
    #             0.1 * config.deg * (np.random.rand() - 0.5) * 2,  # 近地点幅角
    #             2 * np.pi / Snum * S + 2 * np.pi * F * P / Snum / Pnum + 0.1 * config.deg * (np.random.rand() - 0.5) * 2  # 真近点角
    #         ])

    #         sateOETra[num, :] = OrbitElementsToInertiastate(sateOEmat[num])

    # #! 所有进程等待根进程初始化
    # comm.Bcast(sateOEmat,root=0)
    # comm.Bcast(sateOETra,root=0)
    # #! 生成卫星数据后进行并行初始化给各个进程分配数据，需要sateOEmat，sateOETra
    # mpi_sateOETra,mpi_sateOEmat,m_num=initparallel()
    #! 各个进程计算自己部分卫星轨道数据
    mpi_sateOEmat,mpi_sateOETra=funcparallel()
    #! 全部计算完毕后在根进程中收集数据
    sateOEmat,sateOETra=mpi_gather(mpi_sateOEmat,mpi_sateOETra)
    # 画图
    if(rank==0):
        end_time = time.time()
        print(end_time-start_time)
        # 保存数据
        # df = pd.DataFrame(sateOETra[:,:3], columns=['x (m)', 'y (m)', 'z (m)'])
        # file_path = os.path.join('运行结果', '并行去除随机数.xlsx')
        # df.to_excel(file_path, index=False)
        # 画图
        fig = plt.figure()
        ax = fig.add_subplot(111, projection='3d')
        for num in range(Nnum):
            ax.scatter(sateOETra[num, 0], sateOETra[num, 1], sateOETra[num, 2], c='b', marker='*')
        ax.set_xlabel('x (m)')
        ax.set_ylabel('y (m)')
        ax.set_zlabel('z (m)')
        plt.show()
import numpy as np
from numba import jit
import matplotlib.pyplot as plt
import config
from perturbedOrbit import PerturbedOrbit
from M_To_ff import M_To_f
from orbitElementsToInertiastate import OrbitElementsToInertiastate
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

# 2. 根据Sate[0]生成50个相似数据
def generate_similar_data(sate_0):
    num_samples = 50
    similar_data = np.zeros((num_samples+1,7))
    Similar_Inertiastate = np.zeros((num_samples+1,7))
    print(sate_0)

    for Num in range(num_samples):
        # 获取原始数据
        a, e, i, OMG, omg, f = sate_0[1:]  # 忽略编号列

        # 随机浮动范围
        if np.random.rand() < 0.5:  # 随机选择一个区间
            a_new = a + np.random.uniform(-50000, -10000)
        else:
            a_new = a + np.random.uniform(10000, 50000)
        if np.random.rand() < 0.5:  # 随机选择一个区间
            e_new = e + np.random.uniform(-0.001, -0.0005)
        else:
            e_new = e + np.random.uniform(0.0005, 0.001)
        # e_new = e + np.random.uniform(-0.001, 0.001)  # 离心率e浮动范围 [-0.001, 0.001]
        i_new = i + np.random.uniform(-(1 / 36) * 2 * np.pi, (1 / 36) * 2 * np.pi)
        OMG_new = OMG + np.random.uniform(-(1/36) * 2 * np.pi, (1/36) * 2 * np.pi)  # OMG浮动范围 [0, (1/36)*2π]
        omg_new = omg + np.random.uniform(-(1/36) * 2 * np.pi, (1/36) * 2 * np.pi)  # omg浮动范围 [0, (1/36)*2π]
        f_new = f + np.random.uniform(-(1/36) * 2 * np.pi, (1/36) * 2 * np.pi)  # f浮动范围 [0, (1/36)*2π]

        # 确保离心率在合理范围内 [0, 1)
        e_new = max(0, min(e_new, 1))

        # 检查角度范围是否合理（确保在 [0, 2π] 范围内）
        # i_new = normalize_angle(i_new)
        # OMG_new = normalize_angle(OMG_new)
        # omg_new = normalize_angle(omg_new)
        # f_new = normalize_angle(f_new)

        # 保存新生成的数据
        similar_data[Num] = [int(Num) ,a_new, e_new, i_new, OMG_new, omg_new, f_new]

        # 生成惯性系文件
        inertial_state_part = OrbitElementsToInertiastate(similar_data[Num][1:])/1000
        inertial_state = np.concatenate(([similar_data[Num][0]], inertial_state_part))
        Similar_Inertiastate[Num]=inertial_state
    similar_data[num_samples] = np.concatenate(([100],sate_0[1:]))
    observe = OrbitElementsToInertiastate(sate_0[1:])/1000
    Similar_Inertiastate[num_samples] = np.concatenate(([100],observe))
    return similar_data,Similar_Inertiastate

# 角度归一化函数：将角度限制在 [0, 2π] 范围内
def normalize_angle(angle):
    while angle < 0:
        angle += 2 * np.pi
    while angle >= 2 * np.pi:
        angle -= 2 * np.pi
    return angle

# 保存生成的数据到CSV文件
def save_data_to_csv(data,file_path,data1,file_path1):
    columns = ['编号','a', 'e', 'i', 'OMG', 'omg', 'f']
    df = pd.DataFrame(data, columns=columns)
    df.to_csv(file_path, index=False)


    # columns1 = ['编号','x','y','z','Vx','Vy','Vz','random0','random1']
    # # 创建第八列：0.001至0.0
    # column_8 = np.random.uniform(0.001, 0.09, size=(data1.shape[0], 1))
    #
    # # 创建第九列：从 3.1 开始，每行减 0.01
    # column_9 = np.random.uniform(0.001, 0.02, size=(data1.shape[0], 1))
    # # 将新列追加到数据中
    # data1 = np.hstack((data1, column_8, column_9))  # 水平拼接新列
    columns1 = ['时间步','编号' ,'x', 'y', 'z', 'Vx', 'Vy', 'Vz']
    # 获取数组的维度
    num_steps, num_satellites, num_states = data1.shape

    # 创建空列表存储展平后的数据
    flattened_data = []
    # 遍历时间步和编号，将数据展平为二维表格形式
    for step in range(num_steps):
        for sat_id in range(num_satellites):
            # 提取当前时间步和编号的状态量
            state = data1[step, sat_id]
            # 将时间步、编号和状态量组合成一行数据
            row = [step, sat_id] + list(state)
            flattened_data.append(row)

    # 确保第一列是整数类型
    # df1['编号'] = df1['编号'].astype(int)
    df1 = pd.DataFrame(flattened_data, columns=columns1)
    df1.to_csv(file_path1, index=False, sep=" ", float_format="%.6f")
def inference(similar_data):
    ts = 5
    Nstep = 11400*5   # 50圈采样
    Nnum=len(similar_data)
    all_sateOETra = np.zeros((Nstep, Nnum, 6))
    all_sateOEmat = np.zeros((Nstep, Nnum, 6))
    #迭代1000次，每次迭代3600颗星，共循环360万次
    for step in range(Nstep):
        for num in range(Nnum):


            #没有卫星之间的相互依赖，仅仅依赖卫星自己的状态参数与部分常量
            sateOE = similar_data[num, 1:].copy()     #复制某个卫星的轨道六要素
            sateOE[5] = f_To_M(sateOE[1], sateOE[5])    # f转M 真近点角转平近点角，只需要自己的偏心率e和真近点角f
            #平近点角差
            sateOE[:] = PerturbedOrbit(sateOE[:], ts, step)     # 计算和修正卫星的扰动轨道
            sateOE[5] = M_To_f(sateOE[1], sateOE[5])    # M转f 计算修正后轨道的真近点角
            similar_data[num, 1:] = sateOE     #赋值给总的轨道六要素矩阵

            Similar_Inertiastate[num, 1:] = OrbitElementsToInertiastate(similar_data[num, 1:])     #计算新的惯性系状态矢量
        # 最外层是时间步，第二层是各卫星，最外层是状态量
        all_sateOETra[step, :, :] = Similar_Inertiastate[:,1:]   # 惯性系
        all_sateOEmat[step, :, :] = similar_data[:,1:]   # 六根数
        # return 惯性系
    return all_sateOETra
# 主程序
if __name__ == "__main__":
    # CSV文件路径
    file_path = "1星轨道根数.csv"  # 替换为您的CSV文件路径
    output_file_path = "./运行结果/50_Random_Orbitdata.csv"  # 输出文件路径
    output_file_path1 = "./运行结果/50_Random_Inertiastate.csv"  # 输出文件路径
    # 读取CSV文件到数组Sate
    Sate = read_csv_to_sate(file_path)

    # 根据Sate[0]生成50个相似数据
    similar_data,Similar_Inertiastate = generate_similar_data(Sate[0])

    Similar_Inertiastate=inference(similar_data)
    # 打印结果
    print("生成的50个相似数据：")
    for idx, data in enumerate(similar_data):
        print(f"样本 {idx+1}: {data}")
    # 保存生成的数据到CSV文件
    save_data_to_csv(similar_data ,output_file_path,Similar_Inertiastate,output_file_path1)
    print(f"生成的数据已保存到 {output_file_path}")
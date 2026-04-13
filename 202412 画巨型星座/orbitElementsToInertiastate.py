import numpy as np

from numba import jit
#OrbitElements：输入量，轨道根数：a,e,qji,OMG,omg,f  （m,rad）
#InertiaState:输出量，惯性坐标位置和速度x,y,z,vx,vy,vz
#!把轨道根数转换为惯性坐标系下的状态

@jit
def OrbitElementsToInertiastate(OrbitElements: np.ndarray):
    
    MU = 3.986004415e14     #地球引力场数（m^3/s^2)
    #赤道惯性坐标轴OXYZ，OX指向春分点，OZ指向北极，OY在赤道面垂直于OX轴
    #交线上轨道自下而上穿过赤道平面的点为升交点
    #? a椭圆半长轴，e偏心率，f轨道位置与近地点之间夹角
    #? 轨道倾角qji，轨道平面与赤道平面之间的夹角
    #? 升交点赤经OMG：轨道平面与赤道平面相交线的升交点与OX轴夹角
    #? 近地点幅角omg：自轨道升交点沿卫星运动方向度量到近地点的角度
    #? 将f的范围调整到[0,2*pi]

    a, e, qji, OMG, omg, f = OrbitElements    
    while f > 2*np.pi:
        f = f-2*np.pi
    
    while f < 0:
        f = f+2*np.pi
    p = a * (1 - e**2)       #半通径=b^2/a
    r = p / (1 + e * np.cos(f))  # 距离（径向距离）
    # R = np.array([[r * np.cos(f)], [r * np.sin(f)], [0]])  # 位置向量（轨道平面）
    # V = np.sqrt(MU / p) * np.array([[-np.sin(f)],[ e + np.cos(f) ],[0]])  # 速度向量（轨道平面）
    #! 为了支持jit编译提高速率，进行下面修改，numba不支持np.array([],[])的构造二维数组
    R = np.array([r * np.cos(f), r * np.sin(f), 0])  # 位置向量（轨道平面）
    V = np.sqrt(MU / p) * np.array([-np.sin(f), e + np.cos(f) ,0])
    Aw = np.zeros((3, 3))
    Aw[0, 0] = np.cos(omg)
    Aw[0, 1] = np.sin(omg)
    Aw[1, 0] = -np.sin(omg)
    Aw[1, 1] = np.cos(omg)
    Aw[2, 2] = 1  # 固定值
# 倾角的旋转矩阵
    Ai = np.zeros((3, 3))
    Ai[0, 0] = 1
    Ai[1, 1] = np.cos(qji)
    Ai[1, 2] = np.sin(qji)
    Ai[2, 1] = -np.sin(qji)
    Ai[2, 2] = np.cos(qji)

    # 升交点赤经的旋转矩阵
    AOm = np.zeros((3, 3))
    AOm[0, 0] = np.cos(OMG)
    AOm[0, 1] = np.sin(OMG)
    AOm[1, 0] = -np.sin(OMG)
    AOm[1, 1] = np.cos(OMG)
    AOm[2, 2] = 1
    # Aw = np.array([
    #     [np.cos(omg), np.sin(omg), 0],
    #     [-np.sin(omg), np.cos(omg), 0],
    #     [0, 0, 1]
    # ])  # 近地点幅角的旋转矩阵
    #
    # Ai = np.array([
    #     [1, 0, 0],
    #     [0, np.cos(qji), np.sin(qji)],
    #     [0, -np.sin(qji), np.cos(qji)]
    # ])  # 倾角的旋转矩阵
    #
    # AOm = np.array([
    #     [np.cos(OMG), np.sin(OMG), 0],
    #     [-np.sin(OMG), np.cos(OMG), 0],
    #     [0, 0, 1]
    # ])  # 升交点赤经的旋转矩阵
     # 总变换矩阵
    A = Aw @ Ai @ AOm
     # 将位置和速度变换到惯性坐标系
    R_inertial = A.T @ R  # 转置后应用旋转矩阵
    V_inertial = A.T @ V
    

    
    # 使用hstack拼接大小为6的数组
    InertiaState = np.hstack((R_inertial.flatten(), V_inertial.flatten()))

    return InertiaState
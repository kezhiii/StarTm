import numpy as np

def InertiastateToOrbitElements(InertiaState):
    """
    由惯性空间位置速度计算轨道根数
    :param InertiaState: 输入量，惯性空间 X, Y, Z, VX, VY, VZ  (m, m/s)
    :return: 输出量，a, e, i, OMG, omg, f  (m, rad)
    """
    # 地球引力场数（m^3/s^2)
    MU = 3.986004415e14
    x = InertiaState[0]
    y = InertiaState[1]
    z = InertiaState[2]
    vx = InertiaState[3]
    vy = InertiaState[4]
    vz = InertiaState[5]

    # 参考 XJH 提供的书“航天器轨道力学”部分，第 38——39 页
    R = np.array([x, y, z])
    V = np.array([vx, vy, vz])
    E = ((np.dot(V, V) - MU / np.linalg.norm(R)) * R - np.dot(R, V) * V) / MU
    e = np.linalg.norm(E)
    H = np.cross(R, V)
    a = np.dot(H, H) / (MU * (1 - e ** 2))
    qji = np.arccos(H[2] / np.linalg.norm(H))

    if np.abs(qji) <= 10e-13:
        qji = 0
        OMG = 0

        if e <= 10e-13:
            e = 0
            omg = 0

            if R[1] > 0:
                f = np.arccos(R[0] / np.linalg.norm(R))
            else:
                f = 2 * np.pi - np.arccos(R[0] / np.linalg.norm(R))
        else:
            if E[1] > 0:
                omg = np.arccos(E[0] / np.linalg.norm(E))
            else:
                omg = 2 * np.pi - np.arccos(E[0] / np.linalg.norm(E))

            if np.dot(R, V) > 0:
                f = np.arccos(np.dot(R, E) / (e * np.linalg.norm(R)))
            else:
                f = 2 * np.pi - np.arccos(np.dot(R, E) / (e * np.linalg.norm(R)))
    else:
        N = np.array([-H[1], H[0], 0])
        if N[1] > 0:
            OMG = np.arccos(N[0] / np.linalg.norm(N))
        else:
            OMG = 2 * np.pi - np.arccos(N[0] / np.linalg.norm(N))

        if e <= 10e-13:
            e = 0
            omg = 0

            if R[2] > 0:
                f = np.arccos(np.dot(N, R) / (np.linalg.norm(R) * np.linalg.norm(N)))
            else:
                f = 2 * np.pi - np.arccos(np.dot(N, R) / (np.linalg.norm(R) * np.linalg.norm(N)))
        else:
            if E[2] > 0:
                if np.dot(N, E) / (e * np.linalg.norm(N)) > 1:
                    omg = 0
                else:
                    omg = np.arccos(np.dot(N, E) / (e * np.linalg.norm(N)))
            else:
                if np.dot(N, E) / (e * np.linalg.norm(N)) > 1:
                    omg = 2 * np.pi
                else:
                    omg = 2 * np.pi - np.arccos(np.dot(N, E) / (e * np.linalg.norm(N)))

            if np.dot(R, V) > 0:
                f = np.arccos(np.dot(R, E) / (e * np.linalg.norm(R)))
            else:
                f = 2 * np.pi - np.arccos(np.dot(R, E) / (e * np.linalg.norm(R)))

    # 输出
    OrbitElements = np.array([a, e, qji, OMG, omg, f])
    return OrbitElements

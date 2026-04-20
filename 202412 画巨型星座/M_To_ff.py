import numpy as np


#!平近点角M转换为真近点角f
def M_To_f(ee,M):
    kk = M / (2 * np.pi)
    M = M - np.floor(kk) * 2 * np.pi  # 将M归一化到 [0, 2*pi)
    
    # 初始偏心异常 E
    E = M + 0.85 * ee * np.sign(np.sin(M))
    y = E - ee * np.sin(E) - M

    # 牛顿法迭代求解偏心异常 E
    while abs(y) >= 1.0e-15:
        yita1 = E - ee * np.sin(E) - M
        yita2 = 1 - ee * np.cos(E)
        yita3 = ee * np.sin(E)
        yita4 = ee * np.cos(E)
        
        deta1 = -yita1 / yita2
        deta2 = -yita1 / (yita2 + 0.5 * deta1 * yita3)
        deta3 = -yita1 / (yita2 + 0.5 * deta2 * yita3 + deta2**2 * yita4 / 6)
        
        E = E + deta3
        y = E - ee * np.sin(E) - M
    
    # 从偏心异常 E 计算真近点角 f
    f = 2 * np.arctan(np.sqrt((1 + ee) / (1 - ee)) * np.tan(E / 2))
    
    return f
import numpy as np
#!真近点角f转换为平近点角M
def f_To_M(e,f):
    # 计算偏近点角 E
    E = 2 * np.arctan(np.sqrt((1 - e) / (1 + e)) * np.tan(f / 2))
    
    # 计算平近点角 M
    M = E - e * np.sin(E)
    return M

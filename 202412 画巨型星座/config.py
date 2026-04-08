import numpy as np
#! 常量
mu = 3.986004418e14 #地心引力常数(m^3/s^2)
mu_moon = 4.903e12 #月球引力常数(m^3/s^2)
mu_sun = 1.32712440018e20 #太阳引力常数(m^3/s^2)
RE = 6.378137e6 #地球半径(m)
J2 = 1.082626683e-3 #J2摄动参数
wE = np.array([[0], [0], [7.2921159e-5]])  #地球自转角速度

hours = 3600         # 小时转秒
days = 24 * hours    # 天转秒
deg = np.pi / 180    # 度转弧度

#! 儒略日计算
Year, Month, Day = 2021, 8, 17
JD0 = Day - 32075 + 1461 * (Year + 4800 + (Month - 14) // 12) // 4 \
    + 367 * (Month - 2 - (Month - 14) // 12 * 12) // 12 \
    - 3 * ((Year + 4900 + (Month - 14) // 12) // 100) // 4

#! 星座参数
H = 400e3  # 轨道高度 (m)
inclination = 55 * deg
F = 0
Pnum = 20#轨道数
Snum = 15#每个轨道卫星数
Nnum = Pnum * Snum#总卫星数
#! 儒略日计算
Year, Month, Day = 2021, 8, 17
JD0 = Day - 32075 + 1461 * (Year + 4800 + (Month - 14) // 12) // 4 \
    + 367 * (Month - 2 - (Month - 14) // 12 * 12) // 12 \
    - 3 * ((Year + 4900 + (Month - 14) // 12) // 100) // 4

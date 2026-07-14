import numpy as np
mu = 3.986004418e14
mu_moon = 4.903e12
mu_sun = 1.32712440018e20
RE = 6.378137e6
J2 = 1.082626683e-3
wE = np.array([[0], [0], [7.2921159e-5]])

days = 86400
deg = np.pi / 180

Year, Month, Day = 2021, 8, 17
JD0 = Day - 32075 + 1461 * (Year + 4800 + (Month - 14) // 12) // 4 \
    + 367 * (Month - 2 - (Month - 14) // 12 * 12) // 12 \
    - 3 * ((Year + 4900 + (Month - 14) // 12) // 100) // 4

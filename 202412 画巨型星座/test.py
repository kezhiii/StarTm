import numpy as np
from numba import njit
from test2 import OrbitElementsToInertiastate 
if __name__ == "__main__":
    a=np.array([1,2,3,4,5,6])
    OrbitElementsToInertiastate(a)
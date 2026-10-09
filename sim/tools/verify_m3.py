# -*- coding: utf-8 -*-
"""verify_m3.py — 姿态链离线验证：nadir 指向、双翼法向、机动转角"""
import json, math
import numpy as np
import pandas as pd

def skipc(p):
    with open(p, encoding="utf-8") as f:
        return "".join(l for l in f if not l.startswith("#"))

att = pd.read_csv(pd.io.common.StringIO(skipc("sim-data/preview/attitude.csv")))
orb = pd.read_csv(pd.io.common.StringIO(skipc("sim-data/preview/orbit_j2000.csv")))

def qmul(a, b):
    ax, ay, az, aw = a; bx, by, bz, bw = b
    return np.array([aw*bx + ax*bw + ay*bz - az*by,
                     aw*by - ax*bz + ay*bw + az*bx,
                     aw*bz + ax*by - ay*bx + az*bw,
                     aw*bw - ax*bx - ay*by - az*bz])
def qconj(q):
    c = q.copy(); c[:3] *= -1; return c
def qrot(q, v):
    w = q[3]; u = q[:3]
    uv = np.cross(u, v); uvu = np.cross(u, uv)
    return v + 2*w*uv + 2*uvu
def qangle(a, b):
    d = abs(float(np.dot(a, b)))
    return math.degrees(2*math.acos(min(1.0, d)))

SAT_SCALE = 50 / 6378.137
P = np.array([[1, 0, 0], [0, 0, 1], [0, -1, 0]], dtype=float)   # ECI→场景 (x,y,z)→(x,z,-y)

out = {}
# ---- 1. nadir 指向：t=0，body -Z（发光面法向）应指向地心 ----
q0 = att[att.sat_id == 1].iloc[0][["q_j2b_x", "q_j2b_y", "q_j2b_z", "q_j2b_w"]].to_numpy(float)
r0 = orb[orb.sat_id == 1].iloc[0][["X", "Y", "Z"]].to_numpy(float)
q_scene0 = qmul(np.array([-math.sqrt(0.5), 0, 0, math.sqrt(0.5)]), qconj(q0))
negz = qrot(q_scene0, np.array([0, 0, -1.0]))
pos_scene = P @ r0 * SAT_SCALE
dir_to_earth = -pos_scene / np.linalg.norm(pos_scene)
dot_nadir = float(np.dot(negz / np.linalg.norm(negz), dir_to_earth))
out["nadir_发光面法向指向地心_dot"] = round(dot_nadir, 6)

# ---- 2. 太阳翼：body ±Y_B = ±N̂（轨道面法向），验证翼轴与轨道法向平行 ----
v0 = orb[orb.sat_id == 1].iloc[0][["VX", "VY", "VZ"]].to_numpy(float)
nhat = np.cross(r0, v0); nhat /= np.linalg.norm(nhat)
yaxis = qrot(q_scene0, np.array([0, 1.0, 0]))
yaxis_eci = P.T @ yaxis  # 回到 ECI 对照
dot_wing = abs(float(np.dot(yaxis_eci / np.linalg.norm(yaxis_eci), nhat)))
out["太阳翼轴与轨道法向_平行度_abs_dot"] = round(dot_wing, 6)

# ---- 3. 机动转角：q_rtn2b 在机动前后相对转角应为 15° ----
t_man = 60000 // 60  # 预览步长 60 s → 机动起点步 1000
q_r0 = att[att.sat_id == 1].iloc[0][["q_rtn2b_x", "q_rtn2b_y", "q_rtn2b_z", "q_rtn2b_w"]].to_numpy(float)
q_r1 = att[att.sat_id == 1].iloc[t_man + 60][["q_rtn2b_x", "q_rtn2b_y", "q_rtn2b_z", "q_rtn2b_w"]].to_numpy(float)
rel = qmul(q_r1, qconj(q_r0))
out["机动后RTN系相对转角_deg"] = round(qangle(q_r0, q_r1), 3)

# ---- 4. 入射角联动自检：机动绕 Y_B（太阳翼轴向）→ 翼面入射角应不变、-Z 面变化 ----
# 由 sun_eclipse.csv 的 incidence 列直接核对
sun = pd.read_csv(pd.io.common.StringIO(skipc("sim-data/preview/sun_eclipse.csv")))
s1 = sun[sun.sat_id == 1].reset_index(drop=True)
out["入射角_机动前"] = round(float(s1.incidence_deg.iloc[t_man - 1]), 3)
out["入射角_机动后60s"] = round(float(s1.incidence_deg.iloc[t_man + 60]), 3)

out["判定"] = None
ok = abs(dot_nadir - 1) < 1e-4 and dot_wing > 0.9999 and abs(out["机动后RTN系相对转角_deg"] - 15.0) < 0.5
out["判定"] = "PASS" if ok else "FAIL"
with open("sim-data/verify_m3.json", "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, indent=2)
print(json.dumps(out, ensure_ascii=False, indent=2))

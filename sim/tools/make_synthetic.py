# -*- coding: utf-8 -*-
"""
make_synthetic.py — 生成 24h×1s×3星 合成数据集（链路验证用）

动力学口径：两体自由漂移（非 STK HPOP、非 NaturalHCW），仅用于打通数据管线；
真数据到位后按类别逐文件替换。自检断言内嵌，不通过即中止。
"""
import json, math, os, time
import numpy as np
import pandas as pd
from astropy.time import Time
from astropy.coordinates import get_sun, GCRS
import astropy.units as u
from astropy.utils import iers
import erfa
from scipy.integrate import solve_ivp

iers.conf.auto_download = False
iers.conf.auto_max_age = None

MU = 398600.4418
A = 6978.137
INC = math.radians(97.787669525)
RAAN = math.radians(260.833199252)
T0 = "2026-09-13 04:00:00"
DUR = 86400
SAT = {1: "TM0S1", 2: "TM0S2", 3: "TM0S3"}
SIDE = 1.0
R_CIRC = SIDE / math.sqrt(3.0)
PHASES = [90.0, 210.0, 330.0]
MAN_T0, MAN_T1, MAN_DEG = 60000.0, 60030.0, 15.0
HEFEI = (117.2272, 31.8206, 0.010)
EL_MIN, CONE_DEG, TURN = 10.0, 1.0, 300.0
OUT = "sim-data"
N_ORB = math.sqrt(MU / A**3)

def utcg(i):
    t = Time(T0, scale="utc") + i * u.s
    return t.iso[:19]

t_start = time.time()
print("1/7 轨道：读取杨宏俊交付的 STK J2000 瞬时根数（sim-data/orebit elements，1 s 采样）并闭式重建位置速度")
OE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "sim-data", "orebit elements")
MONTH = {"Jan": 1, "Feb": 2, "Mar": 3, "Apr": 4, "May": 5, "Jun": 6,
         "Jul": 7, "Aug": 8, "Sep": 9, "Oct": 10, "Nov": 11, "Dec": 12}

def parse_oe(path):
    t, a_, e_, i_, O_, w_, nu_ = [], [], [], [], [], [], []
    for line in open(path, encoding="utf-8"):
        parts = line.split()
        if len(parts) != 11 or not parts[0].isdigit():
            continue
        hh, mm, ss = parts[3].split(":")
        t.append(f"{parts[2]}-{MONTH[parts[1]]:02d}-{int(parts[0]):02d} "
                 f"{int(hh):02d}:{int(mm):02d}:{int(float(ss)):02d}")
        a_.append(float(parts[4])); e_.append(float(parts[5])); i_.append(math.radians(float(parts[6])))
        O_.append(math.radians(float(parts[7]))); w_.append(math.radians(float(parts[8])))
        nu_.append(math.radians(float(parts[9])))
    return (np.array(t), np.array(a_), np.array(e_), np.array(i_), np.array(O_), np.array(w_), np.array(nu_))

def oe_to_rv(a_, e_, i_, O_, w_, nu_):
    """瞬时根数闭式重建 J2000 位置/速度。位置由根数唯一确定（与 HPOP 一致），
    速度解析式不含摄动项，近圆小 e 下误差可忽略（显示用途）。"""
    p = a_ * (1 - e_ * e_)
    r = p / (1 + e_ * np.cos(nu_))
    vm = np.sqrt(MU / p)
    cO, sO = np.cos(O_), np.sin(O_)
    ci, si = np.cos(i_), np.sin(i_)
    cw, sw = np.cos(w_), np.sin(w_)
    cn, sn = np.cos(nu_), np.sin(nu_)
    Ph0 = cO*cw - sO*sw*ci; Ph1 = sO*cw + cO*sw*ci; Ph2 = sw*si
    Qh0 = -cO*sw - sO*cw*ci; Qh1 = -sO*sw + cO*cw*ci; Qh2 = cw*si
    X = Ph0*r*cn + Qh0*r*sn
    Y = Ph1*r*cn + Qh1*r*sn
    Z = Ph2*r*cn + Qh2*r*sn
    VX = Ph0*vm*(-sn) + Qh0*vm*(e_ + cn)
    VY = Ph1*vm*(-sn) + Qh1*vm*(e_ + cn)
    VZ = Ph2*vm*(-sn) + Qh2*vm*(e_ + cn)
    return np.stack([X, Y, Z]), np.stack([VX, VY, VZ])

grid = None
sat_r = {}; sat_v = {}
oe_meta = {}
for k in (1, 2, 3):
    t_, a_, e_, i_, O_, w_, nu_ = parse_oe(os.path.join(OE_DIR, f"{SAT[k]}_Classical_Orbit_Elements.txt"))
    if grid is None:
        grid = np.arange(len(t_), dtype=float)
        n_pts = grid.size
        DUR = n_pts - 1
    assert len(t_) == n_pts, f"{SAT[k]} 行数 {len(t_)} != {n_pts}"
    sat_r[k], sat_v[k] = oe_to_rv(a_, e_, i_, O_, w_, nu_)
    oe_meta[SAT[k]] = {"a0": float(a_[0]), "e0": float(e_[0]),
                       "inc0_deg": round(math.degrees(i_[0]), 4), "raan0_deg": round(math.degrees(O_[0]), 4),
                       "argp0_deg": round(math.degrees(w_[0]), 3), "nu0_deg": round(math.degrees(nu_[0]), 3)}
    print(f"   {SAT[k]} 根数 {n_pts} 行，a0={oe_meta[SAT[k]]['a0']} km")

rc = (sat_r[1] + sat_r[2] + sat_r[3]) / 3.0          # 几何中心代参考中心（参考中心列未交付，见清单）
vc = (sat_v[1] + sat_v[2] + sat_v[3]) / 3.0

Rhat = rc / np.linalg.norm(rc, axis=0)
hvec = np.cross(rc, vc, axis=0)
Nhat = hvec / np.linalg.norm(hvec, axis=0)
That = np.cross(Nhat, Rhat, axis=0)

print("2/7 自检：真实根数下的初始几何")
r_norm = np.linalg.norm(rc, axis=0)
assert np.all((r_norm > 6900) & (r_norm < 7050)), f"中心地心距异常 {r_norm[0]}"
e0 = np.linalg.norm(sat_r[1][:, 0] - sat_r[2][:, 0])
e1 = np.linalg.norm(sat_r[2][:, 0] - sat_r[3][:, 0])
e2 = np.linalg.norm(sat_r[3][:, 0] - sat_r[1][:, 0])
assert max(e0, e1, e2) < 15.0, "初始边长超过 15 km，与任何一版口径都不符"
print(f"   实测初始边长: {e0:.4f} / {e1:.4f} / {e2:.4f} km（第3章标称 1 km 等边，表4-3.1 写约 10 km 同轨沿轨）")
print(f"   初始纬度幅角 u: S1={oe_meta['TM0S1']['argp0_deg']+oe_meta['TM0S1']['nu0_deg']:.2f}°, "
      f"S2={oe_meta['TM0S2']['argp0_deg']+oe_meta['TM0S2']['nu0_deg']:.2f}°, "
      f"S3={oe_meta['TM0S3']['argp0_deg']+oe_meta['TM0S3']['nu0_deg']:.2f}°")

print("3/7 RTN 相对状态、构型几何、瞬时根数")
B = np.stack([Rhat, That, Nhat], axis=1)              # (3,3,n) 列=R,T,N，RTN→J2000
rtn_p = {}; rtn_v = {}
for k in (1, 2, 3):
    rtn_p[k] = np.einsum("ijn,jn->in", B, sat_r[k] - rc)
    rtn_v[k] = np.einsum("ijn,jn->in", B, sat_v[k] - vc)
geom_c = (sat_r[1] + sat_r[2] + sat_r[3]) / 3.0
drift = np.einsum("ijn,jn->in", B, geom_c - rc)
e12 = np.linalg.norm(sat_r[1] - sat_r[2], axis=0)
e23 = np.linalg.norm(sat_r[2] - sat_r[3], axis=0)
e31 = np.linalg.norm(sat_r[3] - sat_r[1], axis=0)
cd = {k: np.linalg.norm(rtn_p[k], axis=0) for k in (1, 2, 3)}
phase1 = np.degrees(np.arctan2(rtn_p[1][2], rtn_p[1][1])) % 360.0

def osculating(r, v):
    h = np.cross(r, v, axis=0); hh = np.linalg.norm(h, axis=0)
    inc = np.degrees(np.arccos(np.clip(h[2]/hh, -1, 1)))
    nv = np.cross([0, 0, 1.0], h, axis=0)
    raan = np.degrees(np.arctan2(nv[1], -nv[0])) % 360.0
    ev = np.cross(v, h, axis=0)/MU - r/np.linalg.norm(r, axis=0)
    sma = 1.0 / (2.0/np.linalg.norm(r, axis=0) - np.linalg.norm(v, axis=0)**2/MU)
    return sma, np.linalg.norm(ev, axis=0), inc, raan

print("4/7 太阳、ITRF、合肥观测（erfa 向量化）")
times = Time(T0, scale="utc") + grid * u.s
M_c2t = erfa.c2t06a(times.tt.jd1, times.tt.jd2, times.utc.jd1, times.utc.jd2, 0.0, 0.0)
sun_g = get_sun(times).transform_to(GCRS(obstime=times))
sun_u = np.stack([sun_g.cartesian.x.to(u.km).value,
                  sun_g.cartesian.y.to(u.km).value,
                  sun_g.cartesian.z.to(u.km).value])
sun_u /= np.linalg.norm(sun_u, axis=0)
sun_i = np.einsum("nij,jn->in", M_c2t, sun_u)

F = 6.69437999014e-3
lonr, latr = math.radians(HEFEI[0]), math.radians(HEFEI[1])
Nell = 6378.137 / math.sqrt(1 - F * math.sin(latr)**2)
obs_itrf = np.array([(Nell + HEFEI[2]) * math.cos(latr) * math.cos(lonr),
                     (Nell + HEFEI[2]) * math.cos(latr) * math.sin(lonr),
                     (Nell * (1 - F) + HEFEI[2]) * math.sin(latr)])
sl, cl, so, co = math.sin(latr), math.cos(latr), math.sin(lonr), math.cos(lonr)
M_enu = np.array([[-so, co, 0.0], [-sl*co, -sl*so, cl], [cl*co, cl*so, sl]])

sat_itrf = {k: np.einsum("nij,jn->in", M_c2t, sat_r[k]) for k in (1, 2, 3)}
az = {}; el = {}; rng = {}; vis = {}
for k in (1, 2, 3):
    d = M_enu @ (sat_itrf[k] - obs_itrf[:, None])
    rng[k] = np.linalg.norm(d, axis=0)
    el[k] = np.degrees(np.arcsin(np.clip(d[2]/rng[k], -1, 1)))
    az[k] = np.degrees(np.arctan2(d[0], d[1])) % 360.0
    vis[k] = el[k] >= EL_MIN
common = vis[1] & vis[2] & vis[3]
sun_enu = M_enu @ (sun_i - obs_itrf[:, None])
sun_alt = np.degrees(np.arcsin(np.clip(sun_enu[2]/np.linalg.norm(sun_enu, axis=0), -1, 1)))
print(f"   共同可见 {int(common.sum())} s（门限 {EL_MIN}°）；太阳高度范围 "
      f"{sun_alt.min():.2f}° ~ {sun_alt.max():.2f}°")

print("5/7 姿态四元数与入射角")
def q_from_m_vec(Ms):
    q = np.empty((Ms.shape[0], 4))
    tr = Ms[:, 0, 0] + Ms[:, 1, 1] + Ms[:, 2, 2]
    branch = np.argmax(np.stack([tr,
                                 Ms[:, 0, 0] - Ms[:, 1, 1] - Ms[:, 2, 2],
                                 Ms[:, 1, 1] - Ms[:, 0, 0] - Ms[:, 2, 2],
                                 Ms[:, 2, 2] - Ms[:, 0, 0] - Ms[:, 1, 1]]), axis=0)
    m = branch == 0; s = 2*np.sqrt(1 + tr[m])
    q[m, 3] = s/4; q[m, 0] = (Ms[m,2,1]-Ms[m,1,2])/s; q[m, 1] = (Ms[m,0,2]-Ms[m,2,0])/s; q[m, 2] = (Ms[m,1,0]-Ms[m,0,1])/s
    m = branch == 1; s = 2*np.sqrt(1 + Ms[m,0,0]-Ms[m,1,1]-Ms[m,2,2])
    q[m, 3] = (Ms[m,2,1]-Ms[m,1,2])/s; q[m, 0] = s/4; q[m, 1] = (Ms[m,0,1]+Ms[m,1,0])/s; q[m, 2] = (Ms[m,0,2]+Ms[m,2,0])/s
    m = branch == 2; s = 2*np.sqrt(1 - Ms[m,0,0]+Ms[m,1,1]-Ms[m,2,2])
    q[m, 3] = (Ms[m,0,2]-Ms[m,2,0])/s; q[m, 0] = (Ms[m,0,1]+Ms[m,1,0])/s; q[m, 1] = s/4; q[m, 2] = (Ms[m,1,2]+Ms[m,2,1])/s
    m = branch == 3; s = 2*np.sqrt(1 - Ms[m,0,0]-Ms[m,1,1]+Ms[m,2,2])
    q[m, 3] = (Ms[m,1,0]-Ms[m,0,1])/s; q[m, 0] = (Ms[m,0,2]+Ms[m,2,0])/s; q[m, 1] = (Ms[m,1,2]+Ms[m,2,1])/s; q[m, 2] = s/4
    return q / np.linalg.norm(q, axis=1, keepdims=True)

def q_mul(a, b):   # a⊗b，先 b 后 a
    aw, ax, ay, az_ = a[..., 3], a[..., 0], a[..., 1], a[..., 2]
    bw, bx, by, bz = b[..., 3], b[..., 0], b[..., 1], b[..., 2]
    return np.stack([aw*bx + ax*bw + ay*bz - az_*by,
                     aw*by - ax*bz + ay*bw + az_*bx,
                     aw*bz + ax*by - ay*bx + az_*bw,
                     aw*bw - ax*bx - ay*by - az_*bz], axis=-1)

def q_conj(q):
    c = q.copy(); c[:3] *= -1; return c

def q_rot(q, v):   # J2000→body：v_body = q v q*
    w = q[..., 3:4]; u_ = q[..., :3]
    uv = np.cross(u_, v); uvu = np.cross(u_, uv)
    return v + 2*w*uv + 2*uvu

M_rtn2b = np.array([[0.0, 1.0, 0.0], [0.0, 0.0, 1.0], [1.0, 0.0, 0.0]])
M_j2rtn = np.stack([Rhat, That, Nhat], axis=1).transpose(2, 1, 0)  # (n,3,3) 行=R,T,N
q_rtn2b = q_from_m_vec(M_rtn2b[None, None, :, :].reshape(1, 3, 3))[0]
q_j2rtn = q_from_m_vec(M_j2rtn)
q_j2b = q_mul(q_rtn2b[None, :], q_j2rtn)

chk_R = q_rot(q_j2b, Rhat.T)
chk_T = q_rot(q_j2b, That.T)
assert np.allclose(chk_R[0], [0, 0, 1], atol=1e-12), chk_R[0]
assert np.allclose(chk_T[0], [1, 0, 0], atol=1e-12), chk_T[0]
print("   姿态链校验通过：e_R→+Z_B，e_T→+X_B")

# 机动：绕 +Y_B 转 MAN_DEG，线性过渡
qm = np.tile(np.array([0.0, 0.0, 0.0, 1.0]), (n_pts, 1))
mask = (grid >= MAN_T0) & (grid <= MAN_T1)
ang = np.zeros(n_pts)
ang[mask] = math.radians(MAN_DEG) * (grid[mask] - MAN_T0) / (MAN_T1 - MAN_T0)
ang[grid > MAN_T1] = math.radians(MAN_DEG)
qm[mask | (grid > MAN_T1), 0] = np.sin(ang[mask | (grid > MAN_T1)] / 2)
qm[mask | (grid > MAN_T1), 3] = np.cos(ang[mask | (grid > MAN_T1)] / 2)
q_j2b_m = q_mul(qm, q_j2b)
assert np.allclose(np.linalg.norm(q_j2b_m, axis=1), 1.0, atol=1e-12)

sun_b = {k: q_rot(q_conj(q_j2b_m), sun_u.T) for k in (1, 2, 3)}
inc = {k: np.degrees(np.arccos(np.clip(sun_b[k][:, 2], -1, 1))) for k in (1, 2, 3)}
nom = inc[2][~mask & (grid < MAN_T0)]
print(f"   名义入射角范围 {nom.min():.3f}° ~ {nom.max():.3f}°（理论 90°±(90°-β)）")
assert 77.0 < nom.min() < 79.5 and 100.5 < nom.max() < 102.5

anti = -np.sum(sun_u * rc, axis=0)
perp = np.linalg.norm(rc - sun_u * np.sum(sun_u * rc, axis=0)[None, :], axis=0)
ecl_flag = ((anti > 0) & (perp < 6378.137)).astype(int)
print(f"   地影采样点 {int(ecl_flag.sum())}（复核晨昏轨道零地影）")

print("6/7 目标入锥、地面投影、事件表")
dir_t = {}
off_axis = {}
for k in (1, 2, 3):
    bore = q_rot(q_conj(q_j2b_m), np.tile([0.0, 0.0, -1.0], (n_pts, 1)))
    obs_g = np.einsum("nji,jn->in", M_c2t, np.repeat(obs_itrf[:, None], n_pts, axis=1))
    d = obs_g - sat_r[k]
    dir_t[k] = (d / np.linalg.norm(d, axis=0)).T          # (n,3)
    off_axis[k] = np.degrees(np.arccos(np.clip(np.sum(bore * dir_t[k], axis=1), -1, 1)))
incone = {k: off_axis[k] <= CONE_DEG for k in (1, 2, 3)}

kvec = np.zeros((3, n_pts))
for k in (1, 2, 3):
    kvec += (obs_itrf[:, None] - sat_r[k])
kvec /= np.linalg.norm(kvec, axis=0)
e_ref = np.tile(np.array([0.0, 0.0, 1.0])[:, None], (1, n_pts))
degenerate = np.abs(np.sum(kvec * e_ref, axis=0)) > 0.9
e_ref[:, degenerate] = np.array([1.0, 0.0, 0.0])[:, None]
u_b = np.cross(kvec, e_ref, axis=0); u_b /= np.linalg.norm(u_b, axis=0)
v_b = np.cross(kvec, u_b, axis=0)
proj = {k: ((obs_itrf[:, None] - sat_r[k]) * u_b).sum(0) for k in (1, 2, 3)}
projv = {k: ((obs_itrf[:, None] - sat_r[k]) * v_b).sum(0) for k in (1, 2, 3)}

events = []
def add_ev(cat, sat, t0s, t1s, reason):
    events.append({"category": cat, "sat_id": sat, "t_plan": utcg(t0s), "t_actual": utcg(t0s),
                   "duration_s": round(t1s - t0s, 3), "reason": reason})
def runs(flag):
    out = []
    on = False
    for i, f in enumerate(flag):
        if f and not on: start = i; on = True
        if not f and on: out.append((grid[start], grid[i-1])); on = False
    if on: out.append((grid[start], grid[n_pts-1]))
    return out

for k in (1, 2, 3):
    for a_, b_ in runs(vis[k]):
        add_ev("可见区间", SAT[k], a_, b_, f"仰角>={EL_MIN}")
for a_, b_ in runs(common):
    add_ev("转向", "ALL", a_ - TURN, a_, "显示前转向准备")
    add_ev("显示任务", "ALL", a_, b_, "三星共同可见")
    add_ev("恢复", "ALL", b_, b_ + TURN, "显示后恢复")
add_ev("控制", "ALL", MAN_T0, MAN_T1, f"绕Y_B机动{MAN_DEG}度")
ev_id = 0
for a_, b_ in runs(common):
    seg = grid[(grid >= a_) & (grid <= b_)]
    for t_ in seg:
        lit = int((t_ - a_)) % 2 == 0
        events.append({"category": "点亮" if lit else "熄灭", "sat_id": "ALL",
                       "t_plan": utcg(t_), "t_actual": utcg(t_), "duration_s": 0.5 if lit else 0.0,
                       "reason": "1Hz频闪"})
        ev_id += 1
events_df = pd.DataFrame(events)
events_df.insert(0, "event_id", range(1, len(events_df) + 1))

print("7/7 写出 CSV")
os.makedirs(OUT, exist_ok=True)
tstr = np.array([utcg(int(i)) for i in grid])
mission = "TM-V0-SIM"; mode = "FreeDrift-Synthetic"; pver = "synth-v1"

def write(name, df, coord, unit):
    with open(f"{OUT}/{name}", "w", encoding="utf-8", newline="") as f:
        f.write("# 列名: " + ", ".join(df.columns) + "\n")
        f.write("# 坐标系: " + ", ".join(coord) + "\n")
        f.write("# 单位: " + ", ".join(unit) + "\n")
        df.to_csv(f, index=False, float_format="%.9g")

idx = pd.DataFrame({"sat_id": np.tile([1, 2, 3], n_pts),
                    "rel_s": np.repeat(grid, 3).astype(np.int64),
                    "utcg": np.tile(tstr, 3)})
write("time_ident.csv",
      pd.DataFrame({"rel_s": grid.astype(np.int64), "utcg": tstr,
                    "mission": mission, "mode": mode, "param_ver": pver}),
      ["s", "UTC", "-", "-", "-"], ["s", "-", "-", "-", "-"])

parts = []
for k in (1, 2, 3):
    parts.append(pd.DataFrame({"sat_id": k, "rel_s": grid.astype(np.int64), "utcg": tstr,
        "X": sat_r[k][0], "Y": sat_r[k][1], "Z": sat_r[k][2],
        "VX": sat_v[k][0], "VY": sat_v[k][1], "VZ": sat_v[k][2]}))
write("orbit_j2000.csv", pd.concat(parts), ["-", "s", "UTC", "J2000", "J2000", "J2000", "J2000", "J2000", "J2000"],
      ["-", "s", "-", "km", "km", "km", "km/s", "km/s", "km/s"])
write("orbit_j2000_fc.csv",
      pd.DataFrame({"sat_id": 0, "rel_s": grid.astype(np.int64), "utcg": tstr,
                    "X": rc[0], "Y": rc[1], "Z": rc[2],
                    "VX": vc[0], "VY": vc[1], "VZ": vc[2]}),
      ["-", "s", "UTC", "J2000", "J2000", "J2000", "J2000", "J2000", "J2000"],
      ["-", "s", "-", "km", "km", "km", "km/s", "km/s", "km/s"])

o_parts = []
for k in (1, 2, 3):
    sma, ecc, inc_o, raan_o = osculating(sat_r[k], sat_v[k])
    sublat = np.degrees(np.arctan2(sat_itrf[k][2] * (1 - F),
                     np.hypot(sat_itrf[k][0], sat_itrf[k][1])))
    sublon = np.degrees(np.arctan2(sat_itrf[k][1], sat_itrf[k][0]))
    o_parts.append(pd.DataFrame({"sat_id": k, "rel_s": grid.astype(np.int64), "utcg": tstr,
        "itrf_x": sat_itrf[k][0], "itrf_y": sat_itrf[k][1], "itrf_z": sat_itrf[k][2],
        "sublat": sublat, "sublon": sublon, "sma": sma, "ecc": ecc, "inc": inc_o, "raan": raan_o}))
write("orbit_itrf.csv", pd.concat(o_parts),
      ["-", "s", "UTC", "ITRF", "ITRF", "ITRF", "WGS84", "WGS84", "J2000瞬时", "J2000瞬时", "J2000瞬时", "J2000瞬时"],
      ["-", "s", "-", "km", "km", "km", "deg", "deg", "km", "-", "deg", "deg"])

f_parts = []
for k in (1, 2, 3):
    f_parts.append(pd.DataFrame({"sat_id": k, "rel_s": grid.astype(np.int64), "utcg": tstr,
        "R": rtn_p[k][0], "T": rtn_p[k][1], "N": rtn_p[k][2],
        "Vr": rtn_v[k][0], "Vt": rtn_v[k][1], "Vn": rtn_v[k][2]}))
write("formation_rtn.csv", pd.concat(f_parts),
      ["-", "s", "UTC", "RTN", "RTN", "RTN", "RTN", "RTN", "RTN"],
      ["-", "s", "-", "km", "km", "km", "km/s", "km/s", "km/s"])
write("formation_geom.csv",
      pd.DataFrame({"rel_s": grid.astype(np.int64), "utcg": tstr,
                    "edge_12": e12, "edge_23": e23, "edge_31": e31,
                    "cd_1": cd[1], "cd_2": cd[2], "cd_3": cd[3],
                    "rot_phase_TM0S1": phase1,
                    "drift_R": drift[0], "drift_T": drift[1], "drift_N": drift[2]}),
      ["s", "UTC", "J2000差", "J2000差", "J2000差", "RTN", "RTN", "RTN", "RTN平面", "RTN参考中心", "RTN参考中心", "RTN参考中心"],
      ["s", "-", "km", "km", "km", "km", "km", "km", "deg", "km", "km", "km"])

a_parts = []
q_rt2b_m = q_mul(qm, np.tile(q_rtn2b, (n_pts, 1)))  # RTN→本体含机动：机体绕 +Y_B 转动
for k in (1, 2, 3):
    om = np.zeros((n_pts, 3)); om[:, 1] = N_ORB
    om[mask | (grid > MAN_T1), 1] += math.radians(MAN_DEG) / (MAN_T1 - MAN_T0)
    a_parts.append(pd.DataFrame({"sat_id": k, "rel_s": grid.astype(np.int64), "utcg": tstr,
        "q_j2b_x": q_j2b_m[:, 0], "q_j2b_y": q_j2b_m[:, 1], "q_j2b_z": q_j2b_m[:, 2], "q_j2b_w": q_j2b_m[:, 3],
        "q_rtn2b_x": q_rt2b_m[:, 0], "q_rtn2b_y": q_rt2b_m[:, 1], "q_rtn2b_z": q_rt2b_m[:, 2], "q_rtn2b_w": q_rt2b_m[:, 3],
        "wx": om[:, 0], "wy": om[:, 1], "wz": om[:, 2],
        "att_mode": "nadir", "stable": 1}))
write("attitude.csv", pd.concat(a_parts),
      ["-", "s", "UTC", "J2000→本体", "J2000→本体", "J2000→本体", "J2000→本体",
       "RTN→本体", "RTN→本体", "RTN→本体", "RTN→本体", "本体", "本体", "本体", "-", "-"],
      ["-", "s", "-", "无量纲", "无量纲", "无量纲", "无量纲",
       "无量纲", "无量纲", "无量纲", "无量纲", "rad/s", "rad/s", "rad/s", "-", "-"])

s_parts = []
for k in (1, 2, 3):
    s_parts.append(pd.DataFrame({"sat_id": k, "rel_s": grid.astype(np.int64), "utcg": tstr,
        "sun_j2000_x": sun_u[0], "sun_j2000_y": sun_u[1], "sun_j2000_z": sun_u[2],
        "incidence_deg": inc[k], "eclipse": ecl_flag, "sun_ratio": 1 - ecl_flag}))
write("sun_eclipse.csv", pd.concat(s_parts),
      ["-", "s", "UTC", "J2000", "J2000", "J2000", "本体+Z_B", "-", "-", "-"],
      ["-", "s", "-", "-", "-", "-", "deg", "0~1", "0~1", "-"])

g_parts = []
for k in (1, 2, 3):
    g_parts.append(pd.DataFrame({"sat_id": k, "rel_s": grid.astype(np.int64), "utcg": tstr,
        "az": az[k], "el": el[k], "range": rng[k], "visible": vis[k].astype(int),
        "off_axis": off_axis[k], "incone": incone[k].astype(int),
        "proj_u": proj[k], "proj_v": projv[k], "sun_alt": sun_alt,
        "common_vis": common.astype(int)}))
write("ground_obs.csv", pd.concat(g_parts),
      ["-", "s", "UTC", "目标点ENU", "目标点ENU", "目标点ENU", "-", "本体", "本体",
       "视线垂直面u", "视线垂直面v", "目标点地面", "-"],
      ["-", "s", "-", "deg", "deg", "km", "0/1", "deg", "0/1", "km", "km", "deg", "0/1"])

d_parts = []
for k in (1, 2, 3):
    active = np.zeros(n_pts, dtype=int); strobe = np.zeros(n_pts, dtype=int)
    for a_, b_ in runs(common):
        active |= (grid >= a_ - TURN) & (grid <= b_ + TURN)
        strobe |= ((grid >= a_) & (grid <= b_) & (((grid - a_).astype(np.int64)) % 2 == 0))
    d_parts.append(pd.DataFrame({"sat_id": k, "rel_s": grid.astype(np.int64), "utcg": tstr,
        "mission_active": active, "plan_strobe": strobe, "actual_strobe": strobe,
        "effective": (strobe & (vis[k].astype(bool)) & incone[k]).astype(int),
        "freq_hz": 0.5, "duty": 0.5, "brightness": 1.0}))
write("display.csv", pd.concat(d_parts),
      ["-", "s", "UTC", "-", "计划", "执行", "有效", "Hz", "0~1", "0~1"],
      ["-", "s", "-", "0/1", "0/1", "0/1", "0/1", "Hz", "-", "-"])

for nm, cols in (("power.csv", ["gen_power", "platform_power", "payload_power", "accum_energy", "battery_margin"]),
                 ("thermal.csv", ["ext_heatflux", "equip_power", "temp_main", "over_limit"])):
    df = idx.copy()
    for c in cols:
        df[c] = np.nan
    write(nm, df, ["-", "s", "UTC"] + ["未计算"] * len(cols), ["-", "s", "-"] + [""] * len(cols))

write("flight_ctrl.csv",
      pd.DataFrame({"sat_id": [1, 2, 3], "rel_s": [int(MAN_T0)]*3, "utcg": [utcg(int(MAN_T0))]*3,
                    "cmd_ax": 0.0, "cmd_ay": 0.0087266, "cmd_az": 0.0,
                    "act_ax": 0.0, "act_ay": 0.0087266, "act_az": 0.0,
                    "ctrl_count": 1, "accum_dv": 0.1309}),
      ["-", "s", "UTC", "RTN", "RTN", "RTN", "RTN", "RTN", "RTN", "-", "-"],
      ["-", "s", "-", "m/s²", "m/s²", "m/s²", "m/s²", "m/s²", "m/s²", "次", "m/s"])
events_df.to_csv(f"{OUT}/events.csv", index=False, float_format="%.9g")

common_runs = runs(common)
meta = {"rows_per_sat": int(n_pts), "sats": 3, "edge0_km": float(e0),
        "station": {"name": "合肥", "lat_deg": HEFEI[1], "lon_deg": HEFEI[0], "alt_km": HEFEI[2]},
        "sun_inc_nominal_deg": [round(float(nom.min()), 3), round(float(nom.max()), 3)],
        "eclipse_samples": int(ecl_flag.sum()),
        "common_windows_s": [[float(a_), float(b_)] for a_, b_ in common_runs],
        "generation_s": round(time.time() - t_start, 1),
        "note": "轨道=杨宏俊交付的 STK J2000 瞬时根数闭式重建（位置精确、速度近似）；姿态/太阳/显示=合成；参考中心用三星几何中心代替（参考中心列未交付）；事件与显示窗口由本数据集自洽生成",
        "oe_input": oe_meta}
json.dump(meta, open(f"{OUT}/meta.json", "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print(json.dumps(meta, ensure_ascii=False, indent=2))

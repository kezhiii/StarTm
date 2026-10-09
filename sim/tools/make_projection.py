# -*- coding: utf-8 -*-
"""make_projection.py — 从 orbit_j2000.csv 生成 StarTM 可读的 14 列投影"""
import math, sys, os
import numpy as np
import pandas as pd

MU = 398600.4418
SRC = sys.argv[1] if len(sys.argv) > 1 else "sim-data/orbit_j2000.csv"
OUT = sys.argv[2] if len(sys.argv) > 2 else "sim-data/projection/orbit_14col.csv"

def skip_comments(path):
    with open(path, encoding="utf-8") as f:
        lines = [l for l in f if not l.startswith("#")]
    return "\n".join(lines)

df = pd.read_csv(pd.io.common.StringIO(skip_comments(SRC)))
n = len(df)
r = df[["X", "Y", "Z"]].to_numpy()
v = df[["VX", "VY", "VZ"]].to_numpy()
h = np.cross(r, v)
hh = np.linalg.norm(h, axis=1)
e_vec = np.cross(v, h) / MU - r / np.linalg.norm(r, axis=1, keepdims=True)
ecc = np.linalg.norm(e_vec, axis=1)
nvec = np.cross([0.0, 0.0, 1.0], h)
nn = np.linalg.norm(nvec, axis=1)
inc = np.degrees(np.arccos(np.clip(h[:, 2] / hh, -1, 1)))
omg_raan = np.degrees(np.arctan2(nvec[:, 1], -nvec[:, 0])) % 360.0
rhat = r / np.linalg.norm(r, axis=1, keepdims=True)
rv = np.sum(r * v, axis=1)
argp = np.zeros(n); tran = np.zeros(n)
for k in range(n):
    ev = e_vec[k]
    if ecc[k] > 1e-12 and nn[k] > 1e-12:
        c = np.clip(np.dot(nvec[k], ev) / (nn[k] * ecc[k]), -1, 1)
        argp[k] = math.acos(c)
        if ev[2] < 0: argp[k] = 2 * math.pi - argp[k]
    else:
        argp[k] = 0.0
    if ecc[k] > 1e-12:
        c = np.clip(np.dot(ev, rhat[k]) / ecc[k], -1, 1)
        tran[k] = math.acos(c)
        if rv[k] < 0: tran[k] = 2 * math.pi - tran[k]
    else:
        tran[k] = math.atan2(np.dot(rhat[k], np.cross(h[k], [0, 0, 1.0]) / (hh[k] or 1.0)),
                             np.dot(rhat[k], nvec[k] / (nn[k] or 1.0))) % (2 * math.pi)
a = 1.0 / (2.0 / np.linalg.norm(r, axis=1) - np.sum(v * v, axis=1) / MU)

ts = df["utcg"].str.replace("-", "").str.replace(" ", "").str.replace(":", "")
out = pd.DataFrame({
    "timestamp": ts, "sat_id": df["sat_id"].astype(int),
    "a": a, "e": ecc, "i": inc, "OMG": omg_raan, "omg": np.degrees(argp) % 360.0,
    "f": np.degrees(tran) % 360.0,
    "X": r[:, 0], "Y": r[:, 1], "Z": r[:, 2],
    "Vx": v[:, 0], "Vy": v[:, 1], "Vz": v[:, 2],
})
os.makedirs(os.path.dirname(OUT), exist_ok=True)
out.to_csv(OUT, index=False, float_format="%.9g")
print("written", OUT, len(out), "rows,", round(os.path.getsize(OUT) / 1e6, 1), "MB")

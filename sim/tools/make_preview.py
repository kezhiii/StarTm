# -*- coding: utf-8 -*-
"""make_preview.py — 把 sim-data 全类别按 60 s 降采样到 sim-data/preview/（原装前端可承受的量级）"""
import os, glob
import pandas as pd
import io

SRC = "sim-data"
DST = "sim-data/preview"
os.makedirs(DST, exist_ok=True)

def skipc(p):
    with open(p, encoding="utf-8") as f:
        return "".join(l for l in f if not l.startswith("#"))

for path in glob.glob(f"{SRC}/*.csv"):
    name = os.path.basename(path)
    head = ""
    with open(path, encoding="utf-8") as f:
        for line in f:
            if line.startswith("#"):
                head += line
            else:
                break
    df = pd.read_csv(pd.io.common.StringIO(skipc(path)))
    if "rel_s" in df.columns:
        out = df[df.rel_s % 60 == 0]
    else:
        out = df
    with open(f"{DST}/{name}", "w", encoding="utf-8", newline="") as f:
        f.write(head)
        out.to_csv(f, index=False, float_format="%.9g")
    print(name, len(df), "->", len(out))

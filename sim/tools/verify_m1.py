# -*- coding: utf-8 -*-
"""verify_m1.py — M1 运行时验证：StarTM 原装解析器读投影文件 + 数据自检"""
import json, sys, time, math
import numpy as np

sys.path.insert(0, "StarTM")
t0 = time.time()
from server.services.csv_service import CsvService

svc = CsvService(csv_path="sim-data/projection/orbit_14col.csv")
data = svc.load()
t_parse = time.time() - t0

timestamps = data.timestamps
sats = sorted({row[0] for row in data.data[0]})
import csv as _csv
with open("sim-data/projection/orbit_14col.csv", encoding="utf-8") as f:
    rows = sum(1 for _ in f) - 1

# 星间距离抽检（用投影里的 X,Y,Z）
import pandas as pd
df = pd.read_csv("sim-data/projection/orbit_14col.csv")
d12 = np.sqrt((df.X[df.sat_id == 1].values - df.X[df.sat_id == 2].values) ** 2
              + (df.Y[df.sat_id == 1].values - df.Y[df.sat_id == 2].values) ** 2
              + (df.Z[df.sat_id == 1].values - df.Z[df.sat_id == 2].values) ** 2)

# 四元数归一化抽检
def skipc(p):
    with open(p, encoding="utf-8") as f:
        return pd.read_csv(pd.io.common.StringIO("".join(l for l in f if not l.startswith("#"))))
att = skipc("sim-data/attitude.csv")
qn = np.linalg.norm(att[["q_j2b_x", "q_j2b_y", "q_j2b_z", "q_j2b_w"]].to_numpy(), axis=1)
qn_max_dev = float(np.abs(qn - 1).max())

out = {
    "解析器": "StarTM server/services/csv_service.CsvService._parse_compact",
    "投影文件": {"行数": rows, "时间元数": len(timestamps), "每元星数": int(data.meta.sat_count),
             "总星数出现过的": sats, "解析耗时_s": round(t_parse, 1)},
    "数据自检": {"初始边长_km": round(float(d12[0]), 9),
             "边长范围_km": [round(float(d12.min()), 6), round(float(d12.max()), 6)],
             "四元数模最大偏差": qn_max_dev,
             "timestamp首尾": [timestamps[0], timestamps[-1]],
             "timestamp排序即时序": timestamps == sorted(timestamps)},
    "判定": None,
}
ok = (rows == 259203 and len(timestamps) == 86401 and data.meta.sat_count == 3
      and abs(d12[0] - 1.0) < 1e-3 and qn_max_dev < 1e-9
      and timestamps == sorted(timestamps) and sats == [1, 2, 3])
out["判定"] = "PASS" if ok else "FAIL"
with open("sim-data/verify_m1.json", "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, indent=2)
print(json.dumps(out, ensure_ascii=False, indent=2))

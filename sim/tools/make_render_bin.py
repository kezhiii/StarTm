#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""把 sim-data 的 1 秒类别文件压成列式二进制，供态势终端一次取用。

37 MB 的 Float32 缓冲替代 150 MB 的 CSV 文本：浏览器侧不再逐行 split、
不再为每行造对象，取一个值就是数组下标。文本列（姿态模式、参数版本）
用 factorize 成 int16 码表。
"""
import json
import os

import numpy as np
import pandas as pd

SRC = os.path.join(os.path.dirname(__file__), "..", "..", "sim-data")
OUT = os.path.join(SRC, "render")

SPEC = {
    "formation_geom": {"perSat": False, "num": ["edge_12", "edge_23", "edge_31", "cd_1", "cd_2", "cd_3",
                                                "rot_phase_TM0S1", "drift_R", "drift_T", "drift_N"]},
    "ground_obs": {"perSat": True, "num": ["az", "el", "range", "visible", "off_axis", "incone",
                                           "proj_u", "proj_v", "sun_alt", "common_vis"]},
    "attitude": {"perSat": True, "num": ["q_j2b_x", "q_j2b_y", "q_j2b_z", "q_j2b_w",
                                         "q_rtn2b_x", "q_rtn2b_y", "q_rtn2b_z", "q_rtn2b_w",
                                         "wx", "wy", "wz", "stable"],
                 "txt": ["att_mode"]},
    "display": {"perSat": True, "num": ["mission_active", "plan_strobe", "actual_strobe",
                                        "effective", "freq_hz", "duty", "brightness"]},
    "power": {"perSat": True, "num": ["gen_power", "platform_power", "payload_power",
                                      "accum_energy", "battery_margin"]},
    "thermal": {"perSat": True, "num": ["ext_heatflux", "equip_power", "temp_main", "over_limit_count"]},
    "time_ident": {"perSat": False, "num": [], "txt": ["mission", "mode", "param_ver"]},
    "sun_eclipse": {"perSat": True, "num": ["sun_j2000_x", "sun_j2000_y", "sun_j2000_z",
                                            "incidence_deg", "eclipse", "sun_ratio", "shadow_state", "sun_sep_deg", "umbra_margin_km",
                                            "array_normal_x", "array_normal_y", "array_normal_z",
                                            "array_incidence_deg", "array_proj_factor"]},
}


def main():
    os.makedirs(OUT, exist_ok=True)
    parts, cols = [], []      # 与 cols 一一对应，顺序即写入顺序
    blob32, blob16 = [], []
    n_epoch = None
    # 历元级文件要按星复制，先确定星号集合
    sats = sorted(pd.read_csv(os.path.join(SRC, "ground_obs.csv"), comment="#",
                              usecols=["sat_id"])["sat_id"].unique().tolist())

    for name, spec in SPEC.items():
        df = pd.read_csv(os.path.join(SRC, name + ".csv"), comment="#")
        if spec["perSat"]:
            need = ["sat_id", "rel_s"] + spec["num"] + spec.get("txt", [])
        else:
            need = ["rel_s"] + spec["num"] + spec.get("txt", [])
        df = pd.read_csv(os.path.join(SRC, name + ".csv"), comment="#", usecols=need)

        epochs = np.sort(df["rel_s"].unique())
        step = float(epochs[1] - epochs[0]) if len(epochs) > 1 else 1.0
        assert abs(epochs[0]) < 1e-9 and np.allclose(np.diff(epochs), step),             f"{name} 的 rel_s 不是从 0 起的等间隔"
        n = len(epochs)
        ep_idx = np.searchsorted(epochs, df["rel_s"].to_numpy())

        if spec["perSat"]:
            sat_pos = df["sat_id"].map({v: i for i, v in enumerate(sats)}).to_numpy()
            assert not np.isnan(sat_pos.astype(float)).any(), f"{name} 出现未知星号"
        else:
            sat_pos = np.zeros(n, dtype=int)

        if n_epoch is None:
            n_epoch = n
        assert n == n_epoch, f"{name} 历元数 {n} != {n_epoch}，1 秒数据必须对齐"

        for field in spec["num"]:
            mat = np.full((len(sats), n), np.nan, np.float32)
            src = df[field].to_numpy(dtype=np.float32)
            if spec["perSat"]:
                mat[sat_pos, ep_idx] = src
            else:
                mat[:, :n] = np.tile(src, (len(sats), 1))[:, :n]
            parts.append(mat)
            cols.append({"file": name, "field": field, "dtype": "f32", "perSat": spec["perSat"]})
        for field in spec.get("txt", []):
            codes, uniq = pd.factorize(df[field])
            mat = np.full((len(sats), n), -1, np.int16)
            if spec["perSat"]:
                mat[sat_pos, ep_idx] = codes
            else:
                mat[:, :n] = np.tile(codes, (len(sats), 1))[:, :n]
            parts.append(mat)
            cols.append({"file": name, "field": field, "dtype": "i16", "perSat": spec["perSat"],
                         "codes": [("" if v is None or (isinstance(v, float) and np.isnan(v)) else str(v)) for v in uniq]})

    # 排布局：按写入顺序给偏移，两种 dtype 各一条游标。
    # 早先按 (f32 列表 + i16 列表) 与 cols 配对，遇到中间夹文本列的文件后偏移整体错位。
    off32 = off16 = 0
    for part, col in zip(parts, cols):
        flat = np.ascontiguousarray(part).reshape(-1)
        if col["dtype"] == "f32":
            col["offset"], col["count"], off32 = off32, flat.size, off32 + flat.size
            blob32.append(flat)
        else:
            col["offset"], col["count"], off16 = off16, flat.size, off16 + flat.size
            blob16.append(flat)

    data32 = np.concatenate(blob32) if blob32 else np.zeros(0, np.float32)
    data16 = np.concatenate(blob16) if blob16 else np.zeros(0, np.int16)
    data32.tofile(os.path.join(OUT, "columns.f32"))
    data16.tofile(os.path.join(OUT, "codes.i16"))

    manifest = {"nEpoch": int(n_epoch), "stepSec": step, "sats": sats, "columns": cols,
                "bytes": {"f32": int(data32.nbytes), "i16": int(data16.nbytes)}}
    with open(os.path.join(OUT, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=1)
    print(f"历元 {n_epoch} 步长 {step}s 星 {sats} 列 {len(cols)} "
          f"f32 {data32.nbytes/1048576:.1f} MB i16 {data16.nbytes/1048576:.1f} MB")


if __name__ == "__main__":
    main()

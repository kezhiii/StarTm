# -*- coding: utf-8 -*-
"""
verify_handoff.py — 交付验收：按《接口定义-姿态-能源-热控》§六 自动核对

对方（飞控/能源/热控）交回 CSV 后跑本脚本，任一条不过即退出码 1。
也用于自检当前合成数据集，此时未交付的项报 SKIP 而不是 FAIL。

用法：
    python sim/tools/verify_handoff.py                # 查全部
    python sim/tools/verify_handoff.py --only power   # 只查某一类
"""
import argparse
import math
import os
import sys

import numpy as np
import pandas as pd

DATA = "sim-data"
GRID_N = 86401          # 24 h × 1 s，含 0 秒
COMMENT_LINES = 3       # 列名 / 坐标系 / 单位

# 量级门限：越界基本等于单位填错（W 填成 kW、℃ 填成 K 之类）
RANGE = {
    "gen_power": (-5000, 5000), "platform_power": (-5000, 5000), "payload_power": (-5000, 5000),
    "batt_power": (-5000, 5000), "accum_energy": (0, 1e6), "battery_soc_pct": (0, 100),
    "battery_margin": (-100, 100),
    "ext_heatflux": (0, 3000), "equip_power": (0, 5000),
    "array_proj_factor": (0, 1), "sun_ratio": (0, 1),
}
QUAT_SETS = [("q_j2b", ["q_j2b_x", "q_j2b_y", "q_j2b_z", "q_j2b_w"]),
             ("q_rtn2b", ["q_rtn2b_x", "q_rtn2b_y", "q_rtn2b_z", "q_rtn2b_w"])]

fails, warns, skips = [], [], []


def chk(cond, msg):
    if not cond:
        fails.append(msg)
    return cond


def load(name):
    """读自描述 CSV：跳过三行注释，返回 (DataFrame, 坐标系行, 单位行)。"""
    path = os.path.join(DATA, name)
    if not os.path.exists(path):
        return None, None, None
    with open(path, encoding="utf-8") as f:
        head = [f.readline().rstrip("\n") for _ in range(COMMENT_LINES)]
    if not all(h.startswith("# ") for h in head):
        fails.append(f"{name}: 缺三行自描述表头（列名/坐标系/单位）")
        return None, None, None
    def fields(line, tag):
        body = line[len(tag):]
        return [c.strip() for c in body.split(",")]
    cols = fields(head[0], "列名: ")
    coord = fields(head[1], "坐标系: ")
    unit = fields(head[2], "单位: ")
    df = pd.read_csv(path, skiprows=list(range(COMMENT_LINES)), low_memory=False)
    return df, (cols, coord, unit), head


def check_grid(name, df):
    """连续状态文件是"每星每历元一行"，所以行数是 历元数 × 星数。"""
    if "sat_id" in df.columns:
        sats = sorted(pd.to_numeric(df["sat_id"], errors="coerce").dropna().unique())
    else:
        sats = []
    n_sat = max(1, len(sats))
    exp = GRID_N * n_sat
    if not chk(len(df) == exp, f"{name}: 行数 {len(df)}，应为 {GRID_N} 历元 × {n_sat} 星 = {exp}"):
        return
    rel = pd.to_numeric(df["rel_s"], errors="coerce").to_numpy(float)
    for sid in (sats or [None]):
        sub = rel[pd.to_numeric(df["sat_id"], errors="coerce").to_numpy(float) == sid] if sid else rel
        chk(np.allclose(sub, np.arange(GRID_N)),
            f"{name}: sat_id={sid} 的 rel_s 不是 0..{GRID_N - 1} 连续整秒")


def check_header(name, hdr):
    cols, coord, unit = hdr
    bad = [i for i in range(len(cols)) if i >= len(coord) or i >= len(unit)]
    chk(not bad, f"{name}: 表头三行长度不一致")
    empty_c = [cols[i] for i in range(min(len(cols), len(coord))) if coord[i] == ""]
    empty_u = [cols[i] for i in range(min(len(cols), len(unit))) if unit[i] == ""]
    chk(not empty_c, f"{name}: 坐标系行有空项 {empty_c[:5]}")
    chk(not empty_u, f"{name}: 单位行有空项 {empty_u[:5]}")


def check_quats(name, df):
    """只查本文件声明了的四元数集，没声明就不吭声。"""
    for tag, cols in QUAT_SETS:
        if not all(c in df.columns for c in cols):
            continue
        v = df[cols].to_numpy(float)
        if np.isnan(v).all():
            skips.append(f"{name}: {tag} 全空（未交付）")
            continue
        worst = np.nanmax(np.abs(np.linalg.norm(v, axis=1) - 1.0))
        chk(worst < 1e-6, f"{name}: {tag} 归一化最大偏差 {worst:.2e}，应 < 1e-6")


def check_ranges(name, df):
    for col, (lo, hi) in RANGE.items():
        if col not in df.columns:
            continue
        v = pd.to_numeric(df[col], errors="coerce").dropna().to_numpy(float)
        if not len(v):
            continue
        out = v[(v < lo) | (v > hi)]
        if len(out):
            warns.append(f"{name}.{col}: {len(out)} 行越出 [{lo}, {hi}]，最坏 {out.max():.4g}（疑似单位错填）")


def check_counts(name, df):
    """超限计数与温度门限自洽：没有门限就只查列是否存在与非负。"""
    col = "over_limit_count"
    if col not in df.columns:
        if "over_limit" in df.columns:
            warns.append(f"{name}: 仍是旧列 over_limit（0/1），接口已改为 over_limit_count（个数）")
        return
    v = pd.to_numeric(df[col], errors="coerce").dropna()
    chk((v >= 0).all(), f"{name}.{col}: 出现负数")
    temps = [c for c in df.columns if c.startswith("temp_")]
    if not temps:
        skips.append(f"{name}: 有 {col} 但没有 temp_* 列，无法核对自洽")
    else:
        skips.append(f"{name}: {col} 与 {len(temps)} 个温度列的自洽需门限值才能核，门限未交付")


def check_heat_balance(power_df, duty_path):
    """热控的 equip_power 应等于同历元各设备 heat_w 之和（接口 §六 第 5 条）。"""
    if power_df is None or "equip_power" not in power_df.columns:
        return
    th = load("thermal.csv")[0]
    if th is None or not pd.to_numeric(th["equip_power"], errors="coerce").notna().any():
        skips.append("thermal: equip_power 未交付，跳过发热等式")
        return
    if not os.path.exists(duty_path):
        skips.append("equipment_duty.csv 不在，跳过发热等式")
        return
    duty = pd.read_csv(duty_path, skiprows=list(range(COMMENT_LINES)), low_memory=False)
    duty["heat_w"] = pd.to_numeric(duty["heat_w"], errors="coerce")
    if duty["heat_w"].isna().all():
        skips.append("equipment_duty.heat_w 全空（方案表96 多为待确认），跳过发热等式")
        return
    per_epoch = duty.groupby("rel_s")["heat_w"].sum()
    got = th[th.sat_id == 1].set_index("rel_s")["equip_power"]
    both = per_epoch.index.intersection(got.index)
    worst = float(np.abs(got[both] - per_epoch[both]).max())
    chk(worst < 1e-3, f"发热等式不闭合：equip_power 与 Σheat_w 最大差 {worst:.4g} W")


def check_eclipse_events():
    """地影事件接线：本轨道可能一条都没有，所以单独验检测式本身。"""
    st = np.array([0, 0, 1, 2, 2, 0, 0], dtype=int)
    idx = np.flatnonzero(np.diff(st) != 0) + 1
    chk(list(idx) == [2, 3, 5], f"状态变化检测式给出 {idx.tolist()}，应为 [2, 3, 5]")
    se = load("sun_eclipse.csv")[0]
    if se is not None:
        n_state = int((pd.to_numeric(se["shadow_state"], errors="coerce") > 0).sum())
        ev = pd.read_csv(os.path.join(DATA, "events.csv"))
        n_ev = int(ev["category"].isin(["进地影", "出地影"]).sum())
        if n_state == 0:
            skips.append(f"地影事件：全程 {n_state} 个历元在影内，事件 {n_ev} 条属正常（接线已就位）")
        else:
            chk(n_ev > 0, f"有 {n_state} 个历元在影内却没有任何进出地影事件")


def coverage_report():
    """表3-6 的 22 类逐项：有值 / 全空 / 恒值占位 / 缺列。"""
    items = [
        ("时间与标识", "time_ident.csv", ["mission", "mode", "param_ver"]),
        ("绝对轨道状态", "orbit_j2000.csv", ["X", "Y", "Z", "VX", "VY", "VZ"]),
        ("地固状态", "orbit_itrf.csv", ["itrf_x", "sublat", "sublon"]),
        ("瞬时轨道根数", "projection/orbit_14col.csv", ["a", "e", "i", "OMG", "omg", "f"]),
        ("太阳同步状态", None, []),
        ("编队相对状态", "formation_rtn.csv", ["R", "T", "N", "Vr", "Vt", "Vn"]),
        ("构型几何", "formation_geom.csv", ["edge_12", "rot_phase_TM0S1"]),
        ("中心漂移", "formation_geom.csv", ["drift_R", "drift_T", "drift_N"]),
        ("安全与通信", None, []),
        ("飞控输入与执行", "flight_ctrl.csv", ["cmd_ax", "act_ax"]),
        ("控制代价", "flight_ctrl.csv", ["ctrl_count", "accum_dv"]),
        ("姿态状态", "attitude.csv", ["q_j2b_w", "att_mode", "stable"]),
        ("指向状态", "ground_obs.csv", ["off_axis", "incone"]),
        ("太阳几何", "sun_eclipse.csv", ["sun_j2000_x", "incidence_deg", "array_normal_x", "array_proj_factor"]),
        ("地影状态", "sun_eclipse.csv", ["shadow_state", "sun_ratio", "umbra_margin_km"]),
        ("目标观察状态", "ground_obs.csv", ["az", "el", "range", "common_vis"]),
        ("地面投影状态", "ground_obs.csv", ["proj_u", "proj_v"]),
        ("显示计划", "display.csv", ["plan_strobe", "freq_hz", "duty", "brightness"]),
        ("显示执行", "display.csv", ["actual_strobe", "effective"]),
        ("能源状态", "power.csv", ["gen_power", "battery_margin"]),
        ("热状态", "thermal.csv", ["ext_heatflux", "temp_main", "over_limit"]),
        ("区间与事件", "events.csv", ["category"]),
    ]
    print("\n表3-6 覆盖度（本系统自检，非对方交付）")
    print("%-14s %-6s %s" % ("类别", "状态", "说明"))
    for name, fn, cols in items:
        if fn is None:
            print("%-14s %-6s %s" % (name, "缺", "整类未出"))
            continue
        df, _, _ = (None, None, None)
        path = os.path.join(DATA, fn)
        if not os.path.exists(path):
            print("%-14s %-6s %s" % (name, "缺", fn + " 不在"))
            continue
        skip = 0 if fn == "events.csv" or fn.startswith("projection") else list(range(COMMENT_LINES))
        sub = pd.read_csv(path, skiprows=skip, low_memory=False)
        const, empty = [], []
        for c in cols:
            if c not in sub.columns:
                empty.append(c + "(无此列)")
                continue
            if not pd.api.types.is_numeric_dtype(sub[c]):   # 文本列（mission/param_ver/category）按去重数判
                vals = sub[c].dropna()
                if not len(vals):
                    empty.append(c)
                elif vals.nunique() <= 1:
                    const.append(f"{c}≡{vals.iloc[0]}")
                continue
            v = pd.to_numeric(sub[c], errors="coerce")
            if v.notna().sum() == 0:
                empty.append(c)
            elif v.dropna().nunique() <= 1:
                const.append(f"{c}≡{v.dropna().iloc[0]}")
        if empty and not const:
            print("%-14s %-6s %s" % (name, "空", ", ".join(empty)))
        elif const:
            print("%-14s %-6s %s" % (name, "占位", ", ".join(const + empty)))
        else:
            print("%-14s %-6s %s" % (name, "有值", fn))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default="all", help="attitude|power|thermal|sun_eclipse|all")
    ap.add_argument("--no-coverage", action="store_true")
    args = ap.parse_args()

    targets = {"attitude": ["attitude.csv", "flight_ctrl.csv"],
               "power": ["power.csv"], "thermal": ["thermal.csv"],
               "sun_eclipse": ["sun_eclipse.csv"]}.get(
        args.only, ["attitude.csv", "flight_ctrl.csv", "power.csv", "thermal.csv",
                    "sun_eclipse.csv", "ground_obs.csv", "display.csv", "time_ident.csv"])

    # 事件式/单点式文件不按逐秒网格要求：表3-6 对它们写的是"每个控制时刻输出"
    NO_GRID = {"events.csv", "flight_ctrl.csv", "equipment_duty.csv"}

    for name in targets:
        df, hdr, _ = load(name)
        if df is None:
            skips.append(f"{name}: 文件不在，未交付")
            continue
        if hdr:
            check_header(name, hdr)
        if name not in NO_GRID:
            check_grid(name, df)
        check_quats(name, df)
        check_ranges(name, df)
        check_counts(name, df)

    check_heat_balance(load("power.csv")[0], os.path.join(DATA, "equipment_duty.csv"))
    check_eclipse_events()
    if not args.no_coverage:
        coverage_report()

    print("\n" + "=" * 62)
    for m in fails:
        print("FAIL  " + m)
    for m in warns:
        print("WARN  " + m)
    for m in skips:
        print("SKIP  " + m)
    print(f"结果：{len(fails)} 项不过、{len(warns)} 项警告、{len(skips)} 项跳过")
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()

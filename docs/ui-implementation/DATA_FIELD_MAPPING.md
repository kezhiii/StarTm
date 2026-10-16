# 数据字段映射表（界面读数 → 数据列 → 取数路径 → 实测有值情况）

本文件由 `outputs/cdp-check/gen_field_mapping.py` 生成，可重跑复核：
读 `sim/config/panels.json`、`sim/config/display.json`、`sim-data/render/manifest.json`、
`sim-data/render/columns.f32` 与 `sim-data/preview/*.csv`，`有值情况` 是实数出来的非空计数（前 400 个采样）。

界面里出现但下表没有的读数只有两类：三维侧的 轨道高度/速度（取自 `/api/csv-data` 的 14 列投影，经 `__simbridge.orbitAt()`）
和时间标识（`time_ident` 的 mission/mode/param_ver，二进制码表见 manifest 的 `codes`）。

| 归属页 | 分组 | 界面名称 | 数据列 | 显示单位 | 取数路径 | 有值情况 | 依据 |
|---|---|---|---|---|---|---|---|
| 轨道 | ① 地面显示图形 | 边长 TM0S1-TM0S2 | `formation_geom.edge_12` | m（源列单位 km，×1000 显示为 m） | render/columns.f32 · 1 s | 400/400 非空 | 表3-6 构型几何 |
| 轨道 | ① 地面显示图形 | 边长 TM0S2-TM0S3 | `formation_geom.edge_23` | m（源列单位 km，×1000 显示为 m） | render/columns.f32 · 1 s | 400/400 非空 | 表3-6 构型几何 |
| 轨道 | ① 地面显示图形 | 边长 TM0S3-TM0S1 | `formation_geom.edge_31` | m（源列单位 km，×1000 显示为 m） | render/columns.f32 · 1 s | 400/400 非空 | 表3-6 构型几何 |
| 轨道 | ① 地面显示图形 | 旋转相位 | `formation_geom.rot_phase_TM0S1` | deg | render/columns.f32 · 1 s | 400/400 非空 | 表3-6 构型几何 |
| 地面观察 | ② 共同可见性 | 单星可见 | `ground_obs.visible` | 0/1 | render/columns.f32 · 1 s | 400/400 非空 | 表3-6 目标观察状态 |
| 地面观察 | ② 共同可见性 | 三星共同可见 | `ground_obs.common_vis` | 0/1 | render/columns.f32 · 1 s | 400/400 非空 | 表3-6 目标观察状态 |
| 地面观察 | ② 共同可见性 | 方位角 | `ground_obs.az` | deg | render/columns.f32 · 1 s | 400/400 非空 | 表3-6 目标观察状态 |
| 地面观察 | ② 共同可见性 | 仰角 | `ground_obs.el` | deg | render/columns.f32 · 1 s | 400/400 非空 | 表3-6 目标观察状态 |
| 地面观察 | ② 共同可见性 | 斜距 | `ground_obs.range` | km | render/columns.f32 · 1 s | 400/400 非空 | 表3-6 目标观察状态 |
| 姿态 | ③ 姿态指向 | 四元数 w（x,y,z 展开见悬停） | `attitude.q_j2b_w` | 无量纲 | render/columns.f32 · 1 s | 400/400 非空 | 表3-6 姿态状态 |
| 姿态 | ③ 姿态指向 | 姿态模式 | `attitude.att_mode` | - | render/columns.f32 · 1 s | 400/400 非空 | 表3-6 姿态状态 |
| 姿态 | ③ 姿态指向 | 稳定标志 | `attitude.stable` | 0/1 | render/columns.f32 · 1 s | 400/400 非空 | 表3-6 姿态状态 |
| 姿态 | ③ 姿态指向 | 目标离轴角 | `ground_obs.off_axis` | deg | render/columns.f32 · 1 s | 400/400 非空 | 表3-6 指向状态 |
| 姿态 | ③ 姿态指向 | 目标入锥(≤1°) | `ground_obs.incone` | 0/1 | render/columns.f32 · 1 s | 400/400 非空 | 表3-6 指向状态 |
| 地面观察 | ④ 亮度与频闪 | 计划点亮 | `display.plan_strobe` | 0/1 | render/columns.f32 · 1 s | 400/400 非空 | 表3-6 显示计划 |
| 地面观察 | ④ 亮度与频闪 | 实际点亮 | `display.actual_strobe` | 0/1 | render/columns.f32 · 1 s | 400/400 非空 | 表3-6 显示执行 |
| 地面观察 | ④ 亮度与频闪 | 频率 | `display.freq_hz` | Hz | render/columns.f32 · 1 s | 400/400 非空 | 表3-6 显示计划 |
| 地面观察 | ④ 亮度与频闪 | 占空比 | `display.duty` | 0~1 | render/columns.f32 · 1 s | 400/400 非空 | 表3-6 显示计划 |
| 地面观察 | ④ 亮度与频闪 | 亮度 | `display.brightness` | 0~1 | render/columns.f32 · 1 s | 400/400 非空 | 表3-6 显示计划 |
| 地面观察 | ⑤ 有效显示 | 有效显示 | `display.effective` | 0/1 | render/columns.f32 · 1 s | 400/400 非空 | 表3-6 显示执行 |
| 地面观察 | ⑤ 有效显示 | 目标区太阳高度 | `ground_obs.sun_alt` | deg | render/columns.f32 · 1 s | 400/400 非空 | ADR-0005（判据默认关） |
| 能源 | ⑥ 能源状态 | 发电功率 | `power.gen_power` | W | render/columns.f32 · 1 s | 0/400 非空 | 4.3.4 TBC |
| 能源 | ⑥ 能源状态 | 电量裕度 | `power.battery_margin` | % | render/columns.f32 · 1 s | 0/400 非空 | 4.3.4 TBC |
| 热控 | ⑦ 热状态 | 主要设备温度 | `thermal.temp_main` | ℃ | render/columns.f32 · 1 s | 0/400 非空 | 表3-6 热状态：未计算保留为空 |
| 热控 | ⑦ 热状态 | 超限节点数 | `thermal.over_limit_count` | 个 | render/columns.f32 · 1 s | 0/400 非空 | 表3-6 热状态 |
| 编队总览 | ⑧ 数据完整性 | 参数版本 | `time_ident.param_ver` | - | render/columns.f32 · 1 s | 400/400 非空 | 表3-6 时间与标识 |
| 编队总览 | ⑧ 数据完整性 | 运行工况 | `time_ident.mode` | - | render/columns.f32 · 1 s | 400/400 非空 | 表3-6 时间与标识 |
| 轨道 | ⑨ 轨道要素与相对位置 | 半长轴 a | `orbit_itrf.sma` | km | preview/orbit_itrf.csv · 60 s | 400/400 非空 | 表3-6 轨道要素（preview 60 s 采样） |
| 轨道 | ⑨ 轨道要素与相对位置 | 偏心率 e | `orbit_itrf.ecc` | - | preview/orbit_itrf.csv · 60 s | 400/400 非空 | 表3-6 轨道要素 |
| 轨道 | ⑨ 轨道要素与相对位置 | 倾角 i | `orbit_itrf.inc` | deg | preview/orbit_itrf.csv · 60 s | 400/400 非空 | 表3-6 轨道要素 |
| 轨道 | ⑨ 轨道要素与相对位置 | 升交点赤经 Ω | `orbit_itrf.raan` | deg | preview/orbit_itrf.csv · 60 s | 400/400 非空 | 表3-6 轨道要素 |
| 轨道 | ⑨ 轨道要素与相对位置 | 星下点纬度 | `orbit_itrf.sublat` | deg | preview/orbit_itrf.csv · 60 s | 400/400 非空 | 表3-6 星下点 |
| 轨道 | ⑨ 轨道要素与相对位置 | 星下点经度 | `orbit_itrf.sublon` | deg | preview/orbit_itrf.csv · 60 s | 400/400 非空 | 表3-6 星下点 |
| 轨道 | ⑨ 轨道要素与相对位置 | 相对位置 R（径向） | `formation_rtn.R` | km | preview/formation_rtn.csv · 60 s | 400/400 非空 | 表3-6 相对运动（对编队参考中心） |
| 轨道 | ⑨ 轨道要素与相对位置 | 相对位置 T（沿迹） | `formation_rtn.T` | km | preview/formation_rtn.csv · 60 s | 400/400 非空 | 表3-6 相对运动 |
| 轨道 | ⑨ 轨道要素与相对位置 | 相对位置 N（法向） | `formation_rtn.N` | km | preview/formation_rtn.csv · 60 s | 400/400 非空 | 表3-6 相对运动 |
| 姿态 | ⑩ 太阳翼受照与入射角 | 太阳入射角（对 +Z_B） | `sun_eclipse.incidence_deg` | deg | render/columns.f32 · 1 s | 400/400 非空 | 表3-6 指向/受照 |
| 姿态 | ⑩ 太阳翼受照与入射角 | 太阳入射角（对太阳翼法向）· 本数据集与上一行同值 | `sun_eclipse.array_incidence_deg` | deg | render/columns.f32 · 1 s | 400/400 非空 | 表3-6 要求太阳翼法向入射角；实测 86401 历元 × 3 星与 incidence_deg 逐点差为 0，需生成侧确认是否复制列 |
| 姿态 | ⑩ 太阳翼受照与入射角 | 太阳翼有效投影系数 | `sun_eclipse.array_proj_factor` | 0~1 | render/columns.f32 · 1 s | 400/400 非空 | 表3-6 能源算发电用的就是这个数 |
| 姿态 | ⑩ 太阳翼受照与入射角 | 太阳翼法向 x（J2000） | `sun_eclipse.array_normal_x` | - | render/columns.f32 · 1 s | 400/400 非空 | 表3-6 太阳翼法向 |
| 姿态 | ⑩ 太阳翼受照与入射角 | 太阳翼法向 y（J2000） | `sun_eclipse.array_normal_y` | - | render/columns.f32 · 1 s | 400/400 非空 | 表3-6 太阳翼法向 |
| 姿态 | ⑩ 太阳翼受照与入射角 | 太阳翼法向 z（J2000） | `sun_eclipse.array_normal_z` | - | render/columns.f32 · 1 s | 400/400 非空 | 表3-6 太阳翼法向 |
| 图表 chEdge | 趋势图 | TM0S1–TM0S2 | `formation_geom.edge_12` | m | render/columns.f32 · 1 s | 400/400 非空 | 编队边长 |
| 图表 chEdge | 趋势图 | TM0S2–TM0S3 | `formation_geom.edge_23` | m | render/columns.f32 · 1 s | 400/400 非空 | 编队边长 |
| 图表 chEdge | 趋势图 | TM0S3–TM0S1 | `formation_geom.edge_31` | m | render/columns.f32 · 1 s | 400/400 非空 | 编队边长 |
| 图表 chOrbit | 趋势图 | 轨道高度（a − 地球半径） | `orbit_itrf.sma` | km | preview/orbit_itrf.csv · 60 s | 400/400 非空 | 轨道高度 |
| 图表 chAttitude | 趋势图 | 对载荷轴 +Z_B | `sun_eclipse.incidence_deg` | ° | render/columns.f32 · 1 s | 400/400 非空 | 太阳入射角 |
| 图表 chAttitude | 趋势图 | 对太阳翼法向 | `sun_eclipse.array_incidence_deg` | ° | render/columns.f32 · 1 s | 400/400 非空 | 太阳入射角 |
| 图表 chPower | 趋势图 | 发电功率 | `power.gen_power` | W | render/columns.f32 · 1 s | 0/400 非空 | 发电功率与用电功率 |
| 图表 chPower | 趋势图 | 用电功率（平台 + 载荷） | `power.platform_power+payload_power` | W | render/columns.f32 · 1 s | 列不存在 | 发电功率与用电功率 |
| 图表 chThermal | 趋势图 | temp_main | `thermal.temp_main` | ℃ | render/columns.f32 · 1 s | 0/400 非空 | 温度测点 |
| 图表 chSun | 趋势图 | 太阳高度 | `ground_obs.sun_alt` | ° | render/columns.f32 · 1 s | 400/400 非空 | 目标区太阳高度（合肥） |

## 单位与换算的口径

- `formation_geom.edge_12/23/31` 源列单位是 **km**（表头注释即如此）。编队总览的「平均星间距」与三行星间距离按 km 原样显示；
  只有「构型偏差」与「编队边长」曲线换算成 m（×1000）以便与 ±10 m 的允许带同轴比较。任何地方都不许出现「km 值 ×1000 再标 km」。
- 越限比例有两个口径，界面图例上写的是**图上采样点**的比例（曲线最多画 600 点）；全天历元的比例由
  `outputs/cdp-check/measure_truth.py` 量得：edge_12 = 93.90%、edge_23 = 84.90%、edge_31 = 89.63%。
- `sun_eclipse.array_incidence_deg` 与 `incidence_deg` 在本次交付数据里**逐点完全相同**
  （3 星 × 86401 历元，最大差 0.0）。因此界面对它的名称标注了「本数据集与上一行同值」，
  不当作两个独立测量点；是否为复制列需生成侧确认。

## 明确的缺失项（界面一律显示空态并点名，不写 0、不做硬编码演示值）

| 项 | 事实 | 界面处理 |
|---|---|---|
| `power.battery_soc_pct` | manifest 66 列里没有，preview 表头也没有 | SOC 读数「字段未提供」；不进导出表头 |
| `power` 五列 | 列在，但 259203 个采样点全为 NaN | 能源页两态区分 + 曲线空态点名 + 导出剔除 |
| `thermal` 四列 | 列在，全为 NaN | 同上 |
| `temp_<node>` 逐测点列 | 接口定义有、交付里没有 | 抽屉「⑤ 热控参数」写明未交付 |
| `att_mode` 码表 | manifest `codes=['nadir']`，只有一个真实取值 | 原样显示 nadir，不做猜测翻译 |
| `equipment_duty.csv:heat_w` | 522 台里只有 21 台给值 | 按原样显示「未提供」，不称温度结果 |
| `orbit_itrf` / `formation_rtn` | 只有 preview（1441 历元、60 s 间隔、覆盖 86400 s） | 曲线与表格按各自 60 s 间隔取行（`stepOf`/`epFor`），副标题写明数据源与采样 |

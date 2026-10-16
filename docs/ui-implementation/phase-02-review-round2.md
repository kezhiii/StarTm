# Phase 2 复审报告（第二轮 · 独立对抗性审查）

审查人：独立子代理（第二轮）｜日期：2026-10-16｜分支：`sim-system`（HEAD `a8f7841`）
被审对象：工作树未提交变更集（Phase 2 部分），基线哈希见下表。

```
sim/js/panels.js      10bb0a061dbdfe19  41071 B  768 行   (mtime 10-16 03:42:37)
sim/js/chart.js       e7671e895e144579   8599 B  165 行   (mtime 10-16 03:42:37)
sim/js/main.js        e8f0540209e915cf  23784 B  517 行   (mtime 10-16 03:03:45)
sim/js/loader.js      dd4b36ba249f1a5c   5513 B  136 行   (mtime 10-16 01:43:51)
sim/index.html        cf47604ac3081b9b  42467 B  642 行   (mtime 10-16 03:42:37)
sim/config/panels.json e3b252ac3231cbbb  9204 B          (mtime 10-16 02:59:58)
sim/config/display.json 54dc08ddb8ce160f 3328 B          (mtime 10-16 01:25:12)
outputs/cdp-check/harness.py 688731be6baf44a4 56573 B    (mtime 10-16 03:34:08)
```

并发修改声明：审查期间（03:42:37）`sim/index.html`、`sim/js/chart.js`、`sim/js/panels.js` 被另一个进程（Phase 5 视觉作业）重写过：`index.html` +1570 B，`chart.js` −166 B（行尾 CRLF→LF 归一，行数不变），`panels.js` 内容与字节数未变。本报告以上表哈希为准；Phase 2 相关逻辑（`TAB_GROUPS`、`stepOf`、`seriesFor`、KPI 取值口径、`diag()`）逐条复核仍在原位。交付截图拍摄于 03:18:45–03:18:51，早于该次改写。

## 结论

**允许进入下一阶段：否**

两个 round-1 阻断项都已真实修复（A1 单位、A6 截图证据），字段归属（A2）、曲线时间轴（A3）、能源/热控诚实空态（A4）、阈值未放宽（A5）全部通过。但本轮独立复跑界面代码时，发现一个**新的阻断级缺陷 N1**：`render()` 用单一 1 s 历元下标去索引 60 s 采样的 preview 数据源，导致 ⑨ 轨道要素/相对位置（13 行中的 9 行）与 轨道页 hero 的 R/T 在验收时刻 T+12:00:00 全部显示 `暂无数据`，而在 T+00:24:00 之前显示的是**晚 60 倍时刻**的数值。该缺陷就写在交付截图 `tab-orbit.png` 里，而台架断言只看行名不看行值，所以整批检查全部 PASS。Phase 2 的验收口径 2.6「数据跟同一时刻」与 2.3「轨道页放轨道要素」因此不成立。

---

## A1 单位与量级 —— PASS

复算命令：`D:/anaconda/python.exe -X utf8 outputs/scratch-p2r/chk_a1a4_bin.py`（float32 按 manifest `offset` 切片）与 `... chk_data2.py`（直读 CSV）。

- 二进制 `formation_geom` 在 epoch 43200（stepSec=1.0）：`edge_12=0.94096839427948`、`edge_23=1.0074759721755981`、`edge_31=0.942560076713562` km，均值 `0.96366814772288` km。
- `sim-data/formation_geom.csv` 与 `sim-data/preview/formation_geom.csv` 的 `rel_s=43200` 行（utcg `2026-09-13 16:00:00`）：`0.940968407 / 1.00747596 / 0.942560079` km，均值 `0.963668149` km。表头注释 `# 单位: s, -, km, km, km, …` 明确 edge 列本就是 km。
- 界面实测（我自己的运行时探针，命令：`D:/anaconda/python.exe -X utf8 outputs/scratch-p2r/probe9.py`，直接 `import('/sim/js/panels.js?v=34')` + `loader.setStepSec(1)` + `render(43200)`）：
  - KPI = `可见卫星0 / 3`｜`平均星间距0.964 km`｜`构型偏差125.8 m`｜`当前仿真时刻T+12:00:00`
  - 星间距离三行 = `TM0S1–TM0S2 0.941`｜`TM0S2–TM0S3 1.007`｜`TM0S3–TM0S1 0.943`（表头 `距离 (km)`，注 `来源 formation_geom，单位 km`）
  - ① 组三行 = `940.97 m / 1007.5 m / 942.56 m`
- 构型偏差标签与算法一致性：`panels.js:316` 以 `scale=1000` 读入（米），标称 `nominal` 由 `panels.js:747-752` 用首历元 ×`spec.scale`(1000) 得到；我独立算出三个偏差 `[125.85, 28.15, 81.04] m`，取最大 = `125.8 m`，与界面逐位一致 → 「米」标签与「米」算法匹配，不是反向凑数。
- 交付截图 `tab-orbit.png`（放大后人工判读）同样显示 `940.97 / 1007.5 / 942.56 m`，与我的复算一致。

结论：round-1 阻断项 1（`963.7 km`）**已修复**，KPI 与三行距离、① 组、CSV 四方对账闭合。

## A2 字段归属（指令 2.3）—— PASS

依据：`sim/config/panels.json`（组 ①–⑩ 的行定义）+ `sim/js/panels.js:54-61` 的 `TAB_GROUPS` + 运行时实测（probe9 的 `groups/rows/hero/badges`）。

| 标签 | 实测组 | 实测行数 | 违禁项 |
|---|---|---|---|
| 轨道 | `① 地面显示图形`、`⑨ 轨道要素与相对位置` | 13 | 无 方位角/仰角/斜距/共同可见 ✓ |
| 姿态 | `③ 姿态指向`、`⑩ 太阳翼受照与入射角` | 11 | 无 亮度/频闪/有效显示 ✓；含 `太阳入射角（对 +Z_B）`、`太阳入射角（对太阳翼法向）`、`太阳翼法向 x/y/z` ✓ |
| 能源 | `⑥ 能源状态` | 2（发电功率、电量裕度） | hero 四项全为 power 列，**无 sun_alt** ✓ |
| 热控 | `⑦ 热状态` | 2（主要设备温度、超限节点数） | 只有 thermal 列 ✓ |
| 地面观察 | `② 共同可见性`、`④ 亮度与频闪`、`⑤ 有效显示` | 12（含 `目标区太阳高度 -54.53 deg`） | ②④⑤ 已迁到此页 ✓ |

- 徽标语义收敛：`panels.js:44-50` 给 `visible/common_vis/plan_strobe/actual_strobe` 加了 `only:['formation','ground']`，实测轨道页徽标只剩 `光照 日照 · 日面 100% · 本影裕度 +580 km` 与 `稳定 是` ✓。
- `sun_alt` 在 `panels.js` 中只出现在 `HERO.ground:22` 与导出列 `:658`，能源/热控/姿态/轨道四页均无 ✓。
- 判读余地：① 组的 `旋转相位`（RTN 平面相位）放在轨道页，属编队几何量；指令 2.3 允许「星间距离等轨道量」，不判违规。
- 折叠区 `表2-1 全参数`/`系统遥测`（`index.html:531-540`）不分标签、按组全量列出，是显式标名的全参数视图，不算标签串页。

## A3 曲线时间轴与逐线允许带 —— PASS

- 代码：`panels.js:479-483 stepOf()` 用 `entry.lastRelS/(nEpoch-1)`；`loader.js:48`（二进制 `(nEpoch-1)*manifest.stepSec`）与 `loader.js:83-84`（preview 实测 max rel_s 与行数）。`seriesFor()` `panels.js:485-509` 用 `st` 铺历元、`spec.scale` 换算、`:502-507` 给每条 series 挂自己的带。
- 我独立预测（命令 `... predict_charts.py`）：`preview/orbit_itrf.csv` 每星 1441 行、`rel_s` 0→86400、间隔 60 s ⇒ `stepOf=60`；窗口 `[43200-3600, 43200+600]=[39600,43800]` ⇒ `epLo=660, epHi=730, stride=1` ⇒ **71 点**，游标 43200 落在格点上。
- 运行时实测（probe9 `chartDiag()`）：`chOrbit mounted=true empty=false box=[39600,43800] series=[{n:71, firstX:39600, lastX:43800}]`，图例 `轨道高度（a − 地球半径） 598.33`，副标 `前 1 小时 · 点击定位 · 数据源 preview，采样 60 s`。598.33 = 6976.46421 − 6378.137，与我直读 CSV 的 `rel_s=43200` 值逐位一致 ⇒ 窗口宽度 4200 s、点在 T+12:00:00 存在，两项均独立证实；旧版 60× 压缩与假空态**不复存在**。
- `chEdge`：三条带 `lo = 1056.8139457702637 / 969.3270826339722 / 1013.5968828201294`（hi=lo+20），与我用 float32 首历元 ×1000 算出的 `1066.814 / 979.327 / 1023.597 m` ± 10 完全吻合（13 位精度），三条互不相同 ✓；`outRatio` 分别为 `0.9251 / 0.8802 / 0.8453`，图例逐条报数 ✓。不再拿 `edge_12` 一条带判三条线。
- 注意事项（不影响本项判定）：`diag()` 的 `x0/x1` 来自「最后一次完成的 draw」，而 `chart.js:22-24` 在宿主 `hidden`（clientWidth=0）时提前 return，故隐藏标签页的 box 可能是陈旧值；本次读数 `box == firstX/lastX` 自洽，属新鲜值。

## A4 能源/热控诚实空态 —— PASS

- 二进制（`chk_a1a4_bin.py`）：`power.gen_power/platform_power/payload_power/accum_energy/battery_margin` 各 259203 个值 **100% NaN**；`thermal.ext_heatflux/equip_power/temp_main/over_limit_count` 同样 259203/259203 NaN。manifest 66 列中**无** `power.battery_soc_pct`；thermal 侧 `temp*` 只有 `temp_main`，逐测点 `temp_<node>` 不存在。
- preview（`chk_data2.py`）：`preview/power.csv` 4323 行 × 5 列非空计数全为 0；`preview/thermal.csv` 4323 行 × 4 列非空计数全为 0；表头注释即写 `未计算`。
- 运行时（probe9）：能源页 2 行 + hero 4 格 = `暂无数据 / 字段未提供`；曲线 `mounted=false empty=true`，空态文案点名 `gen_power / platform_power / payload_power 整列为空，battery_soc_pct 字段未提供`；热控页同理点名 `temp_main 整列为空、逐测点 temp_ 列尚未交付`；编队总览三星对比表 `电池 SOC=字段未提供`、`发电功率/用电功率/关键温度=暂无数据`。
- 无伪装：`read()`（`panels.js:98-110`）分 `notConnected/notCalculated/missingField/emptyValue/bad/num|text` 六类，`sumOf()`（`:114-123`）任一列缺值即返回缺值类别而非 0，`cell()`（`:154-159`）对缺值不调用 `fmt()`；`exportRows()`（`:653-691`）按 64 点抽样剔除整列无值的列、空值写空串；`index.html` 内无任何静态能源/热控数字（`grep` 无命中）。唯一硬编码是 `nominal[...] || 1000` 的兜底标称（见 N2）。

## A5 阈值未放宽 —— PASS

命令：`git show HEAD:sim/config/display.json > outputs/scratch-p2r/head_display.json` + `D:/anaconda/python.exe -X utf8 outputs/scratch-p2r/chk_a5.py`。

逐键比对（工作树 vs HEAD）：`edgeToleranceM 10→10`、`edgeNominalM 1000→1000`、`driftToleranceM 50→50`、`sunAltGate {enabled:false,thresholdDeg:-6}` 不变、`notComputed` 5 项不变、`lagThresholdSec 90`、`minElevationDeg 10`、`coneHalfAngleDeg 1`、`timelineEventSkip ['点亮','熄灭']` 全部 SAME；新增/删除键集合为空。变化只在图表侧：删 `chDrift`，新增 `chOrbit/chAttitude/chPower/chThermal`，`chEdge` 加 `tab/note/图例全名`。**没有任何阈值被放宽**；89.5%→实测 92.5/88.0/84.5% 的带外如实报出（`outText` `panels.js:147-152`、`chart.js:96-108` 只画一个最大越限点，不逐点画圆）。

## A6 五标签截图证据 —— PASS（截图本身成立；同批截图另证成新缺陷 N1）

命令：`D:/anaconda/python.exe -X utf8 outputs/scratch-p2r/a6_pil.py`（PIL，灰度，裁剪 `x ≥ 72%`，即 1792×864 的 `x∈[1290,1792]`，502×864=433728 px）。

右栏两两差异像素（`any` = 任一灰度变化，`>12`）：

| 对比 | any | >12 |
|---|---|---|
| formation vs orbit | 54485 | 37981 |
| formation vs attitude | 49661 | 36637 |
| formation vs power | 83764 | 35759 |
| formation vs thermal | 78216 | 35602 |
| orbit vs attitude | 41983 | 32183 |
| orbit vs power | 74895 | 31618 |
| orbit vs thermal | 68283 | 31295 |
| attitude vs power | 76105 | 31016 |
| attitude vs thermal | 69774 | 30776 |
| **power vs thermal（最小）** | **24137** | **13555** |
| 各 vs ground | 147959–167739 | 62561–70796 |

六张 PNG 的 md5 互不相同；右栏有墨行数为 formation 421 / orbit 433 / attitude 425 / power 364 / thermal 349 / **ground 520**。round-1 阻断项 2（五张右栏逐像素相同、全为编队总览）**已修复**：`harness.py:536-542` 改为逐标签 `click → sleep → shot`，且 `:544-563` 用 PIL 自证最小差异 >300 px。

我另用自己拍的六张图（`probe9.py` 产物 `outputs/scratch-p2r/shots/p9-*.png`，同一 T+12:00:00）做同口径复核，最小对 `power vs thermal = 14686 (>12) / 22388 (any)`，与交付证据同量级 ⇒ 结论不依赖实现者的台架。

`tab-ground.png` 是否真的出现 ②④⑤ 行：两条独立证据都成立 ——(1) 运行时 `#paneGround` 有 3 个组头 + 12 行（`probe9`：`groups=['② 共同可见性','④ 亮度与频闪','⑤ 有效显示']`，`paneGroundLen=1463`），对应 `panels.js:704` 的 `if (activeTab !== 'formation') renderTable(epoch)` 修复；(2) 我把交付图 `tab-ground.png` 右栏 2× 放大后人工判读，可见 `② 共同可见性 / 单星可见 0.00 0/1` 行与 `目标区太阳高度（合肥）（°）` 曲线（图例 `太阳高度 -54.53`、`天黑门限（当前关闭）`、X 刻度 `T+11:00 / T+12:10`）。

仍未成立的老问题：`tab-formation.png` 的 `编队边长` 图只画到曲线顶部，**图例、X 轴刻度、越限百分比仍在面板滚动线以下**（放大判读确认），round-1 第 6 条对总览页依旧适用。

## A7 台架自证质量 —— FAIL（存在不可能失败的断言与只看行名的断言）

对象：`outputs/cdp-check/harness.py:407-563`。

1. **CSV 对账可整体静默跳过**（`:458-481`）：`csv_edges()` 找不到匹配行时 `return None`（`:470`），随后 `if ce:`（`:473`）把 A1 最关键的两条断言整体吞掉——不 PASS 也不 FAIL，报告里只是少两行。且 `want` 由界面自己的 `#tplus` 文本反推（`:462-463`），时刻正确性没有被独立锚定（我用 CSV `utcg` 与二进制切片独立锚定了，见 A1）。
2. **只看行名、不看行值 → 掩盖 N1**：`:419` 的 `rows` 取的是 `#tabPanes td.name`（行名），`:488-497`、`:502-504`、`:490-492` 全部断言都只在这份名单上做 `in` 判断。轨道页 13 行里 9 行的值在 T+12:00:00 是 `暂无数据`，台架照样 `PASS 轨道页含轨道要素与相对位置`。
3. **负向断言可在空集合上真空通过**：`:488-501` 形如 `not any(k in r for r in rows)`，`rows` 为空即通过；`power/thermal` 两侧没有配套的「行非空」正向断言（轨道/姿态有），所以「能源页整页空白」也能全绿。
4. **与实现者自写文案对撞**：`:525-528` 断言空态文案里含 `battery_soc_pct` / `temp_main`，这两个字符串是 `display.json:67/79` 的 `emptyReason`（实现者自己写的），改文案即假失败、编造文案即假通过；`:531` 断言含 `字段未提供`/`暂无数据`、`:515` 断言含 `越限`/`在带内`、`:505-508` 断言徽标不含 `可见`/`点亮`，同类问题（拿实现自己产出的中文当判据）。`bool(tabs2['power']['empty'])` 这一半是有意义的（空态确实被渲染）。
5. **`diag()` 自证不牢**：`:517-524` 直接信 `chartDiag()` 的 `x0/x1`，而该值在宿主隐藏时是陈旧值（`chart.js:22-24`）。本次读数与 `firstX/lastX` 自洽，结论未受影响，但断言本身可被陈旧框骗过。
6. 小问题：`check()` 的 `:34` `(say if cond else FAIL.append)` 是空表达式死代码；`:532` 的 `#curveSel` 删除断言在整页未初始化时同样为真；`:559` 的 300 px 阈值对 43 万像素的右栏偏低（实测最小 13555，仍有 45 倍余量）。
7. 台架完全没有覆盖 N1 所在的「preview 源历元映射」，也没有一条断言比较「界面显示值 vs 该时刻数据值」（除 ①/边长 之外），因此 A3/A4 的数值正确性基本靠实现者文案自证。

## A8 回归 —— PARTIAL（静态全通过；桥驱动下的运行时切换我未能独立复现）

- 桥 API：`git show HEAD:StarTM/web/managers/playback-manager.js` 与工作树逐名比对（脚本内联）：HEAD 21 个键 → 工作树 23 个键，**无删除**，新增 `layers/camBasis/labelNdc`（Phase 1 用途）。`setStep/selectSat/follow/setLight/setSunJ2000/orbitAt/setExternalMode/getTimestamp/getStepIntervalSec/__probe` 均在位（`playback-manager.js:1090-1340`）。`grep __simbridge` 只有定义处与 `tooltip-system.js:25` 的 `onPick` 调用。
- 唯一时钟：`grep simSeconds` 显示写 `state.simSeconds` 的只有 4 处（`main.js:128/194/222/308/372`），全部经 store；`performance.now()` 只用于墙钟 dt 与加载计时，`new Date()` 只用于文件名与快照 `起算时刻`。`loader.js` 的 `stepSec` 由 `setStepSec(bridge.getStepIntervalSec())` 单点注入。
- 卫星 ID：`store.js:11 sats:[1,2,3]`，`panels.js:745` 由 `entries.ground_obs.satIds` 覆盖；运行时卡片为 `TM0S1/TM0S2/TM0S3`（probe9 `cards`），二进制 manifest `sats:[1,2,3]`。
- 导出：`main.js:467-490` 的对话框/范围/星数逻辑未变，`exportRows` 仍只导出真有值的列（A4 已证），`btnExport` 在 attach 前 disabled（`index.html:436`）。
- 切标签不动相机/时间/选星：`panels.js:225-238 setTab()` 只改 `hidden` 与重绘；`panels.js:698-706` 不触碰相机。台架 `harness.py:448-449` 亦断言 `after == base`。
- 未能独立复现的部分：我的有头/无头会话里 iframe 的星历始终为空（`__simbridge.totalSteps()==0`、`mode:'ws'`），父页 `btnAttach` 的 18 s 等待窗口（`main.js:256-264`）超时 → `state.attached` 一直 false，因此**桥驱动下的 view/camera 切换与时间保持**我只做了静态核对。我的运行时证据改为直接装载 `panels.js` 模块（`probe9.py`），它能证明右栏所有取值/归属/曲线，但不经过 `main.js` 的相机联动。dev server 在 04:05–04:15 期间整体不可用（`curl` 连接失败），也压缩了我的复验窗口。

---

## 新缺陷清单

**N1（阻断）preview 数据源被按 1 s 下标索引：⑨ 组与 hero 的 R/T 在验收时刻全空、在早时刻错位 60 倍。**
`sim/js/panels.js:694-697` 用 `epoch = Math.floor(simSeconds / getStepSec())`（真实运行时 `getStepSec()=1`）作为**所有**数据源的行下标；而 `orbit_itrf`、`formation_rtn` 只有 `sim-data/preview/` 的 60 s / 1441 行（`sim/js/loader.js:78-88`、`getValue` 的 preview 分支 `loader.js:124-127`）。后果（均为我实测）：
- T+12:00:00（epoch 43200 > 1440）：`半长轴 a / 偏心率 e / 倾角 i / 升交点赤经 Ω / 星下点纬度 / 星下点经度 / 相对位置 R/T/N` 九行 = `暂无数据`，轨道页 hero 的 `径向相对位置`、`沿迹相对位置` 同样为空 —— 交付截图 `docs/ui-implementation/screenshots/phase-02/tab-orbit.png` 里可直接看到（我 2× 放大判读）。
- T+00:05:00（epoch 300）：同一批行显示的是 `preview/orbit_itrf.csv` 第 300 行 = `rel_s=18000`（UTC 2026-09-13 09:00:00，即 T+05:00:00）的值：界面 `半长轴 a 6971.1 km / 倾角 97.80 / RAAN 278.96 / 星下点 37.18, 127.89`，与 CSV `rel_s=18000` 行逐位相同（命令 `... probe10.py`）。这不是空态，是**把晚 60 倍时刻的数当成当前时刻显示**。
- 归属：Phase 2 新引入。HEAD 的 `panels.json` 只引用二进制可用的 7 个文件（`attitude/display/formation_geom/ground_obs/power/thermal/time_ident`），`orbit_itrf`(6 处) 与 `formation_rtn`(3 处) 是本轮新加（`git show HEAD:sim/config/panels.json` 对比）。`stepOf()` 只修了曲线（`panels.js:479-509`），表格/hero/KPI 路径没修。
- 修法方向（供参考，不改仿真值）：行读取也按各源自己的间隔换算历元，例如 `read()` 前用 `ep = Math.floor(simSeconds / stepOf(entries[file]))` 并夹到 `nEpoch-1`；或把 ⑨ 组切到与曲线同一套 `seriesFor` 取值。

**N2（中）`构型偏差` 的 `filter().map((e,i)=>…)` 下标错位。** `sim/js/panels.js:321-322` 与 `:375-376`：先 `filter(kind==='num')` 再用返回数组的下标 `i` 去取 `EDGE_FIELDS[i]` 的标称。三条都有值时侥幸正确；一旦某条边缺值（例如换数据集、preview 分支、末段缺列），剩余两条会拿错标称相减，**算出一个不存在的偏差数**并以红字显示。同处的 `|| 1000` 是硬编码兜底标称（`edgeNominalM` 在 `display.json:11` 里也已无人使用），建议缺标称时直接空态而不是猜 1000 m。

**N3（中）`fmt()` 精度把真实值显示成 0。** `sim/js/panels.js:141-144`：|v|<1000 一律两位小数 ⇒ `偏心率 e = 0.000788` 显示为 `0.00`（probe8 实测），读起来像「零偏心率」。指令 2.2 要求「数值与单位清晰分开、量级有依据」，小量级列（ecc、`array_proj_factor`、0/1 标志）应有自己的精度或改用 `1/0` 文字（②④ 组的 `单星可见 0.00`、`计划点亮 0.00` 同属这一类：徽标处已给「是/否」，表格里退化成小数）。

**N4（轻）`HERO.ground` 是死配置。** `sim/js/panels.js:18-23` 定义了地面页四格大字，但 `render()` 只在 `['orbit','attitude','power','thermal']` 调 `renderHero`（`:700-702`），probe9 实测地面页 `hero=[]`。不影响正确性（天空表 + ⑤ 行已覆盖），但属未接线的意图代码。

**N5（轻，遗留）X 轴只有 2 个时间刻度。** `sim/js/chart.js:71-72` 只画 `box.x0/box.x1`；`Basedoc/UI设计V2/天幕卫星仿真系统_前端逐组件改造指令_V0.3.md:420` 要求 4–6 个主要刻度。指令 2.5 的「时间刻度」勉强达标，round-1 第 6 条未处理。

**N6（轻，遗留）`本影` 仍被映射成错误色。** `sim/js/panels.js:273` `cls = i===0?'ok':i===1?'warn':'bad'`，`--bad` 即 `var(--status-error)`（`index.html:32`）。我复扫二进制：`sun_eclipse.shadow_state` 三颗星 86401 历元**恒为 0（日照）**，`sun_ratio` 恒为 1 ⇒ 运行时不会触发，仍是隐患而非现症（与 round-1 判断一致，机制上已从文本正则改为结构化码，但 2.4 的「不把正常状态涂红」在语义上仍未落实）。

**N7（轻）台架证据卫生。** `docs/ui-implementation/screenshots/phase-02/_crop-chart.png`（18143 B，02:28）与 `01/06/07/08` 等 Phase 1 编号截图混在同一目录；`phase-02-test.md` 同时记录 Phase 1 断言（1366/1280 布局、rAF、身份色），Phase 2 与 Phase 1 的证据在同一份日志里不可分离。

---

## 两个 round-1 阻断项的判定

| round-1 阻断项 | 判定 | 依据 |
|---|---|---|
| ①「平均星间距」单位错标 1000 倍（`963.7 km`） | **已修复** | `panels.js:317-320,330` 改用 `scale=1` 的 km 路；运行时实测 `0.964 km`，与二进制/两份 CSV 的 `0.963668 km` 逐位对账（A1）；`构型偏差` 仍走 ×1000 的米路且标签为 m，与 `125.8 m` 的算法自洽 |
| ② 五张标签截图右栏逐像素相同 | **已修复** | `harness.py:536-542` 逐标签 `click→shot`；我用 PIL 独立量得最小差异 13555 px(>12)/24137 px(any)，六张 md5 互不相同；我自有截图复现同一结论（A6） |

round-1 的高优先项：字段归属（②④ 迁地面页、⑩ 归姿态、能源去 sun_alt）**已落实并经运行时行表核实**（A2）；chOrbit 的 60× 压缩与假空态**已修**（A3）；chEdge 三条各自带带**已修**（A3）。**未处理**：图例/X 刻度在总览页截图仍在折叠线以下、X 轴仅 2 刻度（N5/N7）、`本影→红`（N6）。

## 我未能验证的内容与原因

1. **桥驱动下的完整交互路径**（切标签/切视图是否真的不动相机与时间、点曲线定位、点标签选星）：我的会话里 StarTM iframe 的星历始终为空（`totalSteps()=0`、`mode='ws'`），`main.js:256-264` 的 18 s 等待超时，`state.attached` 始终 false；dev server 还在 04:05–04:15 整体不可用（`curl http://127.0.0.1:8000/sim/` 连接失败），我按要求没有重启它，也没有改任何工程文件。因此 A8 的运行时部分只做了静态核对 + 台架日志（后者是实现者的证据，不计为独立）。
2. **hover tooltip 的真实交互**：`chart.js:137-147` 与 `panels.js:543-550` 的通路存在，但我无法在桥未就绪的会话里以真实鼠标事件验证（台架也未验证）。
3. **总览页图例/越限文字的可见性**：`tab-formation.png` 判读确认仍在折叠线以下，我没有找到任何一张覆盖 `#chEdge` 图例与 X 刻度的交付截图 ⇒ 该子项无视觉证据（N7）。
4. **`phase-02.diff` 的完整性**：本轮未逐行比对 diff 文件与工作树的对应关系（工作树在审查期间被 Phase 5 作业再次改写），我以哈希快照 + 逐条代码定位代替。

（本报告的复算脚本与截图都在 `outputs/scratch-p2r/`，按任务要求随报告一并删除；本报告文件本身是唯一新增的工程文件。）

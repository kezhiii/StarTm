# Phase 2 独立验收审查：右侧数据面板、字段映射、曲线

审查快照：分支 `sim-system`，HEAD `a8f7841`，工作树未提交。审查时刻 2026-10-16 02:31–02:50。

被审变更集：`docs/ui-implementation/phase-02.diff`（`sim/config/display.json`、`sim/js/chart.js`、`sim/js/loader.js`、`sim/js/panels.js`）+ `docs/ui-implementation/phase-02-indexhtml.diff`（`sim/index.html`）。

变更集与工作树的对应关系（本审查独立核对）：

- `git diff HEAD -- display.json chart.js loader.js panels.js` 共 18 个 hunk，phase-02.diff 收录 15 个；未收录的 3 个（`panels.js @@ -480,7 / -490,9 / -512,7`）是 `eventMarks`/`paintWindows` 时间轴事件改动，属 Phase 3，已另行记入 `docs/ui-implementation/phase-03-worktree.diff`。
- `git diff HEAD -- sim/index.html` 共 19 个 hunk，phase-02-indexhtml.diff 收录 17 个；未收录的是时间轴事件标记 CSS 与地面观察说明文案，同属 Phase 3。
- 结论：Phase 2 变更集是工作树 diff 的真子集，剔除项归属正确，无「把 Phase 3 改动混进 Phase 2 账上」的情况。
- 需要更正任务前提：Phase 3+ 不只在 `main.js`。`panels.js`、`index.html` 同样被 Phase 3 改过，审查期间（02:42:45）`sim/index.html`、`sim/js/panels.js` 被再次改写，并新增 `sim/js/scene-io.js`（保存/加载，Phase 4 范围）。Phase 2 的 15 个 hunk 在 02:44 复核时仍逐条在原起始行存在，本报告的 `panels.js` 行号按 02:44 版本给出。
- `sim/config/panels.json`（表2-1 分组定义）mtime 为 10-12 16:47，本轮未改，但它决定轨道页/姿态页表格里到底出现哪些字段，必须一起判。

数据事实由本审查用 `D:/anaconda/python.exe` 直读 `sim-data/render/columns.f32`（float32，按 manifest 的 `offset`/`count` 切片）、`sim-data/render/manifest.json`、`sim-data/formation_geom.csv`、`sim-data/preview/orbit_itrf.csv`、`sim-data/sun_eclipse.csv` 复算，未采信任何一方结论。

---

## 1. 逐项判定

| 条款 | 判定 | 证据 |
|---|---|---|
| **2.1** 五标签各有独立字段映射与图表容器 | **PASS** | 容器：`sim/index.html:493`（`#chEdge`/编队）、`:500-503`（`#chOrbit/#chAttitude/#chPower/#chThermal` 四个独立 div）、`:528`（`#chSun` 已移出 `#tabSat`，落在 `#tabGround`）。映射：`panels.js:11-36` `HERO` 四套、`:45-51` `TAB_GROUPS` 四套、`display.json` 每张图带 `tab`。显隐：`panels.js:446-450` `syncChartVisibility()` 按 `spec.tab !== activeTab` 置 `hidden`，`setTab` 只调 `syncChartVisibility + render`（`:215-228`），不含 `fetch`（数据只在 `initPanels` 一次性加载，`main.js:307`）。 |
| **2.1** 切标签不改相机/时间/选星/不重载数据 | **PASS** | `台架` `outputs/cdp-check/harness.py:385-406`：切换前后比对 `#tplus`、`__probe().cam`、`#kvSat`。`cam` 是 `camera.position.toArray()`（`StarTM/web/managers/playback-manager.js:1252`），不是自证字符串。`phase-02-test.md:70-73` 四项 `after == base` 全等（`{'t':'T+12:00:00','cam':[105,37.5,105],'sat':'TM0S2'}`）。本审查静态复核 `setTab` 路径无 `selectSat`/无 `bridge` 写入，成立。局限：探针只取位置向量，相机姿态角变化不会被发现。 |
| **2.2** 编队总览组件顺序 | **PASS（顺序）** | `index.html:487`（标题+`#kvFormationTag`）→ `:488` `#formationHero` 四 KPI → `:490` `#cmpBody` 三星对比表 → `:491-492` 星间距离三行 → `:493` `#chEdge` 曲线。截图 `screenshots/phase-02/tab-formation.png` 自上而下与此一致。 |
| **2.2** 四 KPI | **FAIL** | `panels.js:296` 以 `scale=1000` 读 `edge_*`（`formation_geom` 单位是 km，×1000 后是 m），`:298` 求均值得到**米**量级，`:308` 却拼成 `avg.toFixed(1) + ' km'`。T+12:00:00 实测渲染为 **`963.7 km`**（`tab-formation.png`、`04-1366x768-overview.png` 两张截图均可见），而 `sim-data/formation_geom.csv` `rel_s=43200` 三条边长 0.940968/1.007476/0.942560 km，真均值 **0.9637 km**。同一面板下方 `#edgeRows` 又如实显示 0.941/1.007/0.943 km，自相矛盾，差 1000 倍。这正是上一轮 `phase-01-review.md:118`（N7）点名移交 Phase 2 修掉的项（同文 `:149` 列入最小修复清单第 7 条），未修。 |
| **2.2** 三星对比表（日照/SOC/发电/用电/关键温度） | **PASS** | `panels.js:316-327` 行序与要求一致；`tab-formation.png` 实测显示 光照状态=日照、电池 SOC=`字段未提供`、发电功率/用电功率/关键温度=`暂无数据`，无一处填 0。缺值判定与本审查数据核对一致（见 2.4）。 |
| **2.2** 三组星间距离各占一行、单位清楚 | **PASS** | `panels.js:341-347`：`EDGE_NAME` 用全名 `TM0S1–TM0S2 / TM0S2–TM0S3 / TM0S3–TM0S1`，表头 `距离 (km)`，`read(..., scale=1)` 不做无依据换算，`:347` 注明「来源 formation_geom，单位 km」。截图三行 0.941/1.007/0.943 与 CSV 逐位吻合（三位小数）。 |
| **2.3** 轨道页只放轨道量 | **FAIL** | `panels.js:15-16` `HERO.orbit` 第 3/4 格是 `ground_obs.range`（站心斜距）、`ground_obs.el`（仰角）；`TAB_GROUPS.orbit=['①','②']`（`:46`）把 `sim/config/panels.json:39-78` 的「② 共同可见性」整组（`visible/common_vis/az/el/range`）渲染进轨道页表格（`panels.js:380,389`）。台架自己就量到了：`phase-02-test.md:68` orbit hero = `["轨道高度598.33km","速度7.56km/s","站心斜距8993.2km","仰角-39.44°"]`。`IMPLEMENTATION_LOG` Phase 2「遗留」一节已自陈此项未收敛，但 V0.3 §6.2 与主指令 2.3 是硬要求，不能以「已登记」抵账。 |
| **2.3** 姿态页只放姿态量 | **FAIL** | `TAB_GROUPS.attitude=['③','④','⑤']`（`panels.js:47`）→ 姿态页表格含 `panels.json:119-158`「④ 亮度与频闪」（`display.plan_strobe/actual_strobe/freq_hz/duty/brightness`）与 `:159-177`「⑤ 有效显示」（`display.effective` + **`ground_obs.sun_alt` 目标区太阳高度**）。太阳高度既不是姿态量，也不该在没有任何说明的情况下出现在单星分系统页。 |
| **2.3** 能源页不得出现 `ground_obs.sun_alt` | **PASS** | `display.json:56-68` `chPower.file=power`；`TAB_GROUPS.power=['⑥']`（`panels.js:48`）→ 表格只取 `panels.json:178-197`（`gen_power/battery_margin`，均 `power.*`）；`HERO.power`（`:24-29`）四格全为 `power.*`。`chSun` 已归 `tab:"ground"`（`display.json:83`）并移入 `#tabGround`。台架 `harness.py:407` 亦判否成功路径。 |
| **2.3** 热控页只放热控量 | **PASS（有一处共用带）** | `TAB_GROUPS.thermal=['⑦']`（`panels.js:49`）= `temp_main` + `over_limit_count`；`HERO.thermal`（`:30-35`）四格全为 `thermal.*`。残留：`panels.js:37-43` 的 `BADGES` 条带（`attitude.stable/ground_obs.visible/common_vis/display.*_strobe`）在四个单星标签页共用，能源/热控页因此仍带站心与显示类徽标（`:273-281`）。属跨域信息但不含数值冒充，记普通问题。 |
| **2.3** `shift: -6378.137` 的算术与来源列 | **PASS** | 来源列确为半长轴且单位 km：`sim-data/preview/orbit_itrf.csv` 第 1 行表头含 `sma`，第 3 行单位行为 `-, s, -, km, km, km, deg, deg, km, -, deg, deg`（`sma` 位第 9 列 → km）；首行 `sma=6978.1371` → 6978.1371 − 6378.137 = **600.0001 km**，全天极值 581.354–600.080 km。与桥算出的 hero 值 598.33 km 同量级同区间。减的是 WGS84 赤道半径，与 `panels.js:127` `orbitAt()` 既有口径一致。 |
| **2.4** 结构化状态取代文本正则 | **PASS** | HEAD `panels.js:317` `cls = na ? 'na' : (/不可见\|本影\|异常/.test(cells.join('')) ? 'bad' : '')`（`git show HEAD:sim/js/panels.js`）在 live 已删除，改为 `panels.js:332-336` 只看 `kind`（`allVoid → 'na'`，`some(kind==='bad') → 'bad'`）。全 `sim/` 检索 `不可见\|本影\|异常` 只剩数据标签常量与注释（`panels.js:54,257-264,333`）与 `sim/tools/make_synthetic.py`，无判色正则。 |
| **2.4** 「本影」不再被涂成错误 | **PASS（有一处潜在回潮）** | 对比表行：`光照状态` 走 `panels.js:317-318` → `isVoid` 之外统一 `{kind:'text'}`，永不进 `bad` 分支。本影裕度文字（`:260`）也不再触发涂红。潜在：`shadowBadge` `:254` `const cls = i === 0 ? 'ok' : i === 1 ? 'warn' : 'bad'`，`shadow_state===2`（本影）仍映射红色 `--bad`；本数据集该列 259203 个值恒为 0（本审查扫描），运行时不会出现，属遗留隐患，记普通问题。 |
| **2.4** 六类 `kind` 可辨、不塌成 0 | **PASS** | `read()` `panels.js:88-100` 六类 `notConnected/notCalculated/missingField/emptyValue/bad/num|text`。运行时可见四类：`字段未提供`（`power.battery_soc_pct`，manifest 66 列确无此列，preview 表头亦无）、`暂无数据`（`gen_power/temp_main`，列在但 0/259203 有限值）、`尚未计算`（`display.effective`、`ground_obs.incone`、`formation_geom.drift_*` 在 `display.json:95-101` 名单里，`:91` 短路，不会把恒 0 当读数）、正常值。`notConnected/bad` 为条件分支（加载失败/非有限数），当前数据集不可达。所有 void 值经 `cell()`（`:144-149`）与 `isVoid()`（`:101`）走文本，`fmt()` 不参与，**没有任何一处把缺值转成 0**。台架 `harness.py:416` 实测卡片文本集同时含 `字段未提供` 与 `暂无数据`。 |
| **2.5** `#tabSat` 共用图表容器已修 | **PASS** | 见 2.1；`chDrift` 整张删除（`display.json` diff），`chSun` 移出共用区，四个单星标签各自一张图，实测标题互不相同（`phase-02-test.md:68`）。 |
| **2.5** `#curveSel` 死控件 | **PASS** | HTML 与 JS 全仓检索 `curveSel\|data-curve` 在 `sim/`、`StarTM/web/` 零命中（仅存在于文档与台架），`index.html` 底部 `#grpCurves` 改为静态说明文字，不留假按钮。 |
| **2.5** 不逐采样点画圆 | **PASS** | `chart.js:78-96`：删除 HEAD 的 `s.data.forEach(... arc(...2.2) ...fill())` 逐点描红，改为每条系列只标 1 个最大越限点（半径 3）。允许带填充与标称虚线保留。 |
| **2.5** 降采样不改底层数据与导出 | **PASS** | `panels.js:456` `stride` 只决定取样密度，产出的是新建显示数组（`:458-466`），不回写 `spec.series`；`chart.js:90-92` 只往显示对象上挂 `outRatio`。导出 `exportRows`（`panels.js:618+`）逐历元 `getValue` 原值输出，Phase 2 变更集未触碰它（`git diff --numstat` 该函数无 hunk）。`loader.js` 本轮 +18/−0，纯新增。 |
| **2.5** 89.5% 带外是诊断而非改阈值 | **PASS** | 与 `git show HEAD:sim/config/display.json` 逐键比对：`edgeToleranceM 10→10`、`edgeNominalM 1000→1000`、`driftToleranceM 50→50`、`coneHalfAngleDeg 1→1`、`minElevationDeg 10→10`、`lagThresholdSec 90→90`、`sunAltGate {enabled:false,thresholdDeg:-6}` 不变；`chEdge` 的 `scale:1000 / bandFromNominal:true / band:"tolerance"` 不变；`notComputed` 名单不变。唯一新增是 `tab`、图例全名与 `note` 文案。**没有任何阈值被放宽。** 独立复算（`sim-data/formation_geom.csv`，86401 行，`rel_s` 步长 1 s）：`edge_12` 首历元 1.066814 km、全天 0.685956–1.329920 km、对首历元偏离 >10 m 的采样点占 **93.90%**（`edge_23` 84.90%、`edge_31` 89.63%）；逐秒 \|Δ\| 均值 45.1 m、中位 12.6 m、p90 118.7 m、最大 346.1 m；T+11:50–12:00 十分钟内局部极值翻转 **353 次**（与 `IMPLEMENTATION_LOG` 声称的 353 完全一致）；T+12:00:00 前后逐秒序列实测 1.0604 / 0.9407 / 1.0605 / 1.0606 / 0.9410 km。二进制 `columns.f32` 切出的 `edge_12` 与该 CSV 最大差 5.96e-08 km。**结论：振荡属实，不是渲染 bug，实现者的说法成立，没有靠改阈值掩盖。** 两点更正：台架窗口（T+12:00:00，`epLo=39600..43800`、`stride=7`）按 UI 自己的带算出的越限比例是 **92.5%**，注释与日志里的 89.5% 是旧窗口残值；且 `panels.js:482` 只取 `series[0]` 的标称给三条线共用，`edge_23/31` 的初始边长本就与 `edge_12` 差 −87.5 m / −43.2 m，天然落在带外，比例被进一步抬高（HEAD 即如此，非本轮引入）。 |
| **2.5** 每张图确有可画的曲线 | **FAIL** | `chOrbit` 不可用。`orbit_itrf` 不在 render manifest（本审查枚举 manifest 66 列，文件集合为 `formation_geom/ground_obs/attitude/display/power/thermal/time_ident/sun_eclipse`），只能回退 `sim-data/preview/orbit_itrf.csv`：4323 数据行、每星 1441 历元、`rel_s` 步长 60 s。而 `panels.js:459-463` 的横轴一律 `x = ep * getStepSec()`（`getStepSec()` 由 `main.js:305` 设为桥的 1 s），于是：(a) `simSeconds > ~5040 s` 后窗口 `[simSeconds-3600, simSeconds+600]` 里已无 `ep ≤ 1440` 的点 → 全天空态，台架在 T+12:00:00 实测到正是这个结果（`phase-02-test.md:69` orbit `"empty": ["本场景没有可画的轨道高度曲线…"]`）；(b) 前约 84 分钟确实会画线，但把相隔 60 s 的点画在相隔 1 s 的位置上，**时间轴被压缩 60 倍**，tooltip 与轴标读数随之失真；(c) 空态文案用的是通用兜底串「所选时间窗内该字段没有有效值」，而该列其实有 4323 行有效值，属不实归因。 |
| **2.6** 标题/单位 | **PASS** | `panels.js:416`（有图）与 `:431`（空态）都渲染 `${spec.title}（${spec.unit}）`；截图可见 `编队边长（m）`；台架量到 `轨道高度（km）/太阳入射角（°）/发电功率与用电功率（W）/温度测点（℃）`。 |
| **2.6** 图例 | **NOT-TESTED（代码在，证据缺）** | `panels.js:493-502` 生成图例并附越限比例（`outText` `:137-142`）。但 `#console` 实测矩形 394×658@(1390,56)（`phase-02-test.md:15`），`.chart canvas` 高 178 px（`index.html:254`）落在面板内滚动区以下：交付截图里只看得见图区顶部约 60 px，图例、X 轴刻度、越限百分比文字**没有任何一张截图覆盖**。 |
| **2.6** 时间刻度 | **FAIL（不达标）** | `chart.js:60-61` 只画 `tlab(box.x0)` 与 `tlab(box.x1)` 两个 X 标签，无中间刻度与竖网格；V0.3 §6.1 组件 5 要求「X 轴控制在 4–6 个主要刻度」。本轮改了 `chart.js` 的越限画法却没动轴。 |
| **2.6** hover tooltip | **NOT-TESTED** | 代码通路完整：`chart.js:125-133` 派发 `charthover` → `panels.js:415-421/508-515` 写 `#tip`。台架无鼠标移动事件，截图无 tooltip，测试记录未提。 |
| **2.6** 空态不画伪曲线 | **PASS** | `panels.js:428-434` `renderEmpty` 直接替换 `innerHTML` 为文字块（不含 canvas），物理上无法再画线；`chPower/chThermal` 的空态点名缺失列（`display.json:67,79`），与本审查对 manifest/表头的核对结果一致（`battery_soc_pct` 无列、`temp_main` 列在但整列空）。能源/热控动态功能按 `BLOCKED-DATA` 计，不判 PASS。 |
| **2.6** 五标签逐一截图 | **FAIL（证据不成立）** | `screenshots/phase-02/tab-{formation,orbit,attitude,power,thermal}.png` 五张图右栏逐像素相同：以 `tab-formation.png` 为基准，其余四张在 `x ≥ 1390`（右栏）差异像素 **0**，全图差异仅 3–7 个像素且全部落在中央三维场景（本审查 `PIL`+`numpy` 实测）。五张显示的标签都是「编队总览」（高亮下划线 + `编队状态` 内容）。根因在 `harness.py:398`：批量 JS 求值末尾把标签切回 `formation`，`:418-419` 才逐名截图。因此 2.6 要求的「五标签逐一截图」实际不存在，而 `phase-02-test.md:6` 写「失败项：无」。 |
| **7** 回归：时钟 | **PASS** | `store.js:6` `state.simSeconds` 仍是唯一权威时钟（本轮 `store.js` 未被 Phase 2 变更集触碰）；`panels.js:227,195` 只通过 `hooks.simSeconds()` 读取。 |
| **7** 回归：loader / 事件分类 / 导出 / 桥方法 | **PASS** | `loader.js` diff 为 +18/−0，仅新增 `hasField`（带缓存），`loadCategory/getValue/lastSecond/getStepSec` 未改；`EVENT_CLASS`（`panels.js:56-61`）与 `runsOf` 未被 Phase 2 变更集触碰；`exportRows` 未被触碰（后续 Phase 3/4 才加 `epLo/epHi`，已排除在本变更集外）；桥 `orbitAt` 仍被复用（`panels.js:122-129` + `main.js:322`），`setLayer` 仍在（`main.js:163-168`）。 |
| **7** 回归：ID 与缺值口径 | **PASS** | ID 仍为数字 0：`panels.js:175,329,341`，截图 `TM0S1/TM0S2/TM0S3`。能源/热控缺值未被默认值替换：见 2.4 与数据实测（0/259203 有限值 → 界面显示 `暂无数据`/`字段未提供`）。 |
| **8** 范围：无 Phase 3+ 夹带 | **PASS（附说明）** | Phase 2 变更集内无时间轴/事件/地面观察行为、无配置抽屉、无保存加载改动。工作树里同文件的 Phase 3+ hunk（`eventMarks` 带 `sat_id`、`paintWindows`、地面观察表行选中、时间轴事件 CSS、`#tabGround` 固定站说明、新增 `sim/js/scene-io.js`）均被排除在 phase-02 变更集之外并记入 `phase-03-worktree.diff`；`phase-03-worktree.diff` 里含 `exportRows` 时间段参数（§4.3 导出范围），属 Phase 4 口径，请 Phase 3/4 审查对账，本阶段不据此扣分。 |
| 台架断言是否可证伪 | **部分可证伪，部分自证** | 详见 §2「台架质量」。 |

---

## 2. 问题分级

### 阻塞问题

1. **KPI「平均星间距」单位错标 1000 倍（2.2）**。`sim/js/panels.js:296-298,308`：米量级数值配 `km` 标签，T+12:00:00 面板大字显示 `963.7 km`，真值 0.9637 km；同屏 `#edgeRows` 显示 0.941/1.007/0.943 km，自相矛盾。这是 `phase-01-review.md:118` N7 明文移交 Phase 2 处理、并写进该文最小修复清单第 7 条的项，本轮只改了「星间距离」三行表，KPI 漏改。属于「把假数当成事实显示」，不接受登记不修。
2. **2.6 的五标签逐一截图证据不存在**。`docs/ui-implementation/screenshots/phase-02/tab-*.png` 五张右栏逐像素相同，全部是编队总览；`phase-02-test.md:6` 仍记「失败项：无」。缺陷在 `outputs/cdp-check/harness.py:398`（截图前把标签切回 formation）与 `:418-419`（之后才逐名截图）。要么补拍，要么把「五标签逐一截图」记为未完成。

### 高优先级问题

3. **轨道页/姿态页字段纯净度未达 2.3**。轨道页 hero 含站心斜距/仰角（`panels.js:15-16`）、表格含「② 共同可见性」整组（`panels.js:46` + `sim/config/panels.json:39-78`）；姿态页表格含「④ 亮度与频闪」「⑤ 有效显示」，后者带 `ground_obs.sun_alt 目标区太阳高度`（`panels.js:47` + `panels.json:159-177`）。`sim/config/panels.json` 本轮未改，是收敛动作缺失的直接原因。
4. **`chOrbit` 曲线不可用且时间轴失真**。preview 源 60 s 步长被按 1 s 轴绘制（`panels.js:459-463` + `display.json:31-43`）：T+01:24 之后恒空态、之前画出的线横轴压缩 60 倍、空态文案把「索引越界」说成「该字段没有有效值」。要么按 entry 自身步长映射 x（并如实标注 60 s 采样），要么把 `sma` 并入 render manifest，要么撤下这张图并说明。
5. **越限判定用单一标称**。`panels.js:482` 以 `series[0].field` 的初值给三条边共用 ±10 m 带，`edge_23/edge_31` 从第一秒起就在带外，图例「实测越限 xx%」被系统性抬高。逐系列取各自标称（`renderFormation` 的 `devs` 已是逐字段口径，`panels.js:299-300`），或在图例里写清是相对 `TM0S1–TM0S2` 初值。

### 普通问题

6. X 轴只有 2 个时间标签（`chart.js:60-61`），未达 V0.3 §6.1 组件 5 的 4–6 个主要刻度；图例、越限比例、`spec.note`（只挂在 `.sub` 的 `title` 上）在交付截图里全部位于折叠线以下，无视觉证据。
7. 左栏「任务状态」仍输出 `可见/不可见`（`panels.js:360`），正是 V0.3 §1E 点名的原句；台架 `harness.py:417` 只采 `#tgtList .tgt .g b`，看不见这一处，所以断言通过而问题存活。光照徽标 `shadow_state===2` 仍映射红色 `bad`（`panels.js:254`），本数据集恒 0 故未触发。
8. 编队总览组件 1 缺「运行中/已暂停/已完成」面板内徽标（运行态只在顶栏与播放区）；`当前仿真时刻` KPI 因字符串长度 >9 被压到 16 px（`panels.js:313`），低于 §6.6 的 21–26 px 关键数值区间。
9. `.cmp td.na { font-size: 11.5px }`（`index.html:218`）低于 §6.6「普通表格文字至少 12px」，缺值行恰好全部命中该类。
10. `chAttitude` 两条系列 `sun_eclipse.incidence_deg` 与 `array_incidence_deg` 在数据里逐位相同（本审查比对 3×86401 个 float32，最大差 0.0），图上呈现为「载荷轴」与「太阳翼法向」两个看似独立的量。数值不假，但语义披露不足，建议合并或注明当前太阳翼为本体系。
11. 死配置与死键：`chDrift` 删除后 `driftToleranceM: 50` 无引用；`edgeNominalM: 1000` 全仓无引用（标称实际取首历元）；`chOrbit` 顶层 `"field":"sma"` 未被读取（生效的是 `series[0].field`）；`initPanels` 的标称收集对 `sum` 系列会生成垃圾键 `power.undefined = 0`（`panels.js:702-707`，当前无副作用）。`devs` 的 `|| 1000` 兜底（`panels.js:300`）在标称缺失时会造出一个假偏差，建议改为 `暂无数据`。
12. 注释与日志里的 89.5% 未随窗口更新（当前窗口实测 92.5%），数字方向正确但不可复现，建议改成「按当前窗口实测 xx% 由图例给出」的口径。
13. 证据卫生：`phase-01` 与 `phase-02` 的 1366×768、1280×720 截图右栏逐像素相同（本审查比对差异 0），说明 Phase 1 的窄屏证据是在 Phase 2 代码之上拍的（`phase-01-review.md:120` N9 已预警并发修改）。本轮审查期间 `sim/index.html`、`sim/js/panels.js` 于 02:42:45 再次被改写并新增 `sim/js/scene-io.js`，Phase 2 的 15 个 hunk 复核仍在原位。

### 通过项

- 五标签的容器与字段映射真正分开，切标签只换内容，`tplus/camera.position/kvSat` 三项运行时全等，探针取自 Three.js 相机本身，可失败。
- `#curveSel` 彻底删除，全仓零引用，不留假按钮。
- 逐采样点画圆取消，越限改为「允许带 + 三条线 + 每条 1 个最大越限点 + 图例百分比」，可读性与披露同时改善。
- 阈值与标称一个字节没改：`edgeToleranceM/edgeNominalM/driftToleranceM/sunAltGate/notComputed` 与 HEAD 逐键相同，`chEdge` 的 `scale/bandFromNominal/band` 未动。
- 「89.5% 带外」的归因经独立复算成立：`formation_geom.csv` 逐秒跳变（p90 118.7 m、十分钟 353 次极值翻转），二进制与文本文件一致到 5.96e-08 km，`time_ident.mode` 确为 `FreeDrift-Synthetic`。既没改数据，也没缩窗口掩盖。
- 能源/热控零伪造：`power` 5 列与 `thermal` 4 列实测 0/259203 有限值，界面一律 `暂无数据`；`battery_soc_pct` 实测 manifest 66 列与 preview 表头都没有 → `字段未提供`；`temp_<node>` 不存在 → 空态点名。`sumOf`（`panels.js:104-113`）在两列都缺时返回缺值类别而非 0。
- 缺值类别在运行时可分辨（`字段未提供` 与 `暂无数据` 同屏出现），`notComputed` 的恒 0 列被 `read()` 短路，不会画出贴底假曲线，`display.effective` 也不再产生时间轴假窗口带。
- 编队总览顺序、三组星间距离三行全名 + 统一 km、三星对比表行序与单位，均与 V0.3 §6.1 一致；显示值与 `formation_geom.csv` 逐位吻合（含 `构型偏差 125.8 m` 对应 CSV 偏离 −125.8 m）。
- 回归面干净：`loader.js` 纯新增，`orbitAt`/`setLayer`/导出/事件分类/`state.simSeconds`/`TM0S1/2/3` 全部沿用未重写。

### 台架质量（`outputs/cdp-check/harness.py` 的 `phase-02` 块）

真正可失败：`标签切换不改时间/相机/选星`（`:405-406`，比对 `__probe().cam`，取自 `camera.position.toArray()`）、`#curveSel 已删除`（`:414`）、`三组星间距离各占一行`（`:413`，行数）、`缺值区分字段未提供/暂无数据`（`:416`，DOM 文本集）、`控制台无 error / 无未捕获异常`（`:497-498`）。

自证或弱于其名：

- `:409-410`「能源页/热控页给出真实空态并点名缺失字段」判据是 DOM 文本含 `battery_soc_pct`/`temp_main`，而这两个串来自 `display.json` 里手写的 `emptyReason`。它证明配置被回显，不证明字段真的缺失；真凭据是 manifest/表头扫描，台架里没有。
- `:411-412`「四个单星标签各自有独立图表」只数 `.chart h3` 标题且 `len(set(...)) >= 3`（四张里三张互异即通过），标题同样来自配置。轨道图当时是空态（`:395` 采到的 `empty` 已写明），照样被判通过——空态块里也带 `h3`。
- `:407-408`「能源页/轨道页不出现太阳高度曲线」只查图表标题，不查同页参数表；`sun_alt` 实际出现在姿态页表格里，这条断言按构造永远不会红。
- `:417`「卡片不再用含混的可见/不可见」只采 `#tgtList` 卡片的 `<b>`，覆盖不到 `#missionSum` 的 `不可见`。
- `:413` 只数行数，不看单位与数值，正是它放过了 1000 倍单位错标。
- 没有任何断言覆盖：X 轴刻度数、图例内容、tooltip、越限百分比文字、图表是否真的画出了线（`painted` 类像素核对只在 Phase 1 的放大窗上做过）。
- `:418-419` 的逐标签截图在 `:398` 复位之后执行，结构上不可能拍到不同标签。

---

允许进入下一阶段：否

最小修复清单（全部完成并复审通过后方可进 Phase 3）：

1. 改 `sim/js/panels.js:308`（或 `:296-298` 的取值口径），使「平均星间距」的单位与数值一致（建议与 `#edgeRows` 同为 km 三位小数），并在台架补一条可失败断言：KPI 文本数值 ÷ `#edgeRows` 三行均值 ≈ 1。
2. 补拍五标签逐一截图：把 `harness.py` 的标签点击移出批量求值、逐标签 `click → 等待 → shot`，或至少在截图前不切回 `formation`；同步更正 `phase-02-test.md` 的「失败项：无」。
3. 轨道页去掉 `站心斜距/仰角` 两格与「② 共同可见性」组，姿态页去掉「④ 亮度与频闪」「⑤ 有效显示」组（含 `ground_obs.sun_alt`），需要保留就改放到地面观察页；涉及 `sim/js/panels.js:15-16,46-47` 与 `sim/config/panels.json`（本轮未改的文件）。
4. 修 `chOrbit`：横轴按该 entry 自身采样间隔映射并标注「60 s 采样」，或把 `sma` 并入 render manifest；空态文案改为如实说明「该文件仅 1441 个 60 s 历元，当前窗口超出覆盖范围」。
5. 越限带逐系列取各自初值标称（`panels.js:482`），或在图例中写明是相对 `TM0S1–TM0S2` 初值；同时把注释/日志里的 89.5% 更新为当前窗口实测值。
6. 台架补三条可失败断言：图表 X 轴刻度数 ≥ 4、图例含越限百分比文本、`emptyReason` 之外另由 manifest 扫描断言 `battery_soc_pct`/`temp_<node>` 确实不存在。

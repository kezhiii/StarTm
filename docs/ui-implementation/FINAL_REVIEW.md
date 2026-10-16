# 最终独立验收复核（§6.3）

复核人：最终独立验收审查（只读；未修改任何工程代码，scratch 仅在 `outputs/scratch-final/`）
日期：2026-10-16
基线：分支 `sim-system`（工作树未逐阶段提交）
被审文档：`docs/ui-implementation/FINAL_ACCEPTANCE.md`（矩阵）、`DATA_FIELD_MAPPING.md`、`REMAINING_BLOCKERS.md`、`IMPLEMENTATION_LOG.md`、`phase-0X-test.md/review.md`
运行环境：dev server `:8000` 已在监听（本次复核未自行重启）；取证期间同机可能有其它验收浏览器并发（环境说明，不计缺陷）。

## 结论

**允许通过最终验收：否（需先纠正矩阵中的 6 处过度声明并补 2 处真实缺陷；数据真实性本身通过）。**

理由摘要：
1. 数据真实性这条硬约束（不得用硬编码数值伪装能源/热控）我独立查证为**真**：`power` 5 列、`thermal` 4 列在二进制里 259203 点全 NaN，在 preview 里整列为空，且代码里不存在给这些字段兜底的数值路径。这一条不需要返工。
2. 但矩阵有 2 行 PASS 与当前代码直接矛盾（10.5 px canvas 文字、编队小窗旧调色板），且这两处**正是 `phase-05-review.md` 自己提出、标记为「待运行时再核」却从未闭环的项**。
3. 门禁口径不成立：`phase-04-review.md`/`phase-05-review.md` 仍是「进行中/待填」，Phase 3 根本没有独立审查文件，而 §2 已把 Phase 3/4/5 的条目写成 PASS；§5 又宣称端到端 12 项「全部实跑通过」，与同文档内 NOT-TESTED（全屏）和「恢复路径未做成门禁」（重载）自相冲突。
4. 字段绑定的运行时对账我只完成到「代码级 + 独立数据级」，浏览器实跑得点在中途因页面未进入 csv 模式而中断（见 T3），因此**不能给 T3 完整 PASS**。

---

## T1 — PASS 行证据抽查（PARTIAL：不合格，7/10 行证据成立）

抽查了 10 行标 PASS 的条目，逐行去找实物（截图/我亲自读的代码/我亲自算的数据）：

| 矩阵行 | 判定 | 我实际查到的 |
|---|---|---|
| 距离单位换算有依据（数据本身是 km） | 成立 | 我独立从 `sim-data/render/columns.f32` 取 `formation_geom.edge_*`：ep=300 → edge_23 = 0.96396，ep=43200 → edge_12 = 0.940968 / edge_23 = 1.007476 / edge_31 = 0.942560，与矩阵所写 0.964 / 0.941 / 1.007 / 0.943 逐值吻合（`scale=1`，单位 km，见 `sim/config/panels.json`） |
| 能源/热控空态（两行） | 成立 | 见 T2 的实测列统计 |
| 89.5% 带外红点定性 | 部分成立 | 阈值确实一字节未改：`sim/config/display.json` `edgeToleranceM=10`，`chEdge.band="tolerance"`+`bandFromNominal`（`sim/js/panels.js:513,521-526`）；但矩阵写 92.5/88.0/84.5%、`REMAINING_BLOCKERS.md` 末段写 edge_12 = 93.90%，两处自述数字不一致且都属实现方自算文案 |
| 删除死控件 `#curveSel` | 成立 | 全仓 grep 无引用 |
| 辅助文字 ≥11 px，全站不缩到 9–10 px | **不成立** | `sim/js/chart.js:29` `ctx.font='10.5px …'`（坐标轴刻度）、`sim/js/formation-inset.js:89` `ctx.font='10.5px Consolas'`。canvas 自绘文字不在 DOM 里，而该行的证据写的是「三视口最小字号实测 11 px」= computed style 量法，**方法本身量不到这两处**。`phase-05-review.md` C3 已点名并要求「运行时再核」，复核文件里「运行时取证」章节仍是 `（待填）` |
| 三星颜色在三维模型/标签/列表/图例/曲线统一 | **不成立** | `sim/js/formation-inset.js:5` `const COLORS = ['#7fe3d6','#6fa8dc','#e8a33d']`（旧调色板）与 `sim/js/panels.js:6` `SAT_COLORS=['#38a9ff','#29d7d0','#ffb83f']` 并存；编队局部放大窗的三个点仍是旧三色。`phase-05-review.md` C2 已判为「C2 的直接破口」。另 `StarTM/web/modules/sat-model.js:51` 选中环 `0x7fe3d6` 是第三套字面值 |
| 五标签字段映射/切标签不动相机（等 Phase 2 各行） | 证据偏弱 | 证据列写的是 `phase-02-test.md` 的行文；该文件由实现方自己写的 harness 生成，属**自我认证型证据**。我核对了 harness 的抓取表达式（`outputs/cdp-check/blocks/phase02_block.txt`）确为 DOM 实抓，不是手写数字，故降为「可信但非独立」 |
| 面板开关/全屏等尺寸变化触发 Three.js resize | **口径不成立** | 同一行状态写 PASS，证据列却写「全屏被 CDP 环境拒绝…真实全屏未验证」。§6.2 要求 NOT-TESTED 不得并入 PASS；该行应拆成两行 |
| 未使用硬编码数值伪装 | 结论成立/证据是文案 | 证据列写「独立复审查证」= 引用一份审查的说法，不是产物。我的独立查证（T2）恰好支持该结论，但**证据形式**不合格 |
| 保存/加载/导出各行 | 部分成立 | 我只静态读到 `sim/js/main.js` 的导出/校验分支与 `panels.js:487-490` 的「未 attached 时提示无内容」，未做浏览器实跑；不判 PASS 也不判 FAIL |

> 关于截图（已核，结论与我最初的怀疑相反）：我对跨阶段被引用的截图做了整文件 MD5 比对——
> `phase-02/tab-formation.png` vs `phase-04/01-1792-drawer.png`、`phase-02/tab-formation.png` vs `phase-05/13-1792-visual-formation.png`、
> `phase-02/tab-attitude.png` vs `phase-05/14-1792-visual-attitude.png`、`phase-02/06-1792-follow.png` vs `phase-05/06-1792-follow.png`、
> `phase-02/04-1366x768-overview.png` vs `phase-05/11-1366x768-visual.png` 五对**全部不同**（大小/MD5 都不一致），
> 所以「同一张图改个名当多条证据」这一条我不指控（前缀 64 KB 相同只是暗色 UI 压缩流巧合，已排除）。
> 但发现一处证据定位错误：§1 门禁与 §2「三档取景」行都引用 `06-1792-follow.png` 作为 Phase 1 的出图证据，
> 而 `screenshots/phase-01/` 里**没有这个文件**（它只存在于 phase-02/03/05/06 目录）；`screenshots/phase-05/10-1792x864-visual.png`、
> `screenshots/phase-02/tab-formation.png` 存在，可核对。另：矩阵引用截图时一律不带阶段目录名，复核者要靠猜去哪个文件夹找。

## T2 — 硬编码伪装排查（PASS）

独立取证（不采信任何实现方文案）：

- `sim-data/render/columns.f32`（16 070 586 个 f32）按 manifest 的 offset/perSat 取列：
  `power.gen_power / platform_power / payload_power / accum_energy / battery_margin`、
  `thermal.ext_heatflux / equip_power / temp_main / over_limit_count` —— 每列 259203 点，**finite 计数 = 0**（全 NaN）。
- `sim-data/preview/power.csv`、`thermal.csv`：表头注释即写「未计算」，4323 行里对应列**非空计数 = 0**。
- `power.battery_soc_pct` 在 manifest 66 列里不存在（我按 `(file,field)` 字典逐列查过），界面按 `missingField` 走「字段未提供」——与矩阵一致。
- 代码侧注入排查：对 `sim/js/*.js`、`StarTM/web/app.js`、`modules/ui/tooltip-system.js` 全量 grep `?? 数字` / `|| 数字` 兜底，命中的只有 `devicePixelRatio || 1`、`getStepSec() || 1`、`scale || 1`、`Number(r.duration_s) || 0` 这类**分母/单位保护**，没有任何一处给 SOC/功率/温度填演示值。
  `sim/js/panels.js:352-359`（电池 SOC/发电/用电/关键温度）与 `:736-737`（左栏卡片 SOC）全部是 `isVoid(v) ? v : 格式化`，即缺值只走文案；`sumOf()`（`:117-126`）明确「任一列缺值即整体不可得，不拿 0 顶」。
- 对 `phase-0*.diff` 的新增行做了数值字面量筛查（关键词 soc/temp/power/heat/gen_power/battery/margin + 数字），命中的新增数字全部是 CSS 尺寸（px/rgba/.45）与相机距离常量（`phase-01.diff:188` 的 113.0/153.2 是地球取景距离，不是卫星状态读数），**没有注入到数据读数的常量**。

## T3 — 字段绑定正确性（PARTIAL：代码级+数据级成立，运行时实跑未取得）

我选的 5 条读数与独立地面真值（`columns.f32` f32，perSat 下标 = offset + (sat−1)·86401 + epoch；preview 行下标 = epoch/60，实测 `preview/orbit_itrf.csv` 第 5 行 rel_s=300、第 720 行 rel_s=43200，与 `epFor()` 的换算一致）：

| 读数 | 数据列 | T+00:05:00 (ep=300) 真值 | T+12:00:00 (ep=43200) 真值 | 界面应显示 |
|---|---|---|---|---|
| 半长轴 a | `orbit_itrf.sma`（preview 60 s） | 6976.22309 | 6976.46421 | 6976.22 / 6976.46 km |
| 相对位置 R | `formation_rtn.R` | −0.453818961 | −0.486617896 | −0.454 / −0.487 km |
| 四元数 w | `attitude.q_j2b_w` | 0.591225 | 0.635400 | 0.59 / 0.64 |
| 斜距 | `ground_obs.range` | 8478.297 | 8992.746 | 8478 / 8993 km |
| 边长 1–2 | `formation_geom.edge_12`（×1000 → m） | 1035.852 | 940.968 | 1036 / 941 m |

- `epFor()` 修复在代码里**成立且被普遍使用**：`sim/js/panels.js:106` 对非 binary 条目把全局历元换算成该数据源行号；图表路径 `:518/:548` 传 `local=true`，改为按 `stepOf(e)`（由 `lastRelS/(nEpoch−1)` 推得 60 s）自行取行，两条路径互不混用。按这两个时刻计算，索引命中 rel_s=300 与 rel_s=43200 行，**不是** 60 倍错位。这也顺带证实 `REMAINING_BLOCKERS.md` D4 的描述与数据一致。
- 未取得的部分：我用 CDP 起了一次真实 Chrome 做 DOM 实抓（脚本 `outputs/scratch-final/runtime_check.py`），第一次因页面尚未完成模块加载就点「加载示例」而全 NULL；第二次修好等待顺序后，页面停在 `attached=false / mode='ws'`（iframe 未落到 csv 模式），面板未初始化，300 s 内没有出读数。**因此「界面显示的数字 = 数据列真值」这条我没能用运行时证据闭环**，最多给 PARTIAL。
- 顺带发现（不属实现方过错但矩阵文案偏乐观）：`sun_eclipse.array_incidence_deg` 与 `incidence_deg` 在两个时刻取值完全相同（86.27342 / 86.55194），`DATA_FIELD_MAPPING.md` 把它们列为「对载荷轴 +Z_B」与「对太阳翼法向」两个不同测点，实际数据是同一列的复制。

## T4 — 单位一致性（PASS）

- `sim/config/panels.json`：`edge_12/23/31` 在「① 地面显示图形」里 `"unit":"m", "scale":1000`；`sim/js/panels.js:324` 用 `read(...,1000)` 得到米，`:330-334` 构型偏差 = |米值 − 米制标称|，标称由 `:767` `nominal = v * (spec.scale||1)` 存成米；阈值 `edgeToleranceM=10`（米）。**量纲闭合**。
- 同一批数据在「三组距离」表里用 `scale=1` 并标 km（`:375-378`），在「平均星间距」KPI 里也用 `scale=1` 标 km（`:326-328,341`）——即 km 只按 km 显示，**没有出现把 km×1000 再标成 km 的上一轮阻塞项**。`chEdge` 图表 `unit:"m" + scale:1000`（`display.json`），与 `bandLabel 「允许 ±10 m（对初始构型）」` 一致。
- 角度：`rot_phase_TM0S1` / `az` / `el` / `incidence_deg` 全部 `scale` 省略（=1）、单位 deg，未见换算；`chOrbit` 用 `shift:-6378.137` 把 a(km) 转高度(km)，与 `orbitAt()` 里 `r.a - 6378.137` 同一常数、同为 km。
- 文案瑕疵（不影响数值）：`DATA_FIELD_MAPPING.md` 把 `formation_geom.edge_*` 的单位直接写成 m，而源列本身是 km（界面靠 `scale=1000` 换算）；表格若不加「界面按 ×1000 显示为 m」的说明，读者会以为源数据就是米。

## T5 — 状态口径诚实性（FAIL）

按 §6.2「BLOCKED / NOT-TESTED 一律不写成 PASS」逐条对照，发现 4 处口径破口：

1. `#btnFull` 全屏 resize：矩阵行状态是 **PASS**，同行证据却写「全屏被 CDP 环境拒绝（`Permissions check failed`），真实全屏未验证」，`REMAINING_BLOCKERS.md` 也记为 **NOT-TESTED**。同一行既是 PASS 又是 NOT-TESTED = 违规。（面板开合部分是真的，需要拆行。）
2. §5「端到端 12 项全部实跑通过」：与同文档 NOT-TESTED（全屏）、以及 `REMAINING_BLOCKERS.md` R2「强制 `location.reload()` 后仍需再点一次『重新加载』才恢复，该恢复路径未做成门禁」直接冲突。「桥接…重新加载」在 §5 被列为全部实跑通过项之一，属把未闭环路径写成通过。
3. 门禁时序：§1 自己写着 Phase 4 `phase-04-review.md`（进行中）、Phase 5（进行中）、Phase 6（待复审结论），Phase 3 甚至没有独立审查文件（写的是「并入 Phase 2/5 复审」）。而 §2 已经把 Phase 3/4/5 的十几条写成 PASS。§1 的「审查门禁」要求阶段先过审再进下一阶段，此处是先发结论后补审查。
4. `phase-05-review.md` 本身仍是半成品：结论行写「待运行时取证后填写」，「运行时取证 / 新发现的缺陷 / 未能验证的项」三节全是 `（待填）`，而它静态部分已经点出 2 个真缺陷（旧调色板、10.5 px）。用它来支撑 Phase 5 的 PASS 行，证据链不成立。

诚实的地方也要记下来：能源/热控确实写的是 **BLOCKED-DATA**、`#btnApply`（应用并重新运行）写的是 **BLOCKED-MODEL** 且代码里 `#btnApply` 恒 `disabled`（`sim/index.html:623`），`REMAINING_BLOCKERS.md` 还留了一节 FAIL（F1 三维本体按状态着色）没有粉饰。问题集中在 Phase 5 的两行与两处口径混用，不是全面造假。

## T6 — 范围纪律（PASS）

- `git status --short`：已跟踪改动 16 个文件，全部落在 `sim/`（index.html、js/{main,panels,chart,loader,store}.js、config/{display,panels}.json）与 `StarTM/web/`（app.js、core/{app-context,scene-utils}.js、managers/playback-manager.js、modules/{config,sat-model}.js、modules/ui/tooltip-system.js、modules/views/third-person.js）；新增未跟踪只有 `sim/js/scene-io.js`、`sim/js/formation-inset.js` 两个前端文件。**没有** `server/`、`core/`（Python）、`propagators/`、`protocol/`、`db/`、`main_fastapi.py` 的改动。
- 仿真数据未被触碰：`find sim-data -newermt 2026-10-14` 返回空（数据文件最后修改都早于本轮工作）。注意 `sim-data/` 本身**不在 git 版本控制里**（`git ls-files sim-data` = 0 条），所以「git 里没有数据改动」这条证据对数据文件是无效的，必须像这样按 mtime 查——查完是干净的。
- `StarTM/sim.db` 是未跟踪文件，但 mtime = 10 月 9 日，早于本轮，属既有运行产物，不是本轮引入。
- 文档/快照：`docs/ui-implementation/`（含 diff 快照与截图）、`outputs/` 属允许范围。

## T7 — 死控件与假成功（PARTIAL，实跑未取得）

- 静态可确认的「诚实禁用」：`#btnApply`（应用并重新运行）、`#obsLat/#obsLon/#btnObs`、`#btnSave`、`#btnExport` 全部带 `disabled` 与解释性 title（`sim/index.html:435-438,554,623`），点不动但有理由 —— 属 §6.2 的正确处理，不算死控件。
- `#curveSel` 死控件已删（全仓无引用），`REMAINING_BLOCKERS.md` 明确把 V0.3 §7.4 的轨迹/曲线视图切换记为「未实现（按指令删除伪控件）」而不是 PASS —— 口径诚实。
- 时钟与读数同步：`sim/js/panels.js:716` 读数历元 = `floor(simSeconds/stepSec)`，`main.js:94` 同一式；`state.simSeconds` 的写入集中在 `store.js` 的 patch，未见第二路时钟。
- **未能实跑**：相机下拉 vs 实际视角、图层勾选 vs 场景、toast 文案 vs 实际动作（保存/导出是否真落盘）这三项需要浏览器实测；本轮两次 CDP 尝试都没能进入 attached 状态，因此不能签字。
- 我自己踩到的实现侧线索（供返工参考，不判缺陷）：`sim/js/main.js:18-20` 的 `detachForTest()` 与 `window.__simui` 是为验收探针加的暴露口，注释说明「只暴露已有读数」；`__simui` 挂在 window 上属于测试专用面，交付前是否保留需产品决定。

---

## 过度声明清单（矩阵行 → 证据实际显示什么）

1. 「辅助文字 ≥11 px，全站不缩到 9–10 px」→ 实为 DOM 最小 11 px，但 `chart.js:29` 与 `formation-inset.js:89` 的 canvas 刻度文字是 **10.5 px**；取证方法与证据对象不匹配（computed style 量不到 canvas）。
2. 「三星颜色在三维模型/标签/列表/图例/曲线统一」→ `formation-inset.js:5` 仍是旧三色 `#7fe3d6/#6fa8dc/#e8a33d`，编队小窗的三点与工作台的 `38a9ff/29d7d0/ffb83f` 不同一套；`sat-model.js:51` 选中环是第三套字面值。
3. 「面板开关/全屏等尺寸变化触发 Three.js resize = PASS」→ 同行证据自认全屏 NOT-TESTED；应拆行，全屏记 NOT-TESTED。
4. §5「端到端 12 项全部实跑通过」→ 内含 NOT-TESTED 的全屏与「未做成门禁」的 iframe 重载恢复路径（`REMAINING_BLOCKERS.md` R2），措辞应为「10 项实跑通过 + 2 项受限」。
5. 「未使用硬编码数值伪装 PASS｜独立复审查证」→ 证据是实现方自己写的审查文案；结论我另行独立证实为真，但矩阵应改列可复核产物（列有限值计数、grep 结果）。
6. §1 门禁表把 Phase 4/5/6 标为「进行中/待复审结论」，同时 §2 已给这些阶段发 PASS；Phase 3 无独立审查文件 → 门禁与结论先后倒置。
7. 「89.5% 带外红点定性 PASS（结论：数据事实）」→ 该项在 `REMAINING_BLOCKERS.md` 末段仍是「需要数据侧决策」的开放问题，且自述比例（矩阵 92.5/88.0/84.5 vs 阻塞清单 93.90）互相不一致；应记 PARTIAL/待定，不是 PASS。

## 剩余阻塞项（返工最小集）

- B1（真缺陷，小改）：`sim/js/formation-inset.js:5` 改用 `panels.js` 的 `SAT_COLORS` 或 CSS token；顺带把 `sat-model.js:51` 的 `0x7fe3d6` 收到 token。
- B2（真缺陷，小改）：`chart.js:29`、`formation-inset.js:89` 的 canvas 字号提到 ≥11 px，并把这条取证改成「canvas 自绘文字实测」。
- B3（口径）：把「面板开关/全屏 resize」拆成两行；§5 端到端改成逐项状态表（含 NOT-TESTED 的两项），别再用「全部实跑通过」。
- B4（证据）：为「未使用硬编码数值伪装」补可复核产物（power/thermal 列 finite 计数 + grep 记录），并给 T3 的运行时对账补一次干净实跑（两个时刻、五条读数），最好由独立 harness 落 JSON 留证。
- B5（流程）：补 `phase-03-review.md`，把 `phase-04/05/06` 的审查从「进行中/待填」写完结论；门禁表与 §2 状态必须同源。
- B6（一致性）：矩阵与阻塞清单的越限比例数字统一，并把构型抖动定性退回「待数据侧确认」。

## 取证脚本与产物（本轮自建，可复跑）

- `outputs/scratch-final/runtime_check.py`、`runtime-scrape.json`（两次实跑未取得读数，原因：页面未进 csv 模式）
- `outputs/scratch-final/data-truth.txt`（列有限值计数、f32/preview 地面真值表）

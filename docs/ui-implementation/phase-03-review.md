# Phase 3 独立审查（第一轮 · 全量重新取证）

- 审查者：独立审查子代理（只读；未修改任何实现文件，本轮只新增本文件）
- 日期：2026-10-16｜分支 `sim-system`｜HEAD `a8f7841`
- 依据：`Basedoc/UI设计V2/天幕卫星仿真系统_前端自主改造全流程指令.md` §Phase 3（L153-176：3.1 时间轴 L155-160、3.2 事件 L162-166、3.3 地面观察 L168-173、3.4 验收 L175-176）；V0.3 §5（L280-366）、§7（L485-531）、§8（L535-549）、§11（L612-661）、§12（L665-716）
- 被审文件与哈希（本轮取证口径）：

```
sim/js/main.js                    c1857a7ef34c0af7  25671 B  546 行
sim/js/panels.js                  f8a293d41e199c40  42762 B  795 行
sim/js/store.js                   efe7a168ae0e37b5    853 B   17 行
sim/js/loader.js                  2e66dcf2dca7b206   5513 B  137 行
sim/js/formation-inset.js         e67733ac3acfccc1   5020 B  109 行
sim/index.html                    e01bbae02b1f11d9  43353 B  652 行
StarTM/web/managers/playback-manager.js f832f73e7beb8952 68164 B 1366 行
StarTM/web/app.js                 71dbae1a9d39b806  22714 B  487 行
outputs/cdp-check/harness.py      d2e4ce8ce4f81547  95838 B 1396 行  (mtime 10-16 09:07:47)
```

- **环境披露**：按用户硬性约束，本轮**未打开浏览器、未做任何 CDP 操作**（唯一验收台被另一进程占用）。所有运行时数字都来自三条独立路径：①直接解析 `sim-data/render/columns.f32` + `manifest.json`；②直接解析 `sim-data/preview/*.csv` 与 `events.csv`；③读取已归档截图 `docs/ui-implementation/screenshots/phase-03/09-1792-ground.png` 的像素。`harness.py` 在我取证期间被另一进程改写（94474 B → 95838 B），本文引用的 harness 行号以 95838 B 版本为准，可能继续漂移。

## 结论

**有条件 PASS —— 允许进入 Phase 4，但 D1/D2/D3 必须在 Phase 4 复审前补掉。**

Phase 3 的三条硬骨头是真的：单一权威时钟成立（`simSeconds` 只有 4 处写入、无第二份时间）、倍速档位 1/10/60 与代码读取路径一致（历史 2/8 错配不存在）、1 s 全量档与 60 s preview 档的索引换算我用两个历元逐位对过（N1 已修且双源都过）、能源/热控是诚实空态（`missingField` 与 `emptyValue` 分得开）。判「有条件」而不是 PASS 的原因：§3.3「点击表格中的卫星应高亮天空视图对应对象」在代码里根本没有实现路径（D2），§3.2「事件具有具体 sat_id 时同步选中该星」的断言在结构上不可能失败、两轮验收都没真正跑过它（D1）；另有一处相机共享导致的回归风险（D3）。

## 逐条验收表

| 规范条目 | 判定 | 证据（文件:行号 / 实测数值） | 备注 |
|---|---|---|---|
| 3.1 `state.simSeconds` 唯一权威时钟 | **PASS** | 定义 `store.js:6`；写入仅 `main.js:138,204,232,394`；`panels.js:722-732`、`formation-inset.js:48,66`、`chart` 游标 `panels.js:540` 全部接收参数不存副本 | 全仓 grep `isPlaying\|csvState\|currentTimeIdx` 在 `sim/` 下 0 命中 → 外层不靠内层播放态判断（3.1 末条） |
| 3.1 播放/暂停/倍率/回起点/单步/拖动/事件跳转同步 | **PARTIAL** | 三维：`main.js:120 bridge.setStep(idx)`；指标：`main.js:129 renderPanels`；游标：`panels.js:540 {cursor: simSeconds}`。推进按真实 dt：`main.js:204 st.simSeconds += st.rate*dt` | 代码路径闭合；Phase 3 断言块里**没有一条**比对三维侧是否跟着跳帧（见「无法独立核实」） |
| 3.1 切星/切视图/切相机/切标签不重置时间 | **PASS** | `selectSat panels.js:206-213`、`setView 219-230`、`setTab 232-246`、`setCameraMode main.js:151-157` 均不写 `simSeconds`；实测 `harness.py:411` 选星后仍 `T+12:00:00` | |
| 3.1 T+ 与 UTC 明确、不混本地时间 | **PASS** | 顶栏标签「仿真时刻 (UTC)」`index.html`；`fmtUtc main.js:28-32`；t0=2026-09-13 04:00:00 由 events.csv 反推：17756 s→`2026-09-13 08:55:56`、60000 s→`20:40:00` 与测试记录 L84 一致 | 断言名过声明：`harness.py:726` 名为「T+/步数/UTC 三者自洽」，`utc` 字段只 `say` 不比较（D7） |
| 3.2 只用真实 events.csv，不凭空加地影 | **PASS** | `preview/events.csv` 1314 行，类别只有 点亮648/熄灭647/可见区间9/转向3/显示任务3/恢复3/控制1，**无地影类**；`meta.json eclipse_samples=0` | 轴上 13 个标记 = 3可见区间+3转向+3显示任务+3恢复+1控制，与 `display.json timelineEventSkip=["点亮","熄灭"]` 逐条对上（测试记录 L75 evCount=13 ✓） |
| 3.2 形状+颜色区分并有图例 | **PASS** | `index.html:374-398`（`.ev.window/.maneuver/.task/.eclipse/.other` + `.legend .shp*`）；图例只列实际出现的类别 `panels.js:625-640` | |
| 3.2 点事件跳 `t_actual`；带 sat_id 同步选星；ALL 不猜 | **FAIL**（证据无效） | 跳转值对：`main.js:419-421 seekSeconds(sec)`，sec=17756 → T+04:55:56 ✓（我按 events.csv 独立算得）。但「选中该星」从未被证伪：见 D1 | `harness.py:700-703` + `panels.js:594` 构成恒真式 |
| 3.2 轨迹/曲线视图切换真实工作或删除伪控件 | **PASS** | `#curveSel` 已从 `index.html` 消失（grep 0 命中），改由右栏曲线区 + 点击定位 `panels.js:463 onPick→hooks.onSeek` | 按 §3.2「或删除暂时无法实现的控件」口径放行；IMPLEMENTATION_LOG L184 已如实记未实现 |
| 3.3 独立天空视图/地平线/卫星标记/az-el 表 | **PARTIAL** | 表：`panels.js:435-451`，截图 09 三行读数 54.0/21.2/1359、54.1/21.1/1359、54.1/21.2/1359；我读 `columns.f32` ground_obs@ep18000 得 az 54.028/54.060/54.074、el 21.161/21.128/21.163、range 1358.750/1359.105/1358.526 → **逐位吻合** | 天空视图内三颗星是否真的画出来：本轮无法判定（见「无法独立核实」2） |
| 3.3 不能只挪相机却让读数用旧站址 | **PASS** | 选择「禁用」这条合规路径：`index.html:555-557` 三个 `disabled`；说明文案含「当前结果使用固定观察站」 | 站址重算确实没做，理由记录在 IMPLEMENTATION_LOG L164-166，与总指令 §3.3 第二分支一致 |
| 3.3 点表格行高亮天空视图对应对象 | **FAIL** | `selectSat → main.js:334 bridge.selectSat` → `playback-manager.js:1195-1198` 只设 `selectedSatIdx` + `updateThirdPersonDecor`；全仓 `selectedSatIdx` 消费点仅 `third-person.js:74`，`first-person.js` 内 grep `select` 0 命中 → 地面观察下无任何高亮 | D2 |
| 3.3 拖时间轴同步更新方位/仰角 | **PASS** | ep60000 el −6.81/−6.80/−6.81 vs ep18000 21.16/21.13/21.16，与测试记录 L84 两组读数一致 | 断言本身只比 `!=`（弱），数值由我独立复核 |
| 3.3 5 倍张角放大须标局部放大/非同尺度 | **PASS** | `first-person.js:210,464 FORMATION_SCALE = 5`；`#tabGround .note` 文案含「放大了 5 倍…局部放大 · 非同尺度」 | |
| 5.5 目标跟随每帧更新 `controls.target` | **PASS** | `chaseThirdPerson playback-manager.js:104-111`：`controls.target.copy(m.position)` + `camera.position.copy(m.position).add(outward)`；调用链 `applyDrive:94-101` ← `playbackLoop:263`（third + externalMode 每帧）与 `setStep:1330` | 实测 ctrlToSat=0、camToSat=18.03（测试记录 L52-53）；但 `m.visible` 为假时静默停更（L107） |
| 7.1 倍速档位与代码读取一致 | **PASS** | `index.html:581-583 data-rate="1/10/60"`；`main.js:379-381` 读 `dataset.rate` 同时写 store 与 `bridge.setRate`；phase-06 实测 `{"kv":"60×","st":60}` | 历史「按钮 1/10/60 而代码找 2/8」的错配在当前代码里不存在 |
| 真实数据纪律（用户红线） | **PASS** | 见「我独立复核了什么」§A/B/C 全部对账；Phase 3 界面出现的数（az/el/range/sun_alt/边长/偏差/事件时刻）都能追到 `render/columns.f32` 或 `preview/*.csv` | |
| 能源·热控诚实空态（六态） | **PASS** | `panels.js:98-113` 六态齐；`battery_soc_pct` 不在 manifest 的 power 5 列（gen/platform/payload/accum/margin）→「字段未提供」`missingField`；`temp_main` 列在但全空 →「暂无数据」`emptyValue`；`display.json notComputed` 7 项 → `notCalculated` | 截图 09 左栏「SOC 字段未提供 / 温度 暂无数据」正是两种不同的空 |
| 流程：每阶段须有 `phase-XX-review.md` | **FAIL**（已由本文件补） | `FINAL_ACCEPTANCE.md:15` 把 Phase 3 审查写成「并入 Phase 2/5 复审 / 通过」，交付清单上并无 Phase 3 独立审查记录 | D8 |

## 缺陷清单（按严重度）

**D1（高）「事件带 sat_id → 同步选中该星」的断言恒真，该条款零证据。**
`panels.js:594` 把 `可见区间` 事件过滤成「只画当前选中星」，而 `events.csv` 里唯一带具体星号的类别就是 `可见区间`（sat_id=ALL 1305 行 / TM0S1-3 各 3 行）。于是 `harness.py:694` 取到的第一个 `data-sat` 标记**必然**属于当前选中星，`harness.py:700-701` 的 `after.sat == 'TM0S%d' % satEv.sat` 结构上不可能失败——测试记录 L80 的 before/after 都是 `TM0S2` 就是证据。Phase 6 的同一条（`harness.py:1331`）写成 `aft['sat'].startswith('TM0S')`，更是恒真。
期望：从**另一颗星**出发点一个属于别颗星的标记，断言 `before.sat != after.sat`。
建议修法：去掉 `panels.js:594` 的选中星过滤（三星 `可见区间` 全画，用图例区分），harness 里先 `selectSat(1)` 再点击 `data-sat="3"` 的标记并断言 `kvSat` 变为 `TM0S3`；同时把 `harness.py:698` 已经采集但没人用的 `want` 用于比对 `data-sec` → `T+hh:mm:ss`。

**D2（高）§3.3「点表格行高亮天空视图对应对象」未实现。** 见验收表对应行。
期望：地面观察下选中星在天空视图里有可辨的选中态。
建议修法：在 `first-person.js` 的 `satelliteMeshes1D`（L129-139、213、466）上按 `sceneObjects.selectedSatIdx` 加选中态（尺寸/环/标签三选一，颜色不单独承担语义），或按 §3.2 的口径显式记「未实现」并把它挪进 `REMAINING_BLOCKERS.md`——不能继续记 PASS。

**D3（中）`follow(null)` 无条件把共享相机拽回全景机位，地面观察下无自愈路径。**
`playback-manager.js:1200-1206`：任何 `follow(null)` 都执行 `controls.target.set(0,0,0)` + `camera.position.copy(THIRD_PERSON_CAMERA_POS)`；`config.js:14` 该常量 = `(105, 37.5, 105)`，模 153.2。全场景共用一个 camera（`app-context.js:10,46`，`app.js` 无 per-view 相机）。`main.js:163` 进地面观察的顺序是 `setView('first')` → `follow(null)`，于是刚被 `updateFirstPersonCamera`（`first-person.js:172-173`，`camera.position.set(0,0,0)`）放回站心的相机又被拉到 153.2 单位外；而 `animate()`（`app.js:73-101`）每帧只在 `view==='third'` 时 `controls.update()`，first 视角没有每帧复位。center 视角能自愈（`playbackLoop:267` 每帧 `updateCenterPersonCamera`），first 不能。同理 `btnDaylight`（`main.js:427` → `frameDaylight` L1236）在地面观察下未禁用，点一下同样拽走站心相机。
期望：`follow(null)` 只在全景/跟随之间切换时动相机。
建议修法：`follow()` 内加 `if (appState.currentView !== 'third') return;`（复位分支保留在 `setView('third')` 之后），并把 `btnDaylight` 在 `view==='ground'` 时一并禁用。需一次浏览器实测 `__probe().cam` 定量确认后果。

**D4（中）索引换算靠「两个 stepSec 恰好都等于 1」的巧合，且三处换算仍用全局步长。**
`panels.js:106` 对 binary 源**绕过** `epFor`，直接用 1 s 历元当 binary 行号；binary 侧的 `manifest.stepSec=1`（我读到）与桥的 `stepIntervalSec=1`（`sim-data/projection/orbit_14col.csv` 逐秒，259203 行）今天相等，所以数值正确。但仓库里就躺着 60 s 档 `sim-data/preview/orbit_14col_60s.csv`：一旦桥改吃 60 s 星历，`getStepSec()` 变 60，全部 binary 读数（ground_obs/attitude/power/thermal/sun_eclipse/formation_geom）会 60 倍错位，且没有任何断言或校验会报警——这正是 N1 的反向版本。同类：`runsOf panels.js:576,582`、`nextWindow 315-317`、`exportRows 675,714` 用 `getStepSec()` 把行号换算成秒，而不是该文件自己的 `stepOf(e)`；这些文件（ground_obs、display）目前恰好在 binary 清单里所以不出错，回落到 preview 就全错。
建议修法：binary 也走 `epFor`（两值相等时是恒等变换，白拿一层保护）；`runsOf/nextWindow/exportRows` 改用 `stepOf(e)`；启动时 `getStepSec() !== manifest.stepSec` 直接 `onMissing` 报「时间基不一致」。

**D5（中）轨道页的星身份映射依赖文件出现顺序，桥还把 `sat_id` 丢了。**
`panels.js:135-141 orbitAt(sat, epoch, field)` 取 `rows[sat-1]`，从不校验 `r.sat_id`；`playback-manager.js:1133-1137` 的 `orbitAt` 只 `map(s => ({a,Vx,Vy,Vz}))`，把 `sat_id` 抹掉了；`csv-manager.js:139-140` 的 `grouped[ts].push(sat)` 按文件顺序入组。我扫过 `orbit_14col.csv`：259203 行、`sat_id` 只有 3 次跳变（0→1、86401→2、172802→3），即三个连续星块且升序，所以今天没错。但这就是「切换标签把另一颗星的值写进当前表」的结构性入口：数据一旦改成历元主序、或某颗星缺行，轨道高度/速度会静默串到别的星上，界面不会有任何异常。
建议修法：桥的 `orbitAt` 返回 `sat_id`，panels 按 id 找行、找不到就返回 `missingField`。

**D6（轻）`bridge &&` 守卫在这里是「吞功能」而不是兜底。**
`main.js:151-157 setCameraMode`：先 `patch({cameraMode: mode})` 再 `if (bridge) apply()`，桥为 null（iframe 重载窗口，`main.js:533-543`）时 store 与 `#camSel` 都显示「目标跟随」，三维毫无动作也不提示；`main.js:335` 的 `if (... && bridge) bridge.follow(...)` 同样静默跳过。对照：`btnReset/btnZoomIn/btnZoomOut/btnDaylight` 走 `setSceneButtons()`（L17-19）会真禁用——相机下拉没有同等处理。
建议修法：`setCameraMode/setPageView` 在 `!bridge` 时回滚 patch 或把 `#camSel` 一并禁用并给 title。

**D7（轻）断言可失败性问题（除 D1 外）。** `harness.py:400`「播放推进」用实现自己写的文案子串 `"运行中" in r1` 匹配自己（`main.js:218` 产出同一字符串）；`harness.py:726` 名字含 UTC 却不比较 `clk[*]['utc']`；`harness.py:727` 只断言两组仰角 `!=`，写成 `['—','—','—']` 也能过。
建议修法：400 改成比较 `tplus` 秒数增量 ∈ [2,4]；726 加 `clk['a']['utc']=='2026-09-13 20:40:00'`；727 改成与 `columns.f32` 抽出的期望值逐位比（我已算好，可直接当基准）。

**D8（轻·流程）Phase 3 缺独立审查记录。** `FINAL_ACCEPTANCE.md:15` 以「并入 Phase 2/5 复审」替代总指令 §1 要求的 `phase-03-review.md`，属交付清单空洞；本文件补齐后，验收矩阵该行应改为引用本文件。

## 我独立复核了什么、怎么复核的

**A. 时间轴 → 数据索引（1 s 全量档）。** 用 `D:/anaconda/python.exe -X utf8` 直接 `np.fromfile('sim-data/render/columns.f32','<f4')`，按 `loader.js:115` 的 `i = c.offset + pos*nEpoch + epoch` 复算 ground_obs 三列（`manifest.json`：stepSec=1.0、nEpoch=86401、sats=[1,2,3]、66 列、8 个文件）：
ep18000 → az 54.028/54.060/54.074、el 21.161/21.128/21.163、range 1358.750/1359.105/1358.526、sun_alt 16.191；ep60000 → el −6.81/−6.80/−6.81。
对照 `phase-03-test.md:84`（21.2/21.1/21.2 与 −6.8/−6.8/−6.8）与截图 09 的表格/大字（54.0/21.2/1359、hero 54.03°/21.16°/1358.7 km/16.19°）→ **全部吻合**，界面没有第二个时间源、也没有插值伪装。

**B. N1 双源对账（60 s preview 档）。** `formation_geom.edge_12/23/31` @ep18000 = 1.104655/1.045884/1.042086 km（binary，1 s 档）；`preview/formation_rtn.csv`（1441 行、rel_s 0/60/18000，60 s 档）第 300 行按 `panels.js:492-503 epFor/stepOf` 的算法取 R/T/N 差后算边长得 1.105/1.046/1.042 km。两源一致，且与截图 09 小窗页脚「S12 1.105 · S23 1.046 · S31 1.042 km」一致 → **1 s 档与 60 s 档都过，N1 确认已修**（`formation-inset.js:11,19` 的 `peStep` 也是从数据里读的第 2 行 `rel_s`，不写死）。

**C. 事件与 KPI 对账。** `events.csv` 1314 行按类别/星号计数（点亮648/熄灭647/可见区间9/转向3/显示任务3/恢复3/控制1；ALL 1305）→ 应用 `display.json timelineEventSkip=["点亮","熄灭"]` 与 `panels.js:594` 的选中星过滤后恰为 13，等于 `evCount=13`。`t_actual` 反推 t0=2026-09-13 04:00:00，与 17756→T+04:55:56、60000→20:40:00 自洽。构型偏差：max|edge_i(18000)−edge_i(0)| = edge_23 的 66.6 m（另两条 37.8/18.5 m），> `edgeToleranceM=10` → 界面「构型偏差 66.6 m」+ 顶栏「超限 1 项」均为真值。

**D. 六态与色值。** `manifest.json` 的 power 只有 5 列、无 `battery_soc_pct` → `hasField` 判 `missingField`；thermal 有 `temp_main` 列 → 走 `emptyValue`；两者在界面上文案不同（字段未提供 / 暂无数据），未出现写死数值。身份色 `panels.js:6 SAT_COLORS` 与测试记录 L29-30 的轨迹三色 `38a9ff/29d7d0/ffb83f` 同源。

**E. 断言审计。** 逐行读 `harness.py` 的 phase-03 块（L670-741）与共享块（L400-411），把每条 `check` 的判据写成「什么输入能让它失败」——D1/D7 就是这么找出来的。

## 无法独立核实（需随后浏览器实测）

1. **D3 的视觉后果**：进地面观察后 `bridge.__probe().cam` 是否真为 `[105,37.5,105]`（期望 `[0,0,0]`）。代码路径确定，像素上我判不出来。
2. **天空视图里三颗星画没画出来**：对截图 09 的场景矩形（x 345-1380, y 60-712）做像素扫描，身份色命中 0（唯一命中的是图层卡图例 x≈363-373）、纯绿/纯红/纯黄命中 0。但 75° FOV 下 az 54°/el 21° 可能本就出画，且材质受光照调暗 → **不能据此判 FAIL**。V0.3 §8 还要求天空视图有「卫星标签」与「卫星的时间轨迹」，`first-person.js` 内 grep `Sprite|Label|trail` 0 命中，倾向未实现，需运行时确认。
3. **「播放/拖动同步更新三维场景」的三维侧**：Phase 3 断言块一条都没测三维帧号，我只静态确认 `main.js:120 setStep`。建议补 `bridge.__probe().getStep` 与 `kvStep` 对账。
4. **曲线游标随拖动移动**的运行时证据（Phase 2 块只断言了窗口跨度 `harness.py` 的 3000≤span≤4300）。
5. **跟随在播放中每帧跟手**：`chaseThirdPerson` 每帧调用已由代码证实，但「播放 60× 时 target 不脱靶」没有断言（现有 ctrlToSat 断言是静止单点）。
6. **地球自转与倍率**：`bridge.resume()` → `startCsvPlayback`（`playback-manager.js:132`）会按内层 `#speed` 重算 `earthRotationState.speedFactor`，覆盖 `setRate`（L1333-1337）设的值，暂停再播放后地球自转与仿真时间倍率可能脱钩。属 Phase 1 光照/自转语义，未实测，登记待查。

## 复审放行条件（最小集）

1. D1：补一条**从不同星出发**的事件选星断言并让它先失败再修好；同时把 `want`/`data-sec` 纳入比较。
2. D2：天空视图选中态落地，或改判 FAIL 并写入 `REMAINING_BLOCKERS.md`、把 `FINAL_ACCEPTANCE.md:57` 那行的 PASS 改掉。
3. D3：`follow(null)` 加视角守卫 + 地面观察禁用 `btnDaylight`，附 `__probe().cam` 实测值。
4. D4/D5：binary 走 `epFor`、三处 `getStepSec()` 改 `stepOf(e)`、`orbitAt` 回传 `sat_id`（各 ≤5 行，可一并做）。
5. D7/D8：断言名与判据对齐；`FINAL_ACCEPTANCE.md:15` 的「并入 Phase 2/5 复审」改为引用本文件。

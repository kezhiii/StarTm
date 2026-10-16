# 最终验收矩阵

执行依据：`Basedoc/UI设计V2/天幕卫星仿真系统_前端自主改造全流程指令.md`（Phase 0–6）
需求依据：`Basedoc/天幕卫星仿真系统软件需求_V0.2.md`、`Basedoc/UI设计V2/天幕卫星仿真系统_前端逐组件改造指令_V0.3.md`
基线：分支 `sim-system`，HEAD `a8f7841`（`sim: 按前端交互设计方案重排界面（P0 阶段）`；此前本节误写为 `61841a7`，那是它下面第三条提交）；阶段一骨架保留、`a8f7841` 未回退、`1c4d60f` 的桥接能力保留。本轮全部改动仍在工作区，**未提交**。
状态口径（§6.2）：`PASS` 有真实截图/测试/代码证据 · `BLOCKED-DATA` 数据缺失但空态正确 · `BLOCKED-MODEL` 引擎未接通 · `BLOCKED-EXTERNAL` 外部接口未接入 · `FAIL` 不符合要求 · `NOT-TESTED` 没有实际验证。**BLOCKED 一律不写成 PASS。**

## 1. 阶段门禁

**冻结树后的权威一轮**：2026-10-16 05:03–05:11 UTC（本地 13:03–13:11），六个阶段**串行**跑、无并发，
断言计数 01=58、02=92、03=74、04=91、05=92、06=78，合计 **485 条断言、0 条 FAIL**；
截图与逐项记录重写进 `phase-0*-test.md` 与 `screenshots/phase-0*/`。
末轮之后核对过：`grep -c '^PASS' phase-0[1-6]-test.md` 逐份为 58/92/74/91/92/78，与本表一致；
残留 Chrome 中带 `--remote-debugging-port` 的进程数为 **0**（验收台已注册 atexit 收整棵进程树，用户自己的浏览器未被波及）。
计数口径说明：此前写的 363 是**漏计**——`say()` 用 `ascii()` 转义，遇到含单引号的行会加双引号包裹，
使行首变成 `"PASS …`，`grep '^PASS'` 匹配不到（最终审查第 2 轮抓到）。已改为 `unicode_escape`（不加包裹引号）。
更早的几轮（11:21–11:29 的 363 口径、12:23–12:30 的 484、以及各审查代理的独立复跑）产物均保留，未被丢弃。
实现文件最后一次改动是 04:55 UTC（`playback-manager.js` 的跟随相机即时驱动），**其后再未改动任何实现文件**。

| 阶段 | 测试记录 | 独立审查 | 审查结论 | 返工 |
|---|---|---|---|---|
| Phase 0 基线与探针 | `phase-00-test.md` | `phase-00-review.md` | 通过 | — |
| Phase 1 三维取景 | `phase-01-test.md` | `phase-01-review.md`（R1 + R2 两轮） | R1 不通过（B1/B2/H1–H4）；R2 门禁判「否」，列 G1–G4 | G1/G2 已修；G3（断言与构造同义、fps 与 tabs 不判定）与 G4（日志越界否认）在第五轮补，见 §2b |
| Phase 2 右栏与曲线 | `phase-02-test.md`（0 FAIL） | `phase-02-review.md` + `phase-02-review-round2.md` | 第 1 轮不通过（1000 倍量级 + 截图同图）；第 2 轮两个阻塞项判为已修，另提 N1（60 s 数据源被按 1 s 下标索引）等 | 已修：见 §3 的 N1 行；本轮结束 0 FAIL |
| Phase 3 时间轴与地面观察 | `phase-03-test.md` | `phase-03-review.md`（第一轮，补交的独立审查）+ `phase-03-review-round2.md`（放行条件复核） | 第 1 轮：有条件 PASS，列 D1–D8；第 2 轮：D1/D2/D4/D5/D7 判已修，D3/D6 只算「代码改了、缺运行时证明」，另指出 D9（同刻事件标记重叠）、D10（插值播放路径仍按下标配对，D5 只修了一半）、D8（本行当时未引用审查文件） | D8 本行即为修正；D9/D10 与 D3/D6 的运行时断言已补进 `harness.py` 的 phase-03 段；D3 的两条断言在 Phase 6 轮次里进一步暴露出**暂停态选「跟随」相机不动**这个真缺陷（`follow()` 只设目标、机位靠每帧驱动），已补即时驱动。结果见本节表头计数 |
| Phase 4 配置/保存/加载/导出 | `phase-04-test.md` | `phase-04-review.md` + `phase-45-review-round4.md`（E1–E12） | 第 3 轮修 `utcg` 恒空与加载半截；第 4 轮指出 `skipped` 不上界面（E1）、坏文件断言没核对拒绝理由（E2）、时长 off-by-one（E4）等 | E1/E2/E4/E6/E7/E11 已改，并由末轮冻结树复跑确认（计数见本节表头） |
| Phase 5 视觉/响应式/性能 | `phase-05-test.md` | `phase-05-review.md` + `phase-45-review-round4.md` | 第 4 轮：颜色纪律、选中态、身份色单源判 PASS；字号审计有 iframe 盲区（E3）、轴色等 18 处 off-token（E10） | E3 已改（双 realm 记录器 + 贴图字反算），E10 记入遗留 |
| Phase 6 端到端 | `phase-06-test.md` | `phase-06-review.md`（补交的独立审查）+ `FINAL_REVIEW.md` + `FINAL_REVIEW_ROUND2.md` | Phase 6 审查判**有条件通过**：F1（`setStep` 计数在暂停态取样，「0→0」恒成立）、F2（§1 计数与产物不同源）、F3（§5 第 8/9 行证据串写 TM0S3 而实测 TM0S1）、F4–F8 | F1 改成「点一次单步必须恰好驱动一次」并双向可失败；F2 已按 484/冻结窗口重写 §1；F3/F4/F5/F7/F8 本轮已改；F6 的 60× 推进已加断言，「端到端回灌加载」如实记 NOT-TESTED。**F1 顺带挖出一个真缺陷**：暂停态选「目标跟随」时相机不动（`follow()` 只挂每帧驱动），已在 `playback-manager.js` 补即时 `applyDrive()` |

## 2. 逐条验收

### 布局与三维（总指令 Phase 1 / V0.3 §5）

| 要求 | 状态 | 证据 |
|---|---|---|
| CSS Grid 骨架，面板不再浮在全屏画布上 | PASS | `sim/index.html` `.app/.main/.scene`；`screenshots/phase-05/10-1792x864-visual.png` |
| renderer/相机按场景容器尺寸更新，不只跟浏览器窗口 | PASS | `StarTM/web/core/app-context.js` ResizeObserver；三视口 `canvasMatchesScene=True` |
| 地球全景占比≈45%、编队近景、目标跟随三档取景 | PASS | `06-1792-follow.png`、`03-1792-center.png`、`21-1792-cam-*.png`；实测 camToSat=18.03、ctrlToSat=0 |
| 三星身份可辨：独立标签+引线，不改物理坐标 | PASS | `third-person.js updateSatelliteLabels`；点标签选中同一 ID（`phase-01-test.md`） |
| 编队局部放大窗（RTN 相对位置，标注非同尺度） | PASS | `sim/js/formation-inset.js`；页脚 S12/S23/S31 与 `formation_rtn.csv` 逐条对账 |
| XYZ 方向轴指示器随相机真实变化 | PASS | `phase-01-test.md` 493 vs 491 字节；轴向量与 (x,y,z)→(x,z,−y) 互逆 |
| 基础光不被清场误删 | PASS | `scene-utils.js` `instanceof THREE.Light`；`sceneLights=[Ambient,Hemisphere,Directional]` |

### 右侧面板与字段映射（Phase 2 / V0.3 §6、指令 2.1–2.6）

| 要求 | 状态 | 证据 |
|---|---|---|
| 五标签各有独立字段映射与图表容器；切标签不动相机/时间/选星 | PASS | `phase-02-test.md` 四项「标签切换不改动…」；四张图标题互不相同 |
| 编队总览顺序：标题→四 KPI→三星对比→三组距离→边长曲线 | PASS | `tab-formation.png`；`#formationHero/#cmpBody/#edgeRows/#chEdge` |
| 距离单位换算有依据（数据本身是 km） | PASS | KPI 0.964 km ↔ CSV 0.9637 km；三行 0.941/1.007/0.943 ↔ CSV 逐值 |
| 轨道页只放轨道量；地面站斜距/仰角不冒充轨道根数 | PASS | 轨道页行集 = ①+⑨，无方位/仰角/斜距/可见性（`phase-02-test.md`） |
| 姿态页只放姿态与太阳翼受照；`att_mode` 有真实码表才翻译 | PASS | 姿态页 = ③+⑩；manifest `codes=['nadir']`，界面原样显示 nadir |
| 能源页不出现太阳高度；SOC/功率仅在字段存在且有效时显示 | PASS | 能源页行集只有 ⑥；`sun_alt` 只出现在地面观察页 |
| 热控页按真实测点显示；`temp_main` 空、`temp_*` 不存在时给清楚空态 | **BLOCKED-DATA** | 热控页空态点名缺失列；设备 `heat_w` 只作参数展示、不称温度结果 |
| 六种缺值状态区分，空值不转 0，正常状态不涂红 | PASS | `read()` 的 kind 体系；本影改为中性 `.tag.ecl`；卡片出现「字段未提供/暂无数据」 |
| 曲线有标题/单位/图例/时间刻度/tooltip/点击定位；无数据不画伪线 | PASS | `chart.js` 五档横轴刻度（本轮补）、`showTip`、`onPick` |
| 89.5% 带外红点定性 | **PASS（前端按事实显示）· 定性待数据侧** | 三条边各自成带，逐条越限 92.5%/88.0%/84.5%；阈值一字节未改。「这是数据本身如此还是上游投影噪声」尚未由生成侧确认，见 `REMAINING_BLOCKERS.md`，界面不替它定性 |
| 删除死控件 `#curveSel` | PASS | 全仓无引用 |

### 时间轴与地面观察（Phase 3）

| 要求 | 状态 | 证据 |
|---|---|---|
| `state.simSeconds` 是唯一权威时钟 | PASS | 仅 4 处写入，全经 store；`phase-06` 走带/跳转/单步全部一致 |
| T+ 与 UTC 明确标注、不混本地时间 | PASS | 顶栏 UTC 标签；T+18:00:00 ↔ 2026-09-13 22:00:00 ↔ 步 64801 |
| 播放/暂停/倍率/回起点/单步/拖动/事件跳转全部联动 | PASS | `phase-06-test.md`：单步恰 ±1 s、倍率 60× 写进状态、暂停即停 |
| 事件标记可点、带星号的选中该星、ALL 不猜选星 | PASS | `phase-03-test.md`、`phase-06-test.md` |
| 固定观察站如实标注，站址输入禁用 | PASS | `obsLat/obsLon/btnObs` 三禁用 + 说明文字 |
| 天空视图 5 倍张角放大标注非同尺度 | PASS | `#tabGround .note` |

### 配置、保存、加载、导出（Phase 4）

| 要求 | 状态 | 证据 |
|---|---|---|
| 抽屉按 V0.3 分组，字段有名称/单位/校验/错误提示 | PASS | 18 个根数输入逐条 = `meta.json:oe_input`；越界点名「半长轴 a₀ … 超出定义域」 |
| 没有依据的范围不自创 | PASS | 校验用物理定义域（a₀>R+100、0≤e<1、i∈[0,180]、角∈[0,360)） |
| 编辑后有「未应用更改」，取消需确认 | PASS | `phase-04-test.md` 两项目 |
| 引擎未接通时禁用重跑并解释 | **BLOCKED-MODEL** | `#btnApply` 恒 disabled；文案说明固定结果回放不重算 |
| 设备真实功耗/发热可显示但不伪装成计算结果 | PASS | 抽屉 ④ 组按原样列 `normal_w/heat_w`，缺的写「未提供」 |
| 保存 JSON 只含真实存在的参数；无后端时走浏览器下载 | PASS | `serproject-scenario/1`；界面不写「已保存到服务器」 |
| 加载校验版本/字段，失败有明确反馈且不半加载 | PASS | 非法文件 → toast + 18 个输入框一字未动 |
| 导出可选全部/当前星、时间范围、只导真实字段、空值不为 0 | PASS | 全程 86402 行/29 列，表头无 `power.*`/`thermal.*`；窗口 1202 行跨 42600–43800；三颗星各出一文件 |
| 成功/失败都有反馈 | PASS | toast 文案含文件数与字段数；空集时「未生成文件」 |

### 视觉统一、响应式、性能（Phase 5 / V0.3 §11）

| 要求 | 状态 | 证据 |
|---|---|---|
| 15 个颜色 token 照 §11.1 落地 | **PASS（15 token 到位）· E10 未闭环** | `phase-05-test.md` 逐 token 比对；body 背景 = `--bg-app`。但「组件不再各自挑色」这句说满了：仍有 18 处 off-token 字面量（`#eef5fb/#a2bad0/#9fb6cc/#9ecbff/#c78bd8` 等）、超限点 `#d8604b`（应给 `--status-error`）、XYZ 轴色 `#ff6b6b/#6bd0ff/#8ef0a8`、6 处 `rgba(40,207,200,·)` 是 `--border-active` 的第二份拷贝，见 `phase-45-review-round4.md` E10 与 `REMAINING_BLOCKERS.md` |
| 圆角 6–10 px 一套体系 | PASS | 实测分布只有 {6px,8px,10px}（50% 圆点除外） |
| 辅助文字 ≥11 px，全站不缩到 9–10 px | PASS | 三视口最小字号实测 11 px |
| 三星颜色在三维模型/标签/列表/图例/曲线统一 | PASS | CSS 变量 = 列表圆点 = 表头 = 曲线 = 三维本体 `38a9ff/29d7d0/ffb83f` |
| 颜色不单独承担状态语义 | PASS | 状态一律带文字；三维状态色另加文字说明（左栏新增一句） |
| 减少过度发光/冗余装饰 | PASS | 无强 alpha 或 ≥28 px 模糊的阴影 |
| 左右面板独立滚动、无多层嵌套滚动 | PASS | 只有 `#rail` 与 `#console .body` 两个滚动容器；互不带动 |
| ≤1280 右栏转抽屉且不挤扁中央场景 | PASS | 1280×720 无溢出、画布贴合、小窗遮挡 0 |
| 面板开关/容器尺寸变化触发 Three.js resize | PASS | 反复开合 6 次后画布仍贴合容器（1758×657 vs 场景 1758×656），tick 106→105 |
| 全屏下的 resize | **NOT-TESTED** | CDP 环境里 `requestFullscreen()` 被拒（`Permissions check failed`），只验证了「拒绝时有明确提示」；真实全屏未实测 |
| 复用几何体/材质，无重复渲染循环/监听/逐点绘制 | PASS | 每帧 setStep 调用数交互前后 0→0；无逐点画圆 |

### 数据真实性（贯穿全程的硬约束）

| 项 | 状态 | 证据 |
|---|---|---|
| 能源动态仿真 | **BLOCKED-DATA** | `power` 5 列 259203 点全空、`battery_soc_pct` 列不存在；界面两态区分 + 空态点名 + 导出剔除 |
| 热控动态仿真 | **BLOCKED-DATA** | `thermal` 4 列全空、`temp_*` 未交付；同上 |
| 未使用硬编码数值伪装 | PASS | 由 `measure_truth.py` / `gen_field_mapping.py` 直接扫 `columns.f32` 与 preview 表头可复现：power 5 列、thermal 4 列 259203 点全 NaN，`battery_soc_pct` 不在 66 列里；界面对这些一律走缺值态，`sumOf()` 拒绝把缺失相加当 0 |
| 轨道要素/相对位置的时间对齐 | PASS（本轮修复） | 曾按 1 s 下标索引 60 s 数据源（审查 N1）；现 `epFor()` 换算，`phase-02-test.md` 在 T+12:00:00 与 T+00:05:00 两个时刻分别与 `preview/orbit_itrf.csv` 的 rel_s=43200/300 行对账 |

## 2b. 独立审查轮次与处置（不写「已查证」，只写谁在什么时候推翻了什么）

| 轮次 | 审查文件 | 结论 | 之后发生的事 |
|---|---|---|---|
| Phase 1 第 1 轮 | `phase-01-review.md` R1 | 不通过（B1 半球光被清场误删、B2 截图与视角不符、H1–H4、H3-a 断言过松） | B/H 项修复并重跑；H3-a 改成「三条轨迹线互异 + 逐位等于 CSS 身份色变量」两条都要过 |
| Phase 1 第 2 轮 | `phase-01-review.md` R2（`:210-216`、`:250-262`） | **门禁：允许进入下一阶段 = 否**，列 G1（缺目标跟随截图）、G2（1280 下小窗被右栏盖住）、G3（断言仍与构造同义：引线只数对象、墙钟 fps 只 `say()`、`tabs` 测量不 `check()`、`check()` 里留着一行死代码）、G4（实施日志越界否认 H2 未修） | G1 ✓（`06-1792-follow.png` + `camToSat=18.03/ctrlToSat=0`）、G2 ✓（遮挡 0 断言）；**G3 直到第五轮才补**（引线两端投影对账、帧率改判「强制合成帧口径 25–120 tick/s」、`tabs` 两条 check、死代码删除），**G4 见「实施日志 `:99` 更正」**；R2 的 N1/N2/N3/N4/N8/N10 已登记进 `REMAINING_BLOCKERS.md` |
| Phase 2 第 1 轮 | `phase-02-review.md` | 不通过（1000 倍量级、五张截图同图、字段归属、曲线时间轴、带判定口径） | 见 IMPLEMENTATION_LOG「Phase 2 补审与整改」 |
| Phase 2 第 2 轮 | `phase-02-review-round2.md` | 两个阻塞项判为已修；新提 N1（60 s 数据源被按 1 s 下标索引，是我在整改中新引入的）等 7 项 | N1–N6 已修，N7/A7 记在遗留清单 |
| Phase 4 第 1 轮 | `phase-04-review.md` | 不通过：导出的 `utcg` 是硬写表头、二进制无此列 → 86401 行全空；加载只校验版本不校验完整性（少一颗星会静默缩小抽屉） | 已修：`utcg` 改走桥的真实时间戳并按「列存在才用」；加载前整体校验星数与字段，不合格一个字节都不改。新增两条可判真断言（utcg 前 4000 行非空、少星/缺字段文件被拒且 `input` 列表逐字不变） |
| Phase 5 第 1 轮 | `phase-05-review.md` | 不通过：DOM 字号审计看不到 canvas 里的 10.5px（`chart.js`、`formation-inset.js`）与 XYZ 字母 ≈9.4px；小窗仍用旧配色；本体身份色被灯光层每帧覆盖成死代码；4 处选中态用了废弃的青色字面量 | 已修：字号统一 ≥11px（含 canvas 与 SVG）、小窗改 import `SAT_COLORS`、本体明确为状态色通道并删掉被覆盖的赋值、选中态改用 token 色；并给验收加了 **canvas 字号记录器**（拦截 `ctx.font` setter）与 **小窗像素取色** 两类新断言，堵掉「只看 DOM」这个方法性盲区 |
| 最终第 1 轮 | `FINAL_REVIEW.md` | 不通过：矩阵 7 处过度声明（把 NOT-TESTED 写成 PASS、端到端「全部通过」与遗留清单矛盾、缺 `phase-03-review.md`、越限比例两个口径未对齐、引用了不存在的 phase-01 截图）+ 上面两条代码缺陷 | 本文件已按项改掉；`phase-03-review.md` 待补；越限两个口径已分别写明（图例=图上采样点；全天=93.90%/84.90%/89.63%，由 `measure_truth.py` 复现）；phase-01 截图待重跑落到 `screenshots/phase-01/` |
| Phase 3 第 1 轮（补交） | `phase-03-review.md` | 有条件 PASS：D1 事件选星断言恒真、D2 §3.3 天空视图选中未实现、D3 `follow(null)` 拽走站心相机、D4/D5 索引与星号配对、D7 三处弱断言、D8 缺审查文件 | D1–D8 处置见「第五轮」小节与 `phase-03-review-round2.md` |
| Phase 3 第 2 轮 | `phase-03-review-round2.md` | 有条件 PASS：D1/D2/D4/D5/D7 判已修；D3/D6「代码改了但缺运行时证明」；新抓 **D9**（同刻事件标记重叠，只有最上面点得到）、**D10**（插值播放路径仍按下标配对，D5 只修了一半）、D8 当时未落实 | 补了站心相机、按钮禁用、同刻不重叠、播放中放大对账四组运行时断言；D8 改本表 §1 的 Phase 3 行 |
| Phase 4/5 第 4 轮（静态） | `phase-45-review-round4.md` | 两个阶段各判「有条件 PASS」：E1 剔除项不上界面、E2 拒绝理由不核对（能过但抓不到回归）、E3 字号审计覆盖不到 iframe、E4 时长 off-by-one、E6 可伪造版本号的死代码、E7 反馈无文件名、E11 `null s`；E5/E8/E9/E10/E12 记遗留 | E1/E2/E3/E4/E6/E7/E11 已改；其余进 `REMAINING_BLOCKERS.md` |
| Phase 6 第 1 轮（补交） | `phase-06-review.md` | 有条件通过：F1 `setStep` 计数在暂停态取样（「0→0」恒成立）、F2 §1 计数与产物不同源、F3 证据串写 TM0S3、F4 断言名比判据强、F5 死代码、F6 倍率只判状态、F7 阈值文案与代码不符、F8 `all()` 空集合退化 | F1 改「点一次单步恰好驱动一次」双向可失败，**顺带挖出暂停态选「跟随」相机不动的真缺陷**（`follow()` 补即时 `applyDrive()`）；F2/F3/F5/F7 已改；F4 把 `dot = --sat*` 纳入条件；F6 补 60× 推进断言（1× 1 s vs 60× 79 s，同 12 帧）；「端到端回灌加载」如实记 NOT-TESTED。冻结树后 485 条断言 0 FAIL |
| 最终第 2 轮 | `FINAL_REVIEW_ROUND2.md` | **有条件可交付**：数据纪律与第五轮六项修复被独立复现（抽 8 值逐值吻合、90 张截图 MD5 全唯一）；但计数口径不可信（`say()` 用 `ascii()` 加引号导致 grep 漏计，363 实为 466）、§4/§5b/§2b 与磁盘不符、两处 PASS 措辞说满、Phase 6 仍无独立审查文件、工作树在复核期间又被我改动一次（未冻结取证） | 计数改由 `phase-0*-test.md` 口径给出并修 `say()`；§5b 路径、§4 清单、§2b 本行、矩阵两行措辞均已更正；Phase 6 独立审查已补交（上一行）；**随后冻结工作树重跑全部六阶段**（05:03–05:11 UTC，485 条 0 FAIL），运行窗口、§4 行数和 test.md 已对齐到同一份树 |

## 3. 运行时回归汇总

| 项 | 实测 |
|---|---|
| 渲染帧率（1792×864，播放中） | 52–60 fps（并发压测时低到 10–12，见 §6 环境说明） |
| rAF 循环不重复累积 | 8 张强制合成帧：切换前 108 tick / 切换后 99 tick |
| 控制台 error / 未捕获异常 | 0 / 0（WS 重试类已单独判定；bare 模式不再启动 WS） |
| 三视口文档级溢出 | 1792×864、1366×768、1280×720 均为 [0, 0] |
| 数据规模 | 86401 历元 × 1 s × 3 星；`columns.f32` 64.3 MB；`orbit_14col.csv` 38.5 MB |

## 4. Git 改动范围

已跟踪文件 **18 个，+1343 / −403**（`git diff --stat -- sim StarTM/web`，2026-10-16 05:11 UTC 冻结树后实测）：
`sim/index.html`、`sim/js/{main,panels,chart,loader,store}.js`、`sim/config/{display,panels}.json`、
`StarTM/web/app.js`、`StarTM/web/core/{app-context,scene-utils}.js`、`StarTM/web/managers/playback-manager.js`、
`StarTM/web/modules/{config,sat-model,interpolation}.js`、`StarTM/web/modules/ui/tooltip-system.js`、
`StarTM/web/modules/views/{third-person,first-person}.js`。
（此前只登记了 16 个，漏掉第五轮 D2/D5 的落点 `interpolation.js` 与 `first-person.js`。）
新增未跟踪：`sim/js/scene-io.js`（**254** 行）、`sim/js/formation-inset.js`（**108** 行）。
差异快照：`round5.diff`（当前工作树 vs HEAD 的完整源码差异，2802 行，含未跟踪文件清单）；
按轮次的历史快照 `phase-00/01/02/02-indexhtml/02-remediation/03-worktree/04/05/06.diff`。
未逐阶段提交——指令不要求自动 commit，快照口径是「工作树 vs HEAD」按文件范围截取；**是否入库由你决定**。
未改动：仿真数据文件、轨道坐标、传播器、协议层、数据库、`main_fastapi.py`。

## 5. 端到端 12 项（§6.1）逐项状态

| # | §6.1 项 | 状态 | 证据（可重跑） |
|---|---|---|---|
| 1 | 桥接未就绪/就绪、加载三星示例 | PASS | `phase-06-test.md`：掉线后 `attached=false`、轨道页改口「未接入」；点「重新加载」回到 `mode=csv` 且读数与掉线前同一时刻一致 |
| 2 | 编队总览→单星查看→地面观察 | PASS | 同上 + `screenshots/phase-06/20-1792-e2e-views.png` |
| 3 | 地球全景→编队近景→目标跟随 | PASS | `21-1792-cam-{global,formation,follow}.png`；机位三元组互不相同 |
| 4 | TM0S1→TM0S2→TM0S3 | PASS | 界面名 + 三维 `selectedSatIdx` + 圆点色三者对齐 |
| 5 | 播放/暂停/倍率/回起点/单步/时间跳转 | PASS | 单步恰 ±1 个采样间隔；倍率既写进状态也真的改变推进速度（同样泵 12 帧：1× 走 1 s、60× 走 79 s，断言判 `60× ≥ 10×`）；T+18:00:00 ↔ 22:00:00 ↔ 步 64801 |
| 6 | 五个右侧标签 | PASS | 五张图容器标题互不相同（`phase-02-test.md` 另有像素差证明）；五个标签的曲线区与四个卫星页的大字区都进判定 |
| 7 | 面板收起/展开、全屏/退出 | 收起展开 **PASS** / 全屏 **NOT-TESTED** | `22-1792-restored.png`；全屏在 CDP 下被拒（`Permissions check failed`），只验证了提示存在 |
| 8 | 点击事件跳转 | PASS | 点带星号事件：跳到该标记自己的 `data-sec`（T+18:00:00 → T+04:55:56）并把选中改成它自己的 `data-sat`（本轮实测 TM0S1）；比对取的是标记自身的数据，不是实现写的文案 |
| 9 | 场景保存、加载、结果导出 | **有条件 PASS** | 保存出 `天幕场景_*.json`、导出出 `TM0S<选中星>_时间序列_*.csv`（文件名星号与 `kvSat` 对账）；**端到端这一轮没有再跑「回灌加载」**（细账在 `phase-04-test.md` 的合法/坏文件三例）→ 该子项记 **NOT-TESTED（跨阶段引用）** |
| 10 | 无数据、缺失字段、无效文件、加载中/失败 | **有条件 PASS** | 掉线态读数与能源/热控空态见 §2（BLOCKED-DATA）；非法与不完整文件被拒在 `phase-04-test.md` 验，端到端未重跑；能源/热控**动态**仍是 BLOCKED-DATA，整行不写纯 PASS |
| 11 | 三个视口尺寸 | PASS | 1792×864 / 1366×768 / 1280×720 无溢出、画布贴合、小窗不被遮挡 |
| 12 | 控制台/网络错误、renderer/rAF/监听重复 | PASS | 0 error 0 异常 0 原生弹窗；`sameNode=True`；「点一次单步前进恰好驱动一次 `setStep`」交互前后都是 1（多监听→2、没接上→0，两种都判 FAIL）；tick 不累积 |

注：本表由 `harness.py phase-06` 在冻结代码树上实跑生成（0 FAIL）。第 7 项的全屏、第 9 项的「回灌加载」、第 10 项的端到端重跑三个子项不是 PASS，按 NOT-TESTED / 跨阶段引用如实标注。

## 5b. 可重跑的取证脚本（不依赖任何人的叙述）

| 脚本 | 产出 |
|---|---|
| `outputs/cdp-check/harness.py phase-0X` | 各阶段 `phase-0X-test.md` + `screenshots/phase-0X/` |
| `outputs/cdp-check/measure_truth.py` | 直接扫 `columns.f32`：三条边长的全天越限比例、`array_incidence_deg` 与 `incidence_deg` 是否同值 |
| `outputs/cdp-check/gen_field_mapping.py` | 重新生成 `DATA_FIELD_MAPPING.md`（含每列实测非空计数） |
| `outputs/cdp-check/build_evidence_pack.py` | 生成**单文件证据包** `docs/ui-implementation/acceptance-evidence.html`（7.1 MB，90 张截图 base64 内嵌，双击即开、不需服务器） |
| `outputs/cdp-check/verify_pack.py` | 用 Chrome 真打开那个 HTML，核对 90 张图全部解码、7 个阶段小节齐全，并落渲染截图 `outputs/pack-render.png`（实测 `imgs=90 broken=0 sections=7`） |
| `sim/tools/verify_handoff.py` | 交付表 3-6 覆盖度核对（路径此前误写为 `outputs/`，该目录下并无此文件） |

## 6. 环境与已知不稳定性（如实记）

- 本轮多次运行期间，同机并发跑了 2–3 个验收 Chrome + 独立审查用的 Chrome，每个页面都要拉 38.5 MB 星历与 64.3 MB 二进制列；
  期间出现过一次 dev server 掉线（`:8000` 连接被拒）与若干次「桥接 79 s 未就绪」。重启 server 后复测全部通过。
  因此帧率与「重新加载耗时」这类时序数字有环境抖动，不作为质量结论，只作为现象记录。
- iframe 被外部强制 `location.reload()` 后的恢复：已加 CSV 模式重试与明确失败提示；实测仍需 1–2 次点击「重新加载」才回到 csv 模式，
  该项在 `REMAINING_BLOCKERS.md` 记为待改进，不当作已通过。

# 最终验收复核 · 第 2 轮（面向交付包整体）

复核对象：`docs/ui-implementation/` 交付包 + 当前代码树（分支 `sim-system`，HEAD 实测 `a8f7841`）。
取证产物：`outputs/review-r2-p03.log`、`outputs/review-r2-p05.log`（两次独立重跑的原始 stdout）；被重跑重写的是
`phase-03-test.md`/`phase-05-test.md` 与 `screenshots/phase-03/`、`screenshots/phase-05/`。
环境纪律：跑前用 `wmic` 确认无常驻 harness（只有 `main_fastapi.py` PID 43188 与两个无关脚本）；串行、一台浏览器；
未杀任何进程、未重启 8000、未改任何实现文件、无 git 写操作。

## 总判定

**有条件可交付。** 一句话理由：界面侧的数据真实性与第五轮六项新修复我全部独立复现成功（两阶段重跑 0 FAIL、取数逐值吻合、
90 张截图零重复），签字的障碍不在系统，而在交付文档的**计数口径与改动/处置登记**——363 这个数是 grep 缺陷低估出来的、
`§4` 改动范围与 `§2b` Phase 1 处置与磁盘事实不符、`§5b` 引用了一个不存在的脚本，且工作树在复核期间又动了（取证函数本身）。
下列 7 项条件除最后一条是「冻结 + 重跑」外，其余都是改文档 + 十行台架，不需要改界面业务代码。

## 1. 声称与证据的对账

**断言计数：声称 363 = 低估，真实 466（01–06）/ 491（含 00）。0 FAIL 这一条实质成立，但机器口径不可信。**

- `runall8.log` 逐行 `pass=44/58/54/73/72/62 fail=0` 与 §1 的 363 完全一致 → 声称数字是从 stdout grep 出来的。
- 同一日志与 test.md 逐条比对：md 实际 `^PASS` = **55/89/71/88/89/74 = 466**，每阶段多出的 11/31/17/15/17/12 条
  全是 detail 里含单引号的行（如 `['38a9ff','29d7d0','ffb83f']`、`{'camSel': ...}`）。
  根因：`harness.py:34` 的 `ascii(...).strip("'")` 遇到内含单引号的字符串会输出 **双引号开头** 的 repr，
  `run_all.py:17-18` 的 `startswith("FAIL  ")` / `startswith("PASS")` 双双漏匹配。
  **这意味着「0 FAIL」在 run_all 口径下不是证据**（一条 detail 含引号的 FAIL 会被记成 fail=0）；
  我改用 md 逐行核对：七份 `phase-0*-test.md` 的 `^FAIL` 均为 0、「失败项：无」与 `report += FAIL` 同源 → 0 FAIL 成立。
- §1 措辞「六个阶段串行跑」但门禁表是 7 行：`phase-00-test.md` 与其 6 张截图 mtime 是本日 00:59，
  **不在 03:21–03:29 那轮**（run_all 只接 01–06）。Phase 0 的断言在每个阶段的前置块里被重跑，实质风险低，但表格口径要写明。

**截图：90 张，MD5 90 个唯一值，零重复；文档引用的 90 个 `screenshots/...` 路径 100% 存在。** PIL 像素差（≥12/255 的像素占比）：

| 对比 | 结果 |
|---|---|
| `phase-01/01-1792-overview` vs `phase-03/09-1792-ground` | max 254，**32.17%** 像素不同 → 确为不同视图 |
| `phase-01/01` vs `phase-01/02-panels-collapsed` | 255，49.27% |
| `phase-01/06-1792-follow` vs `06-1792-earth-framing` | 255，18.10% |
| `phase-02/tab-power` vs `tab-thermal`；`tab-formation` vs `tab-orbit` | 191，1.16%；247，3.14% |
| `phase-05/13-formation` vs `14-attitude` vs `15-orbit` | 247，3.12%；191，1.76% |
| `phase-06/21-cam-global` vs `follow` / `formation` | 255，12.53% / 255，34.55% |
| 跨阶段同名 `01-1792-overview`（01 vs 02） | 133，0.10% → 同视角不同轮次，合理 |
| `phase-05/10-1792x864-visual` vs `13-1792-visual-formation` | max 25，**0.006%** → 同一默认态重复截图，不是造假但属冗余证据 |

## 2. 独立重跑（phase-03 / phase-05）

| 阶段 | 本轮实测 | 声称轮次（11:21–11:29）| 关键新断言 |
|---|---|---|---|
| phase-03 | **71 PASS / 0 FAIL**，104 行日志 | 71 PASS / 0 FAIL | 6/6 通过 |
| phase-05 | **89 PASS / 0 FAIL** | 89 PASS / 0 FAIL | 全部通过 |

- 重写前后 PASS 名称集合逐条相同；数值级复现：`同刻标记 dup=[]、multi=3`、`跨星点事件 before=TM0S1 → after=TM0S3 且跳到 T+04:55:56=标记自身 data-sec`、
  `进地面观察 cam=[0,0,0] ctrl=[0,0,0] view=first + 「框住昼夜分界」disabled`、
  `skyScale` 三行各自只有 index 0/2/1 那一位 = **2.2**、其余 1.0（播放中 `big=[2] sel=[2]`）→ 天空视图选中态、相机不拽走、按 `sat_id` 认领三组修复**是真的**。
  连不利数字也如实：`天空视图网格数 [61,61,61]`（两轮相同，见 §5 的 12 vs 61 问题）。
- phase-05：`iframe realm 记录器 fired {min:42, n:182}`（不再是初值 99）、`反算标签 39.39px`、
  `选中环 28cfc8 = --border-active #28cfc8`、三视口最小字号 11px、圆角集合仅 {6,8,10px}、`滚动容器只 NAV#rail/DIV#body`。
- 两处取证盲区（不影响结论，但「全站 ≥11px」这句要说弱一档）：
  ① `spriteFont` 只取 **一张** 可见标签、只在 **全景** 相机下反算（`harness.py:1295` 注释自认），编队近景/一维视角未量化；
  ② 文档记的「10.5px→约 13.1px」与代码不可追溯——`sat-model.js:71,94-95` 是 `font=42px / texH=64`，
  按 `screenH×42/64` 只能得到实测的 39.39px，`IMPLEMENTATION_LOG.md:429` 那组 16→20px 数字在磁盘上没有对应实现。
- **工作树在复核期间仍在动（新发现的门禁问题）**：我 11:40 前后核查时 `sim/`、`StarTM/web/` 确无晚于 11:21 的实现文件，
  但 `StarTM/web/managers/playback-manager.js` 的 mtime 已变成 **11:47:25**（在我的两次重跑之后），
  `git diff` 由 +91/−7 变为 **+96/−7**，改动点正是上面那条 `spriteFont` 反算（改成 `camera.matrixWorld.extractBasis` + `project()` 取投影高度）。
  → §1 的「0 FAIL 覆盖当前代码树」有效窗口只有十几分钟；这一处改动落在**取证函数本身**，必须重跑 `phase-05`（含反算断言）才能重新对上。

## 3. 数据纪律抽查（红线）——独立取数，全部吻合

我直接 `memmap` 扫 `sim-data/render/columns.f32`（86401×66，64.3 MB，`i=offset+satIdx*86401+epoch`）与 `sim-data/preview/*.csv`：

| 我量到的真值 | 界面记录值 | 出处 |
|---|---|---|
| `ground_obs.el` @epoch 60000 = −6.8/−6.8/−6.8；@18000 = 21.2/21.1/21.2 | 同 | `phase-03-test.md:104`（重跑仍同） |
| `sun_eclipse.incidence_deg` @43200 = 86.5519；`array_proj_factor` = 0.0601；`ground_obs.off_axis` = 44.8678 | 86.55° / 0.06 / 44.87° | `phase-01/02/04/06-test.md` 右栏实测 |
| `formation_geom.edge_12/23/31` @0 = 1.066814/0.979327/1.023597；@43200 = 0.940968/1.007476/0.942560 | 小窗 1.067/0.979/1.024；三行 0.941/1.007/0.943；KPI 平均 **0.9637→0.964** | `phase-01-test.md:55`、`phase-02-test.md` 对账行 |
| `preview/orbit_itrf.csv` rel_s=43200 sma=6976.46421 → ⑨ 组「6976.5km」；**−6378.137 = 598.33** → 轨道高度 KPI | 同 | `phase-02-test.md` ⑨ 组时间对齐 |
| `preview/formation_rtn.csv` rel_s=43200 sat2 R=0.4234 T=−0.1614 | 0.42 / −0.16 km | 同上 |
| `power` 5 列 + `thermal` 4 列 **np.isfinite 全量计数 = 0/259203（每列）**；`battery_soc_pct` 不在 66 列 | 界面「暂无数据 / 字段未提供」两态；导出 27 字段 | `phase-02-test.md` 空态断言 |

- 能源/热控在界面上**确实是空态文案不是数字**：`phase-01/02/03/04/06-test.md` 的右栏实测里 power 页 =
  「发电功率暂无数据 / 电池 SOC字段未提供 / 电量裕度暂无数据」，thermal 页四项全「暂无数据」；
  `panels.js:98-112` 的 `read()` 五档 kind + `sumOf()`（117-125）无任何兜底常数 → 「硬编码伪装」不成立。
- 「应用并重新运行」恒禁用：`phase-04-test.md` 抽屉实测 `applyDis: true` 出现两处（初始打开、加载合法场景文件之后）。
- `measure_truth.py` 复跑逐字复现文档：全天越限 93.90/84.90/89.63%、初始边长 1066.81/979.33/1023.60 m、
  `array_incidence_deg` 与 `incidence_deg` 三星 × 86401 **最大差 0.0**。
- 时间戳 provenance：导出 `utcg` 前 4000 行非空且逐行 +1s（`20260913040000…`）；`总时长_s=86400`、顶栏 `24:00:00`，E4 已落地。

## 4. 验收矩阵口径是否诚实

**没有把 BLOCKED 写成 PASS，也没有把 NOT-TESTED 写成 PASS**——逐行回查：能源/热控动态仿真 = BLOCKED-DATA、
`#btnApply` = BLOCKED-MODEL、站址输入 = BLOCKED-MODEL、热控测点 = BLOCKED-DATA、全屏 resize = NOT-TESTED、
§5 第 7 项拆成「收起展开 PASS / 全屏 NOT-TESTED」。`phase-06-test.md` 74 条 PASS 覆盖 §5 十二项，逐条能落到日志行。

**但有三处口径超出证据：**

1. **§5b 引用 `outputs/verify_handoff.py`——该文件不存在**（`ls` 确认）；其余三个脚本存在且可复跑。
2. **§2 视觉行「15 个 token 照 §11.1 落地，组件不再各自挑色 = PASS」与 E10 直接冲突**：
   实测 `sim/index.html` 内 8 处非 token 十六进制（`#eef5fb/#a2bad0/#d8604b/#ff6b6b/...`）+ 6 处 `rgba(40,207,200,·)` 拷贝，
   `chart.js` 另 1 处；`REMAINING_BLOCKERS.md:56-58` 自己写明「验收台只比 token 到位，不比取色来自 token」。后半句应降为 PARTIAL。
3. **§2「89.5% 带外红点定性 PASS（结论：数据事实）」与遗留清单「需数据侧决策、未定性」两个口径并存**：
   FINAL_REVIEW 第 7 条只统一了数字（92.5/88.0/84.5 图例口径 vs 93.90/84.90/89.63 全天口径），定性没有收回。

## 5. §2b 轮次处置 vs 磁盘审查文件 / 遗留清单

- 审查文件齐备性：`phase-00/01/02(+round2)/03(+round2)/04/05`、`phase-45-review-round4`、`FINAL_REVIEW` **全部存在**；
  **Phase 3 确已补齐**（`phase-03-review.md` 09:09 + `phase-03-review-round2.md` 10:42）；
  `phase-01-review.md` 内含 R2 两轮 ✓；**Phase 6 没有独立审查文件**，§1 用「见本文件 §5」代替 → FINAL_REVIEW 的 B5 只补了一半。
- **§2b 缺 Phase 1 第 2 轮这一行，且 §1/§2b 互相不同源**：§1 写「第 1 轮 4 项阻塞（G1 缺跟随截图、G2 小窗被盖、B2/H2/H3）」，
  而 G1/G2 实际是**第 2 轮**（`phase-01-review.md:210-216` R2.3 + `:250-262` R2.7「允许进入下一阶段：**否**」）的编号，§2b 又写「B1/B2/H1–H4 … **全部修复并重跑**」。
  磁盘事实：G1 ✓（`06-1792-follow.png` + `camToSat=18.03/ctrlToSat=0`）、G2 ✓（1280 遮挡 0 断言）、
  **G3 ✗**（「引线对象数等于星数」仍与构造同义、墙钟 fps 仍只 `say()`、`tabs` 测量仍不 `check()`、`harness.py:37 (say if cond else FAIL.append)` 死代码仍在）、
  **G4 ✗**（`IMPLEMENTATION_LOG.md:99` 至今写「右栏图表与标签绑定**未动**（属 Phase 2）」，而 H2 被同一份审查判 NOT FIXED）。
- `REMAINING_BLOCKERS.md` 的新增项**没有被偷偷算成完成**：E5/E8/E9/E10/E12/D6/网格累积/倍率脱钩 8 条我在矩阵里逐行反查，
  没有任何一行把它们写成 PASS（E10 只在 §2b Phase 5 行标「记入遗留」✓）。
  两处失实/漏登：① 「天空视图网格 **实测 12 个**」与两次实跑的 `[61,61,61]` 不一致（低估 5 倍，且跨阶段累积）；
  ② phase-01 审查「不阻塞但请登记勿丢」的 **N1/N2/N3/N4/N8/N10**（页面视图覆写相机模式、ground 分支未 `refreshLayers`、
  `satLabels3D/satLeaders` 未随清场复位、指示器未标 J2000、R–T 投影未点明、缺「晨昏轨道 ≤11.8°」说明）在遗留清单里**一条都没有**。
- `§4` 改动范围与 `git` 实测不符：HEAD 是 `a8f7841` 不是 `61841a7`；已跟踪 **18 个文件 +1322/−403**（文档 16 个 +1120/−360），
  漏登记 `StarTM/web/modules/interpolation.js`(+29/−14) 与 `views/first-person.js`(+7/−1)——正是第五轮 D2/D5 的落点；
  新文件行数也旧了（`scene-io.js` 实测 254 行 / 文档 216，`formation-inset.js` 108 / 106）；diff 快照清单漏 `phase-06.diff`、`round5.diff`。
- §1 Phase 4 行仍写「E1/E2/E4/E6/E7/E11 已改，**待第五轮复跑确认**」，而 §1 表头已宣布该轮跑完 0 FAIL → 措辞未同步（虚报方向相反，属陈旧）。
- 实施日志没有独立的「第四轮返工」小节：第四轮（E1–E12）处置被写进「第五轮」一节，标题层级与 `phase-45-review-round4.md` 对不上。

## 6. 交付清单核对表

| 清单项 | 在不在 | 是否当前代码树产出 | 口径与事实 |
|---|---|---|---|
| 实施日志 `IMPLEMENTATION_LOG.md` | 在（44.3 KB，11:22） | 是（11:22 早于末次实现改动） | 基本一致；缺陷：`:99` 越界否认仍在（G4 未修）、`:429` 13.1px 与代码不可追溯、缺「第四轮」独立小节 |
| 独立审查记录 | 在（9 份，Phase 3 已补齐 ✓；Phase 6 ✗） | 审查文件本体与代码树无关 | **不完整**：§2b 缺 Phase 1 第 2 轮行；G3/G4 与 N1–N4/N8/N10 未登记 |
| 验收矩阵 `FINAL_ACCEPTANCE.md` | 在（18.1 KB，11:30） | §1 计数对应 11:21–11:29 实跑；我当时核查 `sim/`、`StarTM/web/` 无晚于 11:21 的实现文件，**但 11:47:25 起 `playback-manager.js` 又变了 → 现在不同源** | BLOCKED/NOT-TESTED 诚实；两处 PASS 措辞夸大（token、越限定性）；§5b 含一个不存在的脚本；§4 数字陈旧 |
| 数据字段映射 `DATA_FIELD_MAPPING.md` | 在（11.2 KB，07:11） | 由 `gen_field_mapping.py` 生成，其口径（前 400 采样）我用全量扫描复核 | **一致**：抽 5 列 8 个值 + 「0/400 非空」实为 0/259203，全部对上 |
| 遗留阻塞项 `REMAINING_BLOCKERS.md` | 在（11:31） | 是 | 8 项新遗留诚实未闭环 ✓；两处数字/登记问题见 §5 |
| 实际运行截图 | 在（90 张，01–06 全部 11:21–11:29） | **是**（mtime 落在声称窗口，我核查时实现文件均 ≤11:21；唯 11:47 后 `playback-manager.js` 又动，见 §2）；`phase-00/` 6 张是 00:58 | 90 个 MD5 全唯一、引用路径 100% 存在、像素差证明不同视图；`phase-05/10 vs 13` 属同视角冗余 |

## 7. 签字前必须补的最小集（全部为文档/台架改动，不涉及界面代码）

1. **改计数口径**：矩阵 §1 以 `phase-0*-test.md` 为准写 **466 条（01–06，0 FAIL）/ 491 含 Phase 0**，
   并说明 363 是 grep 缺陷；**修 `harness.py:34` 的行首引号**（或 `run_all.py` 改按 `FAIL` 列表计数），
   否则「0 FAIL」永远只是弱证据。这是本轮唯一真正动摇结论的形式问题。
2. **§5b 删除或补齐 `outputs/verify_handoff.py`**（现在指向一个不存在的脚本）。
3. **§4 更新**：HEAD `a8f7841`、18 文件 +1322/−403、补 `interpolation.js`/`first-person.js`、新文件行数 254/108、diff 清单补 `phase-06.diff`/`round5.diff`。
4. **§2b 补 Phase 1 第 2 轮行**（G1–G4 + 门禁「否」），把 G3/G4 明确写成**未修**并登记进 `REMAINING_BLOCKERS.md`；
   按 G4 更正 `IMPLEMENTATION_LOG.md:99`；同时把 N1/N2/N3/N4/N8/N10 登记进遗留清单。
5. **两行矩阵收回措辞**：「组件不再各自挑色」→ `PASS(15 token 到位) + E10 未闭环`；「89.5% 带外红点定性 PASS」→ `PASS(前端按事实显示) + 定性待数据侧`。
6. **两处数字**：遗留清单的网格「12 个」→ 61（并说明跨阶段累积）；§1 Phase 4 行「待第五轮复跑确认」→ 已跑完 0 FAIL；
   网格/字号两项建议顺手按 G3 补 3 条可失败断言（引线 visible、`55<fps<75`、`tabs` 上 `check()`）后重跑 `phase-01` 一次。
7. **冻结工作树并重跑取证**：`playback-manager.js` 已于 11:47:25 改动（`spriteFont` 反算换成投影法）→ 必须停止继续编辑实现文件，
   重跑 `phase-05`（至少，含反算断言）与 `phase-01/02/03/04/06` 一轮，把 §1 的运行窗口、`§4` 的行数与 `phase-0*-test.md` 重新对齐到同一份树。

以上 7 条做完即可无条件签字：系统侧我不再保留任何异议——数据纪律、第五轮六项修复、端到端 12 项、三视口与导出/加载的诚实反馈，
均已被我独立复现。

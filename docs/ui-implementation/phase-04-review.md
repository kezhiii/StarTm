# Phase 4 独立审查（第 2 轮 · 全量重新取证）

- 审查者：独立验收子代理（只读；自建脚本与中间产物只在 `outputs/scratch-p4b/`）
- 日期：2026-10-16，分支 `sim-system`
- 依据：`Basedoc/UI设计V2/天幕卫星仿真系统_前端自主改造全流程指令.md` §Phase 4：4.1 配置抽屉 L180-186、4.2 保存与加载 L188-191、4.3 导出结果 L193-196、4.4 验收 L197-199
- 被审文件与行号：`sim/js/scene-io.js`(216 行)、`sim/js/main.js`(btnSave L469-480 / btnExport L482 / expGo L484-508)、`sim/index.html`(抽屉 L605-629、导出对话框 L631-645、配置入口 L466-478)、`sim/js/panels.js`(`exportRows` L672-710)
- 工作树哈希：scene-io.js `06a4c19eac3537a6fac19f293c5bbbf9`、main.js `a5a0e3d64c83c0bf912eae58f1c03b68`、index.html `f88f368185819c754c6cff0c9351713f`、panels.js `8cae41700671066152ced422503c6486`、harness.py `8361df2c5650e231be1932987f47f45b`
- 环境说明：dev server 已在 8000 端口运行（`curl /sim/` = 200），本轮未自行启动。
- **流程披露（两件必须说的事）**：
  1. 本路径原有一份同名文件（上一位审查者的「第 1 轮」报告，219 行，git 未跟踪）。因交付路径固定，已先原样备份到 `outputs/scratch-p4b/phase-04-review.round1.bak.md` 再写入本报告；本报告不引用该轮结论，全部自行取证。
  2. 为取运行时证据运行了官方验收台 `outputs/cdp-check/harness.py phase-04`，它按设计**覆写了** `docs/ui-implementation/phase-04-test.md` 与 `docs/ui-implementation/screenshots/phase-04/*.png`（12 张）。本次运行结果：**0 FAIL**。文中凡标注「harness 实测」的数字均来自这次我自己触发的运行；其余数字由本审查者用 numpy/csv 直接从 `sim-data` 重算。
- 诚实声明：我另写的独立 CDP 探针（`outputs/scratch-p4b/probe2.py`）**未能跑通**——脚本缺 `Page.navigate` + 窗口前置，页面始终停在未 attach 状态（`btnExport.disabled=true`、`stepSlider.max=0`），且 `createObjectURL` 钩子在导航后丢失。因此抽屉/加载的运行时数字取自 harness 实测，导出单元格数值由我从数据文件反算交叉验证。未把「探针失败」算作被测系统的缺陷。

## 结论

**允许进入下一阶段：否。**

不涉及伪造数据（这是最坏的一类，已明确排除）：能源/热控两组 0 个输入框、`snapshot()` 的未提供分组与数据事实一致、`应用并重新运行` 恒禁用且无任何「已重算/已存服务器」话术。判否的原因是 Phase 4 自己的两条硬条款仍有实际违背：

1. **§4.3「只导真实存在的字段」被表头里的恒空列破坏**（Q2）：`exportRows` 把 `utcg` 硬编码进表头，但 `ground_obs.utcg` 不在 render manifest 的列清单里，`getValue` 对二进制条目查不到列即返回 null → 导出的 `utcg` 列 86401 行全空，而对话框提示语写的是「只导出真实存在的字段；空值保持为空，不填 0」。同一函数对 power/thermal 特意做了「整列为空就不出这一列」的判断，唯独 `utcg` 绕过该判断。真实 UTC 串在 `sim-data/ground_obs.csv` 里存在（例：rel_s=43200 → `2026-09-13 16:00:00`），属可取未取。
2. **§4.2「校验文件版本/字段」缺字段完整性校验，存在半加载**（Q4）：`cur.oe = j['轨道根数_初始']` 直接整体替换，随后才 `renderBody()`/`validate()`，无回滚；只含 2 颗星的合法版本文件会把抽屉静默缩成 12 个输入框（TM0S3 消失、无报错），保存再回灌即真丢数据；`null` 型缺键会让 `renderBody()` 抛异常被 catch 成「界面保持原状态」，而 `cur.oe` 已被替换。

两项都是小面积、可一轮修完的改动（约 20 行），修完并补上能失败的断言后可复审通过。

## Q1 抽屉/场景 JSON 是否发明能源·热控数值 —— **PASS**

数据事实（本审查者 `numpy` 直算 `sim-data/render/columns.f32`，共 16,070,586 个 f32；`nEpoch=86401`、`sats=[1,2,3]`、每列 `count=259203`）：

| 分组 | manifest 实测 | 抽屉渲染 |
|---|---|---|
| power 5 列 `gen_power/platform_power/payload_power/accum_energy/battery_margin` | offset 10108917/10368120/10627323/10886526/11145729，**NaN 259203/259203 = 100% 空** | ③ 组 inputs=0、miss=1，文案「power 的 5 列整列为空，battery_soc_pct 列不存在」；电池容量/初始 SOC/发电功率参数三行显示 `—` |
| thermal 4 列 `ext_heatflux/equip_power/temp_main/over_limit_count` | offset 11404932/11664135/11923338/12182541，**NaN 100% 空** | ⑤ 组 inputs=0、miss=1，文案「thermal 的 4 列整列为空，逐测点 temp_ 列未交付」；初始温度/热参数/主动热控显示 `—` |
| `battery_soc_pct` | manifest 66 列中不存在 | 文案如实说明「列不存在」 |
| `temp_*` 逐测点 | 只有 `thermal.temp_main` 一列（且为空），无 `temp_<node>` | 文案如实 |

`harness 实测`：`cfgPower.inputs=0`、`cfgThermal.inputs=0`，两组各有 1 个 `.miss`，`applyDis=true`；① 组 `inputs=18`。
`snapshot()` 的 `未提供分组 = ['能源系统（power 列为空）','热控参数（temp_* 列未交付）']`，与上表一致（措辞瑕疵见次要项 6）。
其余字段均有出处：`总时长_s=86401`、`采样间隔_s=1`、`观察站` 来自 `sim-data/meta.json`；`场景标识=TM-V0-SIM · FreeDrift-Synthetic`、姿态模式 `nadir` 取自 `time_ident`/`attitude` 实测（harness 实测 ②组 inputs=0，只读）。

## Q2 导出完整性 —— **PARTIAL**（计数与数值全对，唯一缺陷是恒空 `utcg` 表头列）

`harness 实测` + 我的反算：

| 断言项 | 期望 | 实测 |
|---|---|---|
| (c) 全程 = 86401 数据行 + 表头 | 86402 行 | **86402 行**（29 列，当前选中星 TM0S2）→ PASS |
| (d) T+12:00:00 前后各 10 分钟 | 1201 行，rel_s 42600..43800 | **lines=1202（含表头），first=42600，last=43800，文件名 `TM0S1_时间序列_42600-43800.csv`**；scope=all 时 3 个文件 → PASS |
| (a) 不含 `power.*`/`thermal.*` | 0 个 | 表头 29 列全部落在 `ground_obs./sun_eclipse./attitude./display.` + `rel_s` + `utcg`，无任何 power/thermal 列 → PASS（该结论由「整列为空即丢列」逻辑 + 我实测的 100% NaN 共同支撑） |
| (b) 空值留空、不写 0 | — | `harness 实测` rel_s=43200 行的空字段数 = **1**（即 `utcg`），其余字段皆非空且无 0 填充 → 逻辑 PASS；但 `utcg` 是 **86401/86401 全空的表头列** → 与 §4.3「只导真实存在的字段」冲突，判 PARTIAL |
| (e) 抽查单元格对账 | 与 `columns.f32`/`ground_obs.csv` 一致 | 见下 |

抽查（我按 `index = offset + pos*86401 + epoch` 直算 `columns.f32`，逐位比对）：

| 字段 | 导出值（harness 抓的 CSV，rel_s=43200） | `columns.f32` 真值 | 偏差 |
|---|---|---|---|
| `ground_obs.el`（星 2） | -39.439353942871094 | -39.439353942871094 | **0.0** |
| `ground_obs.el`（星 1，同历元） | —（未导出该星） | -39.437705993652344 | 参照：三颗星该历元 el 分别为 -39.437706 / -39.439354 / -39.437492，导出值精确命中 pos=1 → 索引映射与星序无误 |
| `ground_obs.az`/`range`/`sun_eclipse.incidence_deg`/`display.brightness`（星 1，43200） | — | 73.11051940917969 / 8992.74609375 / 86.55194091796875 / 1.0 | 与 CSV 源同值（到 f32 精度） |

**最大偏差**：导出值与**交付的 `sim-data/ground_obs.csv`**（f64、9 位有效数字）逐列对照，星 2 在 43200 历元：
- `el` -39.439353942871094 vs -39.4393534 → 5.4e-7 deg
- `az` 73.11709594726562 vs 73.1170973 → **1.35e-6 deg**
- `range` 8993.173828125 vs 8993.17392 → **9.2e-5 km（≈9.2 cm，本项最大）**

结论：导出的数不是伪造的，而是 **f32 渲染缓存的精确副本**（对 `columns.f32` 偏差为 0）；与权威 CSV 的差异全部来自 f32 量化（相对 ~1e-7）。若导出用途要求与交付 CSV 逐位一致，需改从 `ground_obs.csv` 取数或至少注明精度口径——这是可接受的工程选择，但目前 UI 与本文件均未声明，属**需在文档/提示语里点明的精度事实**，不判 FAIL。

其余 PASS 事实：`rel_s = ep * stepSec` 严格整秒（42600/43800 边界精确）；对话框取消、失败反馈（`尚未加载数据`/`所选范围内没有有值的字段，未生成文件`）两条分支都有 toast；导出后对话框自动关闭（harness 实测 `closed=true`）。

## Q3 抽屉编辑不是谎言 —— **PASS**

- `grep -rn btnApply sim/` 全量结果只有 4 处：HTML L626 带 `disabled`、scene-io.js L104（`paintErrors()` 内 `= true`，注释「引擎未接通，无论校验是否通过都不可重跑」）、L111（`setDirty()` 内 `= true`）、L188（`onclick` 空实现 + 注释不会被调到）。**代码里不存在任何 `disabled = false` 路径**，校验通过时（harness 实测：改回 7100 后 `err=''` 而 `dis=true`）也仍禁用。
- 强制点击实测：harness/我的分析均无「已重跑」「已重新计算」迹象；`btnApply` 的 `title` 与 rail 的 `cfgnote`（index.html L478）明确解释「当前数据为固定结果回放，改完不会重算」，抽屉头标注「可看不可重跑」——满足 §4.1「禁用重跑并解释原因」。
- 无服务器话术：`grep localStorage|indexedDB|POST|fetch('/api/scenario` 在 scene-io.js/main.js 命中 0；保存 toast 为「场景已存为文件（浏览器下载，未写服务器）」；加载成功 toast 明说「参数已编辑但尚未应用（重跑引擎未接入）」。

## Q4 加载安全 —— **PARTIAL**

已实测通过的部分（harness）：
- 版本不符/无版本文件：`{"随机字段":1}` → toast「加载失败：场景格式版本不是 serproject-scenario/1（界面保持原状态）」，18 个输入值前后完全相同（`same=true`）；版本校验在任何状态写入之前（scene-io.js L196），该路径**确实是原子失败**。
- 合法文件：把刚保存的快照里 TM0S1.a0 改成 7100.5 回灌 → 输入框变 `7100.5`、`drawerDirty` 显示「有未应用更改」、`btnApply` 仍禁用、`tplus`/`stepSlider` 未被改动。
- 18 个可编辑值 vs `sim-data/meta.json → oe_input`：我独立读出 oe_input = 3 星 × 6 键（TM0S1 a0 6978.137101/e0 4.1e-05/inc0_deg 97.792/raan0_deg 260.833/argp0_deg 270.018/nu0_deg 89.987；TM0S2、TM0S3 同构），harness 逐条对账（相对容差 1e-9）**不一致 0 项** → 与「3×6=18」要求精确相符。

不合格的部分（静态可判，运行时因我的探针未跑通而**未实测**，列为待复审项）：
1. **无字段完整性校验 → 半加载**：`轨道根数_初始` 只判「是非空 object」。只含 2 颗星（或星名写错、多了 `TM0S9`）的合法版本文件会走通全部校验：`renderBody()` 按 `Object.keys(cur.oe)` 渲染，抽屉只剩 12 个输入框，`validate()` 也因只遍历存在的星而**不报任何错**，toast 还是「已加载场景文件…参数已编辑但尚未应用」；此后点保存，`snapshot()` 与 `轨道根数_初始` 就只剩 2 颗星——三星场景被不可逆缩小。§4.2 要求「校验文件版本/字段」，此处字段校验缺失。
2. **失败文案与状态相反**：`cur.oe` 先被整体替换，`renderBody()` 才执行。若某星值为 `null`/非对象，`renderBody()` 抛 TypeError → 进 catch → toast「加载失败：…（界面保持原状态）」，但此时 `cur.oe` 已是坏数据、`drawerBody.innerHTML` 已被重写；若某星缺 `e0` 键，`value="undefined"` 会写进输入框，报错文案变成「TM0S1 偏心率 e₀：不是数字」而值仍留在界面上。两种都不是「保持原状态」。
3. 非数字/超域值不阻断加载（只提示第一条），`has未应用更改` 仍置 true，用户可带着非法值去保存——`snapshot()` 不复核 `validate()`。

## 次要项

| # | 条款 | 结果 |
|---|---|---|
| 1 | 定义域是否物理、越界是否点名 | 大体 PASS：`RE+100=6478.137` 起（> 6378.137+100 ✓）、`i∈[0,180]` ✓；实测报错文案点名到星+字段+定义域：`TM0S1 半长轴 a₀：120 超出定义域 6478.137–50000 km`。两处边界与本指令口径不同：e 上限取 **0.999 闭区间**（口径 0≤e<1 → 0.9999 被拒是过严）、三角度用 `x > max` 判超 → **360 被判合法**（口径 [0,360)）。另外 `a0 ≤ 50000 km` 的上界是工程自创值，指令未给依据，建议改成「仅下界按物理、上界注明为软件防护限值」。 |
| 2 | 脏状态关闭需确认 | PASS（harness 实测：拒绝后抽屉保持打开 `kept=true`，两次确认文案「配置有未应用更改，确定放弃？」，接受后 drawer/mask/body class 一并复位） |
| 3 | 保存 JSON 必备键 | PASS：实测键序 `场景格式版本/场景标识/起算时刻/总时长_s/采样间隔_s/观察站/轨道根数_初始/未提供分组/显示偏好/有未应用更改`，8 项要求全中，无假值（`起算时刻` 取 `bridge.getTimestamp(0)`，桥不可用时写 null） |
| 4 | 无后端不谎称已存服务器 / 用浏览器下载 | PASS（`download()` 用 Blob+`<a download>`） |
| 5 | 设备表真实功耗/发热不得伪装成动态结果 | 基本 PASS：④ 组读 `equipment_duty.csv` 真实 `normal_w/heat_w`，只读渲染、限列 12 台并标注总数。潜在小坑：`d.normal_w || '—'` 会把**真 0 W** 显示成 `—`，`heat_w` 空串显示「未提供」——0 是合法物理值时该写法会误判为空态（未取 equipment_duty.csv 验证是否真有 0 值，列作待复审）。 |
| 6 | 未提供分组措辞 | 轻微不精确：`热控参数（temp_* 列未交付）`——`thermal.temp_main` **已交付但整列为空**，抽屉 ⑤ 正文说对了，快照里这条理由写成「未交付」偏保守失真（不伪造数值，仅口径瑕疵） |
| 7 | ② 组 `太阳翼展开轴 ±Y_B（结构方案给定）` | 未验证：本轮预算内未能在 `sim-data` 里定位该取值出处（manifest 的 `sun_eclipse.array_normal_*` 是逐历元数据，不能直接支撑「±Y_B」这句结构断言）。请实施方补出处或改为「未提供」。 |
| 8 | 死代码 | `scene-io.js` 的 `fmtNum()` 从未被调用；`cur`/`base` 无星名/键白名单常量可复用（正好用于修 Q4-1） |

## 验收台（harness）弱点

已读 `if PHASE == "phase-04":`（L697-866）全部断言。**当前 phase-04 记录 0 FAIL，但下列断言在现有实现下不可能失败或覆盖不到要害**：

1. **`check("导出只含真有值的列（能源/热控整列空，不进表头）", all(c.startswith(allow) or c in ('rel_s','utcg') for c in body['header']))`**：白名单里显式写进了 `utcg`——正是实现自己硬编码的那个恒空列。这条断言字面意思就是「只导真有值的列」，却对被测系统唯一的恒空列**预先豁免**；实现即使再塞一个空列，只要前缀是 `ground_obs.` 也一律放行。此外 `all()` 对空表头退化为真（`files==1` 只保证有文件，不保证有数据列）。→ 应改为「逐列统计空值率，任何空值率 100% 的列都判失败」，并断言列数 == manifest 中该区间非 NaN 的列数。
2. **`check("格式不对的文件报错且不改变界面状态", badload['same'] and '加载失败' in toast)`**：`same` 比较的是 input 值列表的拼接；`drawerBody` 为空时两侧都是 `''` → 真。且只测「版本缺失」这一最外层闸门，完全碰不到 Q4-1/Q4-2 的半加载路径（缺星/缺键/值为 null/非数字四类合法版本非法字段一例未测）。→ 必须补这四类，并断言「星数==3、键集合==OE_FIELDS、全部数字且合法」三者同时成立。
3. **`check("场景标识带进抽屉标题", scene not in ('','未加载'))`** 与 **`check("…如实标「未提供」…", '未提供' in txt)`**：都只验证「实现自己写进 DOM 的字符串非默认值」，属同义反复——文案哪怕与数据事实相反也判 PASS。真正需要的外部对照（manifest 的 power/thermal NaN 率、`battery_soc_pct` 不存在）在验收台里一次都没出现。→ 应从 `/sim-data/render/manifest.json` 取真值做双向对照。
4. **数值一致性断言是自参照**：`导出 CSV vs 界面卡片读数`（`el@43200` vs `#tgtList` 卡片 `-39.4`）两侧都读同一个 f32 缓存，索引映射若整体错位（例如把星 2 当星 1）会**互相抵消**而判绿。本轮正是我从 `columns.f32` 反算才发现「当前选中星其实是 TM0S2」，harness 从未断言导出文件对应哪颗星。→ 至少断言文件名里的星号 == `getSelectedSat()` == 比对所用的真值 pos。
5. **残留定时依赖**：抽屉四入口与 18 输入两处探针已改成 `until()` DOM 轮询（90ms/5-6s 上限），不再靠固定 sleep，这部分改造有效；**仍剩** `nap()=260ms`（每轮开关抽屉之间）、`ev("cfgOrbit.click()"); time.sleep(0.4); shot(...)`（截图不等渲染完，可能拍到旧内容）、`time.sleep(0.5)/0.4`（读 blob 前）、以及共用 bootstrap 里导航后的 `time.sleep(6)`。blob 读取本身靠 `awaitPromise`，所以 0.5/0.4 只是伪装成「等待」，真实风险在 0.4s 的截图探针。
6. **无「保存/导出不改动时钟·相机·选中星」断言**：`场景 JSON` 里带 `选中目标/视图/图层`，导出路径又走 `getState()`，Phase 4 却没有任何一条断言这些状态在保存/导出前后不变（本轮我仅靠 harness 的 `tplus` 采样与静态读码确认没被改）。
7. 覆盖面缺口：`恢复默认`、`取消`、`expRange=win + scope=one` 组合、`i16` 列（`att_mode`/`mode`）的空码留空行为、以及 §4.4「取消须实际操作测试」中的「取消」一例未测。

## 未能验证（请实施方或下一轮补齐）

- 我自己的浏览器探针未跑到 attach，故以下仅有 harness 实测或静态结论：③⑤ 组 DOM 细节、四类「合法版本 + 非法字段」文件的半加载后果（Q4-1/Q4-2 是我读码推演，未运行复现）、`i/e/角度` 越界文案（只实测了 a0）、`恢复默认` 后 18 个值是否等于 `meta.oe_input`。
- 全程导出我未逐单元格重算 86401 行（仅 rel_s 边界、el/az/range/incidence/brightness 抽查 + 每列空值计数）；未验证 `scope=all` 三个文件是否分别对应 1/2/3 星且互不串列。
- `② 太阳翼展开轴 ±Y_B` 的出处；`equipment_duty.csv` 是否含 0 W 条目（关系到次要项 5 的 `|| '—'`）。
- 并发说明：本轮 harness 与我的探针先后运行（各取空闲端口 9400+/9600+），未出现桥不可用；我方的探针失败原因见「诚实声明」，不计入被测系统缺陷。

## 复审放行条件（最小集）

1. `exportRows`：把 `utcg` 纳入「整列为空即不导出」的判定，或改为从 `ground_obs.csv` 取真实 UTC 串；并在 `sim-data` 精度口径上注明「数值来自 f32 渲染缓存，与交付 CSV 最大偏差 ~9e-5 km」。
2. `loadFile.onchange`：加字段完整性校验（星集合 == 数据里的 3 星、键集合 == 6 个 OE 键、全部为有限数且落在定义域内），任一不满足即在**改动 `cur.oe` 之前**报错返回；失败文案不得再宣称「界面保持原状态」除非确属原状态。
3. 验收台补：恒空列检测（空值率 100% 即 FAIL）、四类非法字段文件的半加载用例、manifest 双向对照 未提供 文案、导出星号与真值 pos 一致性、保存/导出前后时钟/相机/选中星不变量；并把截图探针的固定 sleep 改成 `until()`。
4. 补 `±Y_B` 出处或改「未提供」；`未提供分组` 的热控措辞改为「thermal 4 列整列为空」；`normal_w`/`heat_w` 的真 0 与空态区分（`?? '—'` 取代 `|| '—'`）。

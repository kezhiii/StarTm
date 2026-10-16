# Phase 4 / Phase 5 —— 第四轮返工后独立审查（静态轮）

- 审查者：独立验收子代理（只读，不改任何工程文件，不做 git 操作）
- 日期：2026-10-16
- **方法声明：本轮未打开浏览器，未调用任何 CDP / browser-use / harness.py，也未做重 I/O 数据扫描。**
  所有运行数据引用自 **2026-10-16 的 `phase-04-test.md` / `phase-05-test.md`**（文件 mtime 10:29:48 / 10:30 本地 = 02:29:48 UTC，
  与 `test.md:96` 的下载文件名 `天幕场景_20260913040000…` 的 UTC 时钟一致，即用户所说的「02:31 前后」）。
  我另用 mtime 独立对过账：被测代码最后修改时间 `scene-io.js 10:13`、`panels.js/main.js 10:06`、`index.html 10:07`、
  `harness.py 10:26`，**全部早于 10:29/10:30 两次跑测**，所以这两份记录确实出自当前代码树。
- 依据：总指令 Phase 4（L178-198）/ Phase 5（L200-211）、V0.3 §5.4/§9/§10/§11/§12、
  上一轮 `phase-04-review.md`（复审放行条件 1-4）、`phase-05-review.md`（D1-D8）、`FINAL_REVIEW.md`、`FINAL_ACCEPTANCE.md` §2b。

## 结论

| 阶段 | 判定 | 一句话理由 |
|---|---|---|
| **Phase 4** | **有条件 PASS** | 上一轮两条硬缺陷（`utcg` 恒空、加载半加载）在代码与实测两处都已真修好，空态与禁用重跑诚实；条件是导出时间基守卫的 `skipped` 从不上界面、且该分支在本数据集里一次都没触发（E1），以及验收台无法区分「正确的拒绝理由」（E2）。 |
| **Phase 5** | **有条件 PASS** | 15 个 token、圆角档位、退役旧调色板绝迹、选中态与三星身份色的单一真源都成立且有正反两向断言；条件是 canvas 字号拦截器覆盖不到 iframe 内的 sprite 文字（E3）、仍有 20+ 处 off-token 字面量（E10）。 |

## 逐条判定

| # | 判定项 | 结论 | 证据（文件:行号 / test.md 实测 / 截图） |
|---|---|---|---|
| 1 | `checkScenario` 的基准对象 | **PASS** | `scene-io.js:57` 取 `Object.keys(base || {})`，注释 55-56 明确写了「写成 `base.oe` 会永远 undefined」；`base` 在 `scene-io.js:166` 由 `meta.oe_input` 深克隆。两条坏文件被**正确理由**拒：`phase-04-test.md:105` toast=「卫星集合对不上：基准是 TM0S1/TM0S2/TM0S3，文件是 TM0S1/TM0S2」、`:107`=「TM0S3 缺 半长轴 a₀（a0）或其值不是数字」——都不是「还没有基准场景」（`scene-io.js:58` 那条分支未被触发），且 `:106/:108` 记录 `n:18`+`same:true` 证明界面一字未动。校验发生在任何写状态之前（`scene-io.js:227-230`），`confirm` 在其后（229）。弱点见 E2。 |
| 2 | 导出 `utcg` 的 provenance | **PASS** | `panels.js:717-722`：有 `utcg` 列就用列（`hasField` 走 `loader.js:98-109` 真查 manifest 列清单），否则 `hooks.utcAt(ep)` → `main.js:373` → `bridge.getTimestamp(i)` → `playback-manager.js:1113` `appState.csv.timeIndices[i]`（星历 CSV 第一列原文），末路 `t \|\| ''` **留空，无任何硬编码兜底**。我独立 `head` 了 `sim-data/projection/orbit_14col.csv`，首行 timestamp=`20260913040000`，与 `phase-04-test.md:115` 样本逐字相同；`:116` 前 4000 行非空 4000 条。harness 写死的期望 t0（`harness.py:1043`）与顶栏 UTC 是两条独立路径：`test.md:64` T+12:00:00 ↔ `2026-09-13 16:00:00`，截图 `phase-04/02-1792-drawer-open.png` 右上角同值 → 不是自证。 |
| 3 | 时间基一致性守卫 + `skipped` 上界面 | **FAIL（局部）** | 守卫本身正确：`panels.js:698` 用 `stepOf()`（`:502-506`，由数据自己的 `lastRelS/(nEpoch-1)` 反推）与主文件比，容差 1e-6，不同即整列跳过。**但 `skipped` 是死返回值**：`panels.js:730` 返回，`main.js:533-542` 只读 `r.cols`/`r.text`，toast 全文是「已导出 N 颗星 × M 个字段」，用户完全不知道少了哪几列。且本数据集 4 个导出源文件在 manifest 里全是 `stepSec=1.0`（我读 `sim-data/render/manifest.json`），60 s 的 `orbit_itrf`/`formation_rtn` 根本不在导出映射里 → 该分支**运行时零触发、零断言**（两份 test.md 全程无 `skipped` 字样）。见 E1。 |
| 4 | 诚实空态（红线） | **PASS** | 取值层按结构化 `kind` 分支：`panels.js:98-113`（`missingField`→「字段未提供」/`emptyValue`→「暂无数据」/`notCalculated`→「尚未计算」/`notConnected`→「未接入」），`sumOf()`（`:117-126`）任一列缺值即整体不可得，明确不拿 0 顶。实测：`phase-05-test.md:77` 能源四格=「暂无数据/暂无数据/字段未提供/暂无数据」、热控四格全「暂无数据」，与 manifest 里 power 5 列、thermal 4 列全 NaN 的事实一致；抽屉 ③⑤ 组 `inputs=0`+`miss=1`（`phase-04-test.md:79`、`:82`），文案点名「power 的 5 列整列为空，battery_soc_pct 列不存在」「thermal 的 4 列整列为空，逐测点 temp_ 列未交付」；`snapshot()` 如实记 `未提供分组`（`:99`）。`应用并重新运行` 恒禁用：`scene-io.js:134`+`:141` 两处无条件 `=true`，`index.html:627-629` 带 `disabled` 与解释性 `title`，实测 `:87/:90/:101` 三种状态下都 `true`。截图 `phase-04/08-1792-rail-config-block.png`：左栏「SOC 字段未提供 / 温度 暂无数据」、对比表整块「暂无数据」、底部说明「参数可看可改，但『应用并重新运行』要等仿真计算引擎接入…改完不会重算」。唯一瑕疵：这些「未提供」理由是写死的字符串而非数据推导（E5）。 |
| 5 | Phase 5 颜色纪律 (a)(b)(c) | **PASS** | (a) 我 grep 全仓 `7fe3d6\|6fa8dc\|e8a33d`：命中**只在** `docs/`、`outputs/`、`*.diff`、`harness.py.bak*` 与注释里；`sim/` 与 `StarTM/web/` 的 js/html/json/css **0 命中**（`4488ff` 仅剩旧 App 自己的 `config.js:52 ORBIT_RING_MAT`，而 `third-person.js:84` 每帧把它覆盖成身份色）。(b) `selRing=28cfc8`（`phase-05-test.md:94/:100`）＝`sat-model.js:52` `SELECTION_HEX`＝`config.js:22`＝`index.html:19` `--border-active`，且不撞三色；截图 `phase-04/08` 里选中环是青绿、而环上的星点是蓝/琥珀，肉眼可分。(c) `panels.js:6` `['#38a9ff','#29d7d0','#ffb83f']` 与 `config.js:18` `[0x38a9ff,0x29d7d0,0xffb83f]` 数值一致，`config.js:16-17` 有明确注释约束（「必须与 sim/js/panels.js 的 SAT_COLORS 完全一致」），`formation-inset.js:4/7` 直接 `import { SAT_COLORS }` 不再自带一份，`index.html:37-39` 由 `--accent-*` 派生；机械核对靠 harness 同一个 `want` 常量同时卡 DOM 与三维两侧（`harness.py:1184-1190`）。 |
| 6 | 字号与小窗（canvas 拦截器是否真能失败） | **有条件 PASS** | 拦截器装在 `harness.py:1218-1222`（顶层文档 `CanvasRenderingContext2D.prototype` 的 `font` setter），**时序正确**：安装后才点 formation/orbit/attitude 三个标签并 `pump()` 逼出重绘（`:1223-1227`），`chart.js:29` 与 `formation-inset.js:88/91/102` 的赋值都在安装之后发生，实测最小 11 px（`phase-05-test.md:104`）。但有两个真实盲区：① **iframe 是另一个 realm**，`StarTM/web` 里的 canvas 不被覆盖，而三维标签正是 iframe 里画的——`sat-model.js:70-80` 用 42px 字画进 64px 高的贴图，`third-person.js:54` 把 sprite 世界高度定为 16 屏幕像素 → 有效字号 ≈16×42/64≈**10.5 px**，若 §11.3 的地板适用于场景内标签，这一条恰好漏网；② `__minCanvasFont` 初值 99、断言只有 `cfont>=11`（`:1233`），「一次都没赋值」会退化成恒真（本轮 11 证明它确实 fired）。`measureText`/`FontFace` 路径本身不影响字号，风险在「不设 font 直接 fillText 走默认 10px」——目前四个绘制点都显式设了 font。 |
| 7 | 断言可失败性抽查 | **部分合格** | 真能双向失败的：`harness.py:1032`（前 4000 行非空计数 ≥3990）、`:1041-1044`（14 位紧凑格式 + 逐行 +1s + 起点）、`:1189/:1190/:1194`（严格数组相等，空集即 FAIL）、`:1209`（像素取色同时要求「三色都在」与「旧调色板一个都不在」）、`:1168`（距离单调）、`:1063`（窗口导出边界）。**弱点**：见 E2（`why` 定义了却不用）、E3（99 恒真）、E12（`all()` 空集退化、文案自证、固定 sleep 截图）。 |
| 8 | 上一轮 Phase 4 放行条件 1-4 对账 | **3 修 1 半修** | 条件 1 `utcg` 已改走桥时间戳（判定 2）；条件 2 字段完整性前置校验已完成（判定 1）；条件 4 三项全修：e 改开区间（`scene-io.js:13`）、角度 360 判超（`:15-17`+`:41`）、a₀ 去掉自创 50000 上界（`:12`）、`normal_w` 真 0 不再显示成 `—`（`:109`）、② 组「太阳翼展开轴」改成如实的「未提供」（`:98`）；**条件 3（验收台）只补了 utcg 与坏文件两条**，恒空列检测、导出星号与真值 pos 一致、保存/导出前后状态不变量仍缺（E12）。 |
| 9 | 上一轮 Phase 5 D1-D8 对账 | **已修** | D1/D2 字号 11px（`chart.js:29`、`formation-inset.js:88/91`）；D3 小窗 import（`formation-inset.js:4/7`）；D4 选中态 wash 全部改 `rgba(40,207,200,.N)`（`index.html:207/253/354/361/390/392`，但见 E10）；D5 本体明确为状态色通道并有文字说明（`third-person.js:260-261`、`index.html:470`、`phase-05-test.md:103`）；D6 选中环走 `SELECTION_HEX`；D7 新增 ctx.font 记录器与小窗像素取色；D8 字高 `0.26→0.31`（`main.js:267`，实测 15.2px，`phase-05-test.md:104`），**轴色三项未动**（E10）。 |
| 10 | ②④ 分组与 TAB_GROUPS 归属 | **PASS（一条张力项）** | 抽屉五组严格按 V0.3 §9 顺序（`scene-io.js:89/95/101/106/115`，实测 `groups:5`，`phase-04-test.md:79`）；`TAB_GROUPS`（`panels.js:54-61`）把 ②④⑤ 归地面页、⑥→能源、⑦→热控、③⑩→姿态、⑨→轨道，`#paneGround`（`index.html:566`）承接地面页行集、`#selStrip` 在非编队页显示（`panels.js:243`）。张力项：`panels.json` 的 ① 组名叫「地面显示图形」，内容却是三条边长 + 旋转相位，被 `panels.js:55` 归进**轨道页**——与「轨道页只放轨道量」的口径有出入（Phase 2 范围，仅记录不判 FAIL）。 |

## 缺陷清单

| # | 严重度 | 位置 | 现象 | 期望 | 建议修法 |
|---|---|---|---|---|---|
| **E1** | 中 | `panels.js:698/730` + `main.js:533-542` | 时间基守卫跳过的文件只塞进 `skipped` 数组，`expGo` 从不读它，toast 只报「N 颗星 × M 个字段」；用户不知道列被静默删掉。该分支在现数据集零触发、零断言。 | §4.3「只导真实字段」+ 指令「成功/失败都必须有反馈」要求把剔除说出口 | `main.js:542` 的 toast 追加「（已跳过与主文件时间基不同的：<files>）」；harness 加一条构造 60 s 源进入导出映射、断言 `skipped` 非空且界面有字样的用例 |
| **E2** | 中 | `harness.py:989-1001` | `for name, obj, why in (…('只有两颗星的场景', two, '卫星集合对不上'), ('缺 a0…', miss, 'a0'))` 里的 **`why` 从未被使用**，断言只判 `'加载失败' in toast`。若 `base` 再退化成空（上一轮那个 bug），toast 会变成「加载失败：还没有基准场景…」，界面同样不变 → **断言照样 PASS**，回归不会被抓到。 | 坏文件必须被**正确的理由**拒 | 断言加 `why in rej['toast']`；再补一条「基准为空」用例断言文案恰为「还没有基准场景」 |
| **E3** | 中 | `harness.py:1218-1233`；`sat-model.js:70-80` + `third-person.js:54` | canvas 字号拦截器只装在顶层文档，iframe（三维画面）是独立 realm 不受覆盖；而三维标签的有效字号按算术约 **10.5 px**（42/64 贴图 × 16 屏幕像素）。另外 `__minCanvasFont` 初值 99，`cfont>=11` 在「一次都没赋值」时恒真。 | §11.3 的 11px 地板要覆盖所有文字绘制路径 | 同时给 iframe 的 `CanvasRenderingContext2D.prototype` 装记录器（`frame.contentWindow`），并输出赋值次数计数器；对 sprite 标签按 `16 × 42/64` 反算屏幕字号并断言 ≥11（或把 `h` 提到 18px） |
| **E4** | 低 | `scene-io.js:91/197`、`main.js:333`、`harness.py:951` | 「总时长」用 `rows_per_sat`（86401）当秒数，顶栏显示 `共 24:00:01`；真实跨度是 (86401−1)×1 s = 86400 s。harness 把 86401 写进期望值，缺陷被固化成断言。 | 时长是元数据，off-by-one 也是错 | 统一改 `(rows-1)*step`；harness 期望同步改，并注明口径（历元数 vs 时长） |
| **E5** | 低 | `scene-io.js:102/116/201` | ③⑤ 组的「power 的 5 列整列为空…」「thermal 的 4 列整列为空…」与 `snapshot()` 的 `未提供分组` 都是**写死的中文字符串**，不来自 manifest。今天恰好与事实相符，能源/热控时序一旦交付，抽屉与保存的 JSON 仍会说「未提供」。 | 空态理由应由数据推导 | 用 `hasField()` + 一次列级非空抽样生成理由文案；`未提供分组` 由同一函数产出（上一轮放行条件 3 的「manifest 双向对照」至今未做） |
| **E6** | 低 | `panels.js:670-678` | `scenarioSnapshot()` 是死代码（保存实际走 `scene-io.js:192` 的 `snapshot()`），但里面 `数据版本: cfg.display.paramVerHint \|\| 'synth'` 在 `display.json` 已无该键时会伪造 `'synth'`，`场景: '三星编队示例'` 也写死——Phase 0 删掉的「参数版本」死字段留着一条可复活入口。 | 不留可伪造版本的代码路径 | 直接删除该函数（或改为委托 `scene-io.snapshot()`） |
| **E7** | 低 | `main.js:515` | 保存成功 toast 是「场景已存为文件（浏览器下载，未写服务器）」，**不含文件名**；V0.3 §10 L595 要求 toast 显示文件名或位置。导出 toast（`:542`）同样只有数量没有文件名。 | 反馈里带文件名 | toast 复用 `name` 变量与 `TM0S${sat}_时间序列_${tag}.csv` |
| **E8** | 低 | `index.html:633-645` | 导出对话框只有「目标 / 时间范围」两个下拉，无字段选择；V0.3 §10 L607 与指令 4.3 要求「可选真实存在的字段」。当前是自动挑非空列（实现更保守，但少了用户可控项）。 | 补字段多选（默认全勾非空列） | 用 `exportRows` 已算出的 `cols` 渲染 checkbox 列表，按选择过滤 |
| **E9** | 低 | `panels.js:704-709` | 「列是否真有值」只在区间内等距抽 64 个历元。86401 历元下抽样间隔≈1350 s，一段只在数百秒内有效的列会被判成整列空而**静默消失**。 | 稀疏列不该被抽样噪声删掉 | 抽稀只用于「是否全空」的初判，命中为空时再对整列做一次 `some()` 复核；或在 toast 里报出被剔除的列名 |
| **E10** | 低 | `index.html:49/108/133/147/181/192/214/225/258/273/280/324/352/360/364/380/381/382`、`chart.js:112`、`main.js:256` | 颜色纪律仍有 off-token 字面量：index.html 18 处非 token 十六进制（`#eef5fb/#a2bad0/#9fb6cc/#9ecbff/#c78bd8`…）、超限点 `#d8604b`（§11.2 的「实际超限」应给 `--status-error`）、XYZ 轴色 `#ff6b6b/#6bd0ff/#8ef0a8`（上一轮 D8 只修字号没修色）、6 处 `rgba(40,207,200,.N)` 是 `--border-active` 的第二份拷贝（token 一改即分叉）。验收台只比 15 个 token 是否到位，不比「取色是否都来自 token」。 | §11.1「唯一的取色来源」 | 把 wash 收成一个 `--sel-wash` token、超限点用 `--status-error`、轴色补两个 token；harness 增加「计算样式里出现的十六进制必须落在 token 集或其 alpha 派生内」的白名单审计 |
| **E11** | 低 | `scene-io.js:91` | `ro('仿真时长', (meta?.rows_per_sat ? … : null) + ' s', '')`：meta 未载入时拼出字符串 `"null s"`，`?? '—'` 拦不住（它已是非空字符串）。 | 空值走空态 | 把 `+ ' s'` 移进三元两支，或先判 null 再传 `'—'` |
| **E12** | 低 | `harness.py:1017/1021/1045-1051/942/933-935/879/916/944/950` | 断言弱点集合：① `emptyTail` 算了但从不 `check`，「恒空列即 FAIL」这条上一轮要求没落地；② `all(c.startswith(allow) …)` 对空表头退化为真；③ `all(… for c in same['meshes'][:3])`（`:1212`）对空数组退化为真；④ 导出星号与真值 pos 两侧同源（卡片与 CSV 都读同一份 f32 + 同一个 `selectedSat`），索引整体错位会互相抵消，且从未断言文件名里的星号 == `getSelectedSat()`；⑤ `sv['state']`（`:942`）取了「选中星/时刻」却无「保存·导出前后不变」断言；⑥ 截图前仍是固定 `time.sleep(0.4)`（`:933-935`），可能拍到旧内容；⑦ `:916`（`'半长轴' in err and '定义域' in err`）、`:879`（`'未提供' in txt`）、`:944/:950` 属「拿实现自己写的字符串匹配自己」，文案改词即假 FAIL、文案与事实相反仍 PASS。 | 断言要能被事实推翻 | 逐条按上述补：空值率断言、`len(header)>2`、`len(meshes)==3`、文件名星号 == `getSelectedSat()`、状态不变量、`until()` 代 sleep、错误文案改判「消息里含被改字段名 + 数值 120 + 下界 6478.137」 |

## 只有运行时才能定案（请浏览器审查代理补跑）

1. **E3 的实际后果**：三维卫星标签 sprite 在 1792/1366/1280 三档下的屏幕字高是否 <11px（我这轮只能给算术 ≈10.5px，需要像素级量法：截图裁剪 + 字形高度，或在 iframe 里量 `lb.scale` 反算）。
2. **E1 的真实触发**：构造一份 60 s 时间基的源进入导出映射（或临时改 `manifest.stepSec`），确认 `skipped` 非空、导出确实少列、界面是否说出来。
3. **≤1280 右栏转抽屉后的像素冲突**：`index.html:406-409` 把小窗挪到 `left:92px`，本轮 test.md 只测了小窗与 `#console`、与 `#axes` 的重叠（`phase-05-test.md:112/116/120` 均 0），**没测与 `#rail` 的重叠**，也没断言 `#console` 计算样式确为 `absolute`。
4. **`恢复默认` / `取消` 两条按钮路径**：`scene-io.js:211-216` 的恢复默认是否把 18 个值精确还原到 `meta.oe_input`（上一轮列为缺口，本轮 harness 仍未加）。
5. **`expRange=win` + `scope=one` 组合**、以及 `scope=all` 三个文件是否分别对应 1/2/3 星且不串列。
6. **真实拖窗（非 `setDeviceMetricsOverride`）后的 Three.js resize 跟随**、以及**全屏**（`FINAL_ACCEPTANCE` §5 第 7 项至今 NOT-TESTED）。
7. **独占环境下的播放 fps**（`phase-05-test.md:29/:78` 的 60.0/60.5 是本机无并发时的数字，与上一轮 4.0 tick/s 的争议同源，只能实测定论）。
8. **`equipment_duty.csv` 是否真含 0 W 条目**（关系到 `scene-io.js:109` 的 `=== ''` 判空是否被实际行使过）。

## 一句话总评

第四轮把上一轮点名的两条硬缺陷（`utcg` 恒空、加载半加载）真正修到了代码与断言两层，`base` 的基准对象、utcg 的数据出处、空态与禁用重跑的诚实性、以及 Phase 5 的颜色纪律都经得起独立复核；剩下的问题集中在**「守卫写了但界面不说」（E1）与「断言能过但抓不到回归」（E2/E3/E12）**这一类方法性缺口，没有发现任何伪造数值。

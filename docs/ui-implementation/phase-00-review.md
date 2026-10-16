# Phase 0 独立验收评审（天幕卫星仿真前端 · 基线核验与阶段一收尾）

评审人：独立验收子代理（未参与实现，未改动任何工程文件；本文件为唯一产出）。
仓库：`E:\project_code\serproject`，分支 `sim-system`，HEAD `a8f7841`，工作区含未提交改动。
判定方式：以源码、数据文件、真实截图、CDP 测试记录与 `phase-00.diff` 交叉核对，不接受实现方自述。

## 关键事实澄清（先于逐条判定）

- `phase-00.diff` 实际只含 **2 个文件**（`sim/index.html` +179、`sim/js/main.js` +15，合计 117 增 77 删），与 `git diff HEAD -- sim/index.html sim/js/main.js` 的 stat 完全一致。**它不含 `sim/js/store.js`**，且 `git diff HEAD -- sim/js/store.js` 为空——store.js 在本阶段没有任何改动。任务书"覆盖 store.js"的说法与磁盘不符。
- HEAD `a8f7841`（"P0 阶段"）里的 `sim/` 是**旧的固定浮层布局**：`#stage{position:fixed;inset:0}`、面板 `position:fixed` 覆盖全屏画布、有 `#kvSpan`/`#kvVer`/`#groundReadout`（后者仅死 CSS，无元素无 JS 引用）、`app-context.js` 用 `window.innerWidth/innerHeight`。
- 因此"阶段一"（三行/三列 Grid、`.scene` 容器、`app-context.js` 的 ResizeObserver）**从未提交**，全部以未提交改动形式与 Phase 0 混在同一工作区 diff 里。`IMPLEMENTATION_LOG` 称阶段一"已由用户验收"，但它并不在 HEAD 中。这是流程/留痕问题，不影响源码正确性。

## 逐条判定表

| # | 需求 | 结论 | 依据（具体证据） |
|---|------|------|------|
| 1 | 阶段一完好且未重做：三行/三列 Grid；iframe+浮层在 `.scene` 内；`app-context.js` 用 ResizeObserver 观测 `#canvasContainer` | **PASS** | `phase-00.diff` L28-32（`.app` grid-template-rows、`.main` grid-template-columns 三列）；L245-262（`<div class="scene" id="scene">` 内含 `#stage`/`#vignette`/`#sceneTools`）；`StarTM/web/core/app-context.js:68-80`（`resize()` 用 `container.clientWidth/Height`，`new ResizeObserver(resize).observe(container)`，L80 立即 `resize()` 覆盖初值）；`StarTM/web/app.js:106` 传入 `canvasContainer`。截图 `01/03/04/05` 五区分列可见；测试 `canvasMatchesScene=true`（canvas=[1042,657] vs scene=[1043,658]，三视口+收起两栏均成立）。 |
| 2 | 卫星列表下 4 个禁用 2×2 入口（轨道/姿态/能源/热控），仅占位无表单，禁用态明确 | **PASS** | `sim/index.html:362-373` 四个 `<button class="cfgc" disabled aria-disabled="true" title="…真实原因…">`，各含 `.t` 标题 + `.s`「待接入计算引擎」；L374 `.cfgnote`「当前数据为固定结果回放…」；CSS L136-141（`border:1px dashed`、`color:var(--dim)`、`cursor:not-allowed`）。无任何 `<form>/<input>`。测试 `cfg` 四项 `dis=true,h=64,title=true`（读的是真实 `.disabled` DOM 属性）。 |
| 3 | 删除恒 `--` 的"参数版本"，仅用真实元数据替代；逐项溯源 | **PASS** | `#kvVer` 已从 HTML 删除（`git show HEAD` 有、工作区无；测试 `deadVerField=false`）。新字段：`kvMission`「TM-V0-SIM · FreeDrift-Synthetic」← `sim-data/preview/time_ident.csv` 第 5 行 `mission,mode` 列（`main.js:259-261` 经 `getValue` 读取）；`kvMeta`「3 颗 / 1 s / 86401 历元」← `meta.json` `sats:3`、`rows_per_sat:86401` + `bridge.getStepIntervalSec()`（`main.js:255-256`，非硬编码）；`kvScene` 顶栏覆盖为真实 `mission`。`time_ident.csv` 确有 `param_ver=synth-v1` 列但**未展示**，无假版本号；无假场景切换器。`kvKind`「固定结果回放」是 `main.js:257` 静态标签——属实（数据确为预生成回放），非编造。 |
| 4 | 不得实现后续阶段功能（配置表单/新曲线/新 3D） | **PASS** | diff 仅布局+占位禁用按钮+元数据填充；`sim/config/display.json` 未改（仍 3 张图：chEdge/chDrift/chSun）；无新表单、无新曲线、无新 3D 特性。`app-context.js` 的 ResizeObserver 属阶段一（需求 1 要求项），config.js/views/* 的在途改动属下一阶段，已按要求排除。 |
| 5 | 不破坏既有行为（时钟/加载/选星/`orbitAt()`/`setLayer()`/四态缺失/导出）；`#kvSpan` 删除后无残留引用 | **PASS** | 全 `sim/` grep：`kvSpan` 零命中（唯一引用 `main.js:251` 已删）；`#kvScene` 元素存在于 `index.html:328`，`main.js:262` 写入不会抛错。`orbitAt` 接线 `main.js:301`、`setLayer` 经 `applyLayer` `main.js:161-166`、导出 `main.js:419-422`。测试：加载示例→播放→暂停→拖 43200→选 TM0S2 全通过，选星不重置时间；`控制台无 error []`、`无未捕获异常 []`（证明删 `#kvSpan` 未使"加载示例"抛 TypeError）。 |
| 6 | 卫星 ID 保持 `TM0S1/2/3`（数字 0），不得改字母 O | **PASS** | `panels.js:156,173,313,380`、`main.js:368,402-403` 均为 `TM0S${id}`；截图 `01/03/04/05` 左栏与表格可见 "TM0S1/TM0S2/TM0S3"（数字零）。 |
| 7 | 不得伪造能源/热控数值 | **PASS** | 测试右栏实测：`power` 四项、`thermal` 四项 hero 全为「暂不可用」；截图 `01` 能源/热控对比表 电池SOC/发电功率/用电功率/关键温度 全「暂不可用」，左栏卡片 SOC/温度 显示「未计算」。`panels.js:80-118` 四态逻辑（未接入/尚未计算/暂不可用/数据异常）完好，`sumOf` 任一列缺值即整体不可得、不以 0 顶。 |
| — | Git 安全：无 commit/reset/checkout/clean/stash/切分支；`sim-data/`、`sim/config/`、`sim/tools/` 未改 | **PASS** | 分支 `sim-system`、HEAD `a8f7841` 不变，`1c4d60f`（orbitAt/setLayer）仍在。`git status --porcelain -- sim-data sim/config sim/tools` 输出为空（三目录全净）。工作区改动仅 `sim/index.html`、`sim/js/main.js`（本阶段）+ `StarTM/web/core/app-context.js`、`StarTM/web/modules/config.js`（阶段一/下一阶段）。未跟踪项为评审产物 `docs/ui-implementation/`、`outputs/`、`.claude/` 等，未污染受保护数据目录。 |

## 阻塞问题

无。

## 高优先级问题

无。

## 普通问题（非阻塞，建议后续阶段处理）

1. **测试留痕与任务书不符**：`phase-00.diff` 不含 `store.js`（任务书称含），且阶段一改动未提交、与 Phase 0 混在同一工作区 diff，导致"Phase 0 精确变更集"无法与阶段一干净切分。建议把阶段一单独提交或在日志中如实标注其未提交状态。
2. **两处断言偏弱（欠测而非误报）**：
   - `场景标识来自真实数据` 只判 `mission` 非 `--`/空（`harness.py:131`），换成任意非空假串也会 PASS；本次靠我独立比对 `time_ident.csv` 才确认值真实。建议改为断言等于 CSV 实际值。
   - `卫星/采样/历元` 只 substring 匹配「3 颗」「86401」（`harness.py:133`），未校验「1 s」步长来源。
   结论仍为真，但测试本身自证力不足。
3. **竖排检测器覆盖面有限**：`harness.py:89-91` 仅扫 `#viewTabs/#detailTabs/#rate/.btn/.ghostbtn/.hd/.tag` 且要求 `height>44 && width<70`。该窄化对"控件标签被挤成逐字竖排"这一典型回归是有效的（窄高元素能被抓到），且 `.cfgc` 本就不在选择器内、其宽度约 135px 也远大于 70，故移除 `.cfgc` 不会掩盖真实竖排——**窄化合理，非自我认证**。但它检测不到选择器之外或"宽而高"元素的竖排。本次以 6 张真实截图独立确认三视口无逐字竖排，故判 PASS。
4. **`kvKind`「固定结果回放」为静态字符串**（`main.js:257`）：内容属实、符合需求 3 允许的"固定结果回放标记"，但严格说并非从数据读出；可接受，记录备查。
5. **顶栏 `#kvScene` 加载前静态文案**「三星编队示例（合成数据）」（`index.html:328`）：为描述性占位、属实，加载后被真实 `mission` 覆盖。非编造。
6. **截图未拍到 2×2 配置块**：`01/03/04/05` 左栏 `场景配置` 标题在折叠线下方，禁用按钮实体未入镜，其禁用外观仅由源码+DOM 证明。建议补一张滚动到配置块的截图。

## 通过项（小结）

- 需求 1–7 全部 PASS；Git 安全 PASS。
- 无编造数据：所有展示值可溯源到 `meta.json` / `time_ident.csv` / 桥；能源热控一律「暂不可用」，无假数值、无假版本号、无假场景切换器。
- 无后续阶段越界：未加表单/曲线/3D 特性。
- 未破坏既有行为：`#kvSpan` 删除后无残留引用，"加载示例"无 TypeError，播放/暂停/拖动/选星/切视角/收起两栏均实测通过，控制台无 error、无未捕获异常。
- 真实截图证实五区不重叠、`.scene` 实得 1043×658（1792）/698×562（1366）/抽屉态（1280）、画布逐像素贴合容器、无逐字竖排。
- 卫星 ID 保持数字零 `TM0S1/2/3`。

允许进入下一阶段：是

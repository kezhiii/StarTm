# Phase 5 独立复核（对抗性）

复核人：独立子代理（只读；未修改任何工程文件，未执行任何 git 写操作）
日期：2026-10-16 · 分支 `sim-system` · HEAD `a8f7841`（工作树未逐阶段提交）
取证脚本（均为本轮新建，只放 scratch）：
`E:\project_code\serproject\outputs\scratch-p5\p5check1.py`（token/computed style + 字号 + 身份色）
`E:\project_code\serproject\outputs\scratch-p5\p5check2.py`（attach 数据后的 C2/C3/C4/C5/C6/C7）
`E:\project_code\serproject\outputs\scratch-p5\p5check4.py`（XYZ 轴标实际像素高、真实窗口缩放跟随）
原始结果：同目录 `res-part1.json` / `res-part2.json`。截图 `p5-1792x864.png`、`p5-1366x768.png`、
`p5-1280x720.png`、`p5-drawer-1280.png` 等。**未运行 `outputs/cdp-check/harness.py phase-05`，
所以实施方的 `docs/ui-implementation/phase-05-test.md` 与其截图没有被覆盖。**
dev server 8000 端口已在监听（`curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8000/sim/` → 200），未自行重启。

## 判定

**允许进入下一阶段：否。**

Phase 5 的骨架（token、圆角、响应式抽屉、滚动结构、渲染循环、性能改造）是真的做到了，
但有三条硬条款没过线，而且都能在小改动内修掉：

1. **C3 字号地板破口**：canvas 自绘文字仍有两处 10.5px（< 11px），实测确认它们真的被绘制出来。
2. **C2 颜色统一破口**：编队局部放大窗（Phase 5 点名的组件）整块还在用退役调色板。
3. **C1 token 纪律破口**：选中态背景/描边用 `rgba(127, 227, 214, .N)` 字面量，是退役的旧 S1 青色，
   与它自己配套的 `--sel`(#28cfc8) 不是同一个色。

实施方「Phase 5 全绿 0 失败」的结论 **不成立**（其自测未覆盖 canvas 文字与 formation-inset）。

**是否夹带数据/行为改动：没有。** 见 C8。

---

## 逐条结论

### C1 颜色 token —— PARTIAL
命令：`D:/anaconda/python.exe -X utf8 outputs/scratch-p5/p5check1.py`
- 15 个 token 声明值逐字符等于 V0.3 §11.1，实测 `declaredMatch: true`（`sim/index.html:9-27`）。
- 运行时确实被组件解析使用：列表点、图例、徽标等 computed style 落在 token 集合内；
  实测取到的非 token 色只有 3 个：`#1e3447`、`#2b5573`、`#7fe3d6`。
  - `#2b5573` = `--line-hot`（`sim/index.html:48` 注释已自我说明「比 token 边框亮」），可接受。
  - `#1e3447` 同类派生色，可接受。
  - **`#7fe3d6` = 退役旧 S1 青色，来自 4 条规则**：`sim/index.html:206`（`#drawer .btn.primary`）、
    `:252`（`.cmp tr.sel td`）、`:350`（`.btn.on`）、`:357`（`.seg button.on`）。
    实测选中态：文本 `var(--sel)`=#28cfc8，而背景/描边用 rgba(127,227,214,·) —— 同一状态两种青。
  → 变量存在且大体在用（不是摆设），但选中态这一组必须改成 `color-mix`/token 派生。

### C2 卫星身份色统一 —— PARTIAL
命令同上 + `p5check2.py`（attach 数据集 `86401 步 · 1 s` 后实测）
- 运行时对齐良好：轨迹环 `ringCols = [38a9ff, 29d7d0, ffb83f]`；左栏点
  `railDots = TM0S1 #38a9ff / TM0S2 #29d7d0 / TM0S3 #ffb83f`；图例三条边长同色。
  `StarTM/web/modules/config.js:18` 与 `sim/js/panels.js:6` 两处常量一致，注释也写明必须一致。
- **模型本体拿不到身份色**：实测 attach 后三颗星 `meshes[i].body` 全是 `00ff00`。
  原因：`StarTM/web/modules/views/third-person.js:261-262` 给克隆材质 `setHex(col)` 之后，
  `StarTM/web/modules/light-manager.js:187 / :194` 每帧按光照状态把 `body.material.color` 覆盖成
  绿/黄（`LIGHT_CONFIG.onColor/offColor`，`light-manager.js:8,13`）。
  UI 有如实说明：`sim/index.html:466`「三维模型本体按状态着色：绿=在地平以上、红=地平以下、
  黄=计划开灯。三星身份色看轨迹环、引线与标签。」——语义合规（§11.2 要求状态另有文字），
  但「本体身份色」这条声明与实现不符，且第 259-262 行对那三颗星实际是**被覆盖的死代码**。
- **旧调色板残留（grep `7fe3d6|6fa8dc|e8a33d`，git diff 看不到）**：
  - `sim/js/formation-inset.js:5` `const COLORS = ['#7fe3d6','#6fa8dc','#e8a33d']` —— 放大窗的三星点
    仍是旧色，且顺序含义与工作台相反（那里 index0=青绿，工作台 index0=蓝）。同一颗星在
    左栏是蓝、在放大窗是青绿。运行时确认该窗可见（`inset: vis true, w 240`）。
  - `StarTM/web/modules/sat-model.js:51` 选中环 `0x7fe3d6`：语义上属「青色=选中」，但字面既不是
    `--accent-teal` 也不是 `--border-active`，是第三个青值。
- 中心/单星视角的本体着色确为状态色（`views/center-person.js:206,281`、
  `interpolation.js:175,298`、`views/first-person.js:252,503` 用 0x00ff00/0xff3333），
  同上已由 `index.html:466` 文字说明。

### C3 字号地板 —— FAIL（DOM 过线，canvas 未过线）
命令：`p5check1.py` / `p5check2.py`（三档视口各测一次全量可见文本节点）
- DOM：1792×864 / 1366×768 / 1280×720 三档，可见文本节点 314–317 个，
  直方图最小 11px（hist：11×15、11.5×19、12×36、12.5×4、13×10、14×2、15×2、26×1）。
  `.tl .ticklab` 现为 11px（`sim/index.html:382`），实施方的 9.5→11 / 10.5→11 属实。
  唯一被脚本点名的 `<text>` 0.26px 是 `#axes` 方向轴 SVG（`viewBox="-1 -1 2 2"`，
  `sim/index.html:503`），0.26 是 SVG 用户单位不是 CSS 像素，实际渲染高度另测（见「未能验证」）。
- **canvas 自绘文字实测录制到的字号集合**：
  `['42px "Microsoft YaHei"…'（三维精灵，缩放后约 16 屏幕像素高，合规）,
   '10.5px "Bahnschrift SemiCondensed", Consolas, monospace',
   '11px "Microsoft YaHei", sans-serif',
   '10.5px Consolas, monospace']`
  两处 10.5px 来自 `sim/js/chart.js:29`（曲线坐标轴刻度文字）与 `sim/js/formation-inset.js:89`
  （放大窗读数行）。这些文字在 DOM 里量不到，所以「字号全过线」的自测结论是漏测出来的假绿。
  → 违反 Phase 5「辅助文字不低于 11px」。
- **第三处地板破口（静态算出，不用浏览器也能定）**：`sim/js/main.js:251` 方向轴的 X/Y/Z 字母用
  `font-size="0.26"`，而 `#axes` 是 `viewBox="-1 -1 2 2"`（`sim/index.html:503`）装在 72×72 CSS px
  的盒子里（`sim/index.html:317`）→ 1 用户单位 = 36 px，实际字高 **≈9.4 px**，比 11px 地板低约 15%。
  我的 DOM 采样把 `text` 元素的 computed size 读成 0.26px 就是这个（不是单位错觉，是真的是缩着画）。
- 同一处还有 off-token 的轴色硬编码：`sim/js/main.js:240` `#ff6b6b / #6bd0ff / #8ef0a8`。

### C4 圆角与发光 —— PASS
命令：`p5check2.py`
- 全量遍历可见元素 `border-top-left-radius` 直方图：`{'10px': 4, '8px': 8, '6px': 5, '50%': 8}`
  —— 恰好 6/8/10 三档 + 圆点用的 50%（`--r1/--r2/--r3`，`sim/index.html:50-52`）。
  唯一例外是滑块 thumb 的 `border-radius: 0`（`sim/index.html:387`，2px 宽的指针条，非控件圆角，可接受）。
- 强发光扫描（阴影里带高亮青/绿的分量）命中 0 个元素；全文 `box-shadow` 只剩 6 处，
  面板阴影为 `0 6px 20px rgba(0,0,0,.45)`（`sim/index.html:90`）。

### C5 独立滚动 / 嵌套 / ≤1280 抽屉与放大窗 —— PASS
命令：`p5check2.py`
- 1792×864 实测活动滚动容器只有 1 个：`#rail (clientH 656, scrollH 887)`；
  `nested: []`，iframe 内 0 个滚动容器。CSS 结构也支持：`#rail{overflow-y:auto}`(`:128`) 与
  `#console .body{overflow-y:auto}`(`:226`) 是两条互不嵌套的滚动链（`#console` 自身 `overflow:hidden`）。
  注：本次右栏内容正好装下，所以「右栏也在滚」只由 CSS 结构证明，没有运行时实例。
- ≤1280：`@media (max-width:1280px)`（`sim/index.html:402-408`）把 `#console` 转成
  `position:absolute; z-index:8`。实测 1280×720：`consolePos: absolute`、`consoleW 410`、
  `sceneW 970`（中央场景没被挤扁）、`insetLeft: 92px`、**`insetOverlapRatio: 0`** ——
  放大窗与抽屉零重叠，前一轮缺陷的修复在位且生效。
  1366×768 / 1792×864 对照：`consolePos: relative`、`insetRight: 12px`、overlap 0。
- 三档 `overflowX: 0`，`verticalText: []`（无逐字竖排按钮）。

### C6 容器尺寸变化触发 Three.js resize / 循环不重复 —— PASS（一处待确认）
命令：`p5check2.py`
- 面板成对开合 3 轮：`scene [1758,656]` ↔ `canvas [1758,657]`（1px 高度残差，恒定）；
  视图切 编队→单星→地面→编队：三次都是 `scene [1042,656] / canvas [1042,657]`。跟随正常。
- 重复渲染循环检查（10 次强制合成帧的 `loopTicks` 增量）：
  开合前 `195` → 6 次开合后 `123` → 3 次视图切换后 `111`。**没有翻倍趋势**，
  绝对值受截图耗时影响不能当 fps 用，但「没有累积重复循环」成立。
- 待确认：把视口从 1900×1000 覆盖成 1792×864 后 1.2s 采样，`scene` 已变 `1042×656` 而
  `canvas` 仍是 `1118×700`（旧尺寸），随后被面板开合带正。可能是
  `Emulation.setDeviceMetricsOverride` 的时序而非真实用户拖窗口；用 `Browser.setWindowBounds`
  真实改窗尺寸的复测（`p5check4.py`）因 CDP 超时未完成，见「未能验证」。

### C7 性能改造 —— PASS（fps 数字未定论）
- `sim/js/chart.js` 无逐点画圆：全文只有 2 处 `ctx.arc`，分别是「每条线一个最大越限点」
  （`:113`）与 hover 游标（`:129`），单点级；主线是 `lineTo` 折线（`:92`）。
- 降采样在位：`sim/js/panels.js:511` `const stride = Math.max(1, Math.ceil((epHi - epLo) / 600))`，
  注释明确「只降采样画法，不动底层数据与导出」。
- `hasField` 已记忆化：`sim/js/loader.js:94-106`（`fieldCache` Map，注释记录过 60fps→0.5fps 的教训）。
- 曲线区重绘（连点全部 detail tab）实测最大 `589 ms`，是一次性 tab 切换成本，不是每帧成本。
- 播放期帧率：`p5check2.py` 用墙钟 3s 测得 `loopTicks` +12 → **4.0 tick/s**（`visibilityState: visible`）。
  这个数字要么说明 86401 步回放确实掉帧，要么是并发浏览器/截图争用造成的假阴性；
  复核期间 `p5check3.py` 因 `WebSocketTimeoutException` 崩过（有其它审查在同时跑浏览器），
  所以不据此判 FAIL，但 **Phase 6 必须在独占浏览器下重测 fps**。

### C8 范围纪律：不得改仿真数据与阈值 —— PASS
- `git diff HEAD -- sim/config/display.json` 确有大量改动，但**不是 Phase 5 做的**：
  `docs/ui-implementation/phase-05.diff` 的抓取文件清单（`sim/index.html`、`sim/js/panels.js`、
  `sim/js/chart.js`、`StarTM/web/modules/config.js`、`StarTM/web/modules/views/third-person.js`、
  `StarTM/web/managers/playback-manager.js`、`StarTM/web/app.js`、`sim/config/panels.json`）
  **不含 `sim/config/display.json`**；该改动属 Phase 3/4 的曲线与配置面板工作。
- 阈值原样：`chEdge` 仍 `"band":"tolerance"` + `±10 m`，并新增 `note` 声明「不放宽阈值」，
  如实报 89.5% 采样点越限（`sim/js/panels.js:152` 同调）；`chSun` 仍 `"gate":true`、−6°；
  `keyFields` 列表逐字未变。
- 仿真侧零改动：`git status` 里没有 `server/`、`server/core/`、`propagators/`、`gen_*.py`、`sim-data/` 的修改。
  前端引擎侧的两处行为改动（`app.js` bare 模式不启 WS、`playback-manager.js` 的 `setLayer/layers/camBasis/
  labelNdc` 与探针字段）都是显示/桥接层，不产数据、不改阈值。

---

## 新发现缺陷（按必修顺序）

| # | 位置 | 问题 | 建议 |
|---|---|---|---|
| D1 | `sim/js/chart.js:29` | 曲线轴刻度 canvas 文字 10.5px，低于 §11.3 的 11px 地板（实测被绘制） | 改 11px，与 `.ticklab` 同口径 |
| D2 | `sim/js/formation-inset.js:89` | 放大窗读数 10.5px，同上 | 改 11px |
| D3 | `sim/js/formation-inset.js:5` | 三星点仍用退役旧调色板 `#7fe3d6/#6fa8dc/#e8a33d`，与 `SAT_COLORS` 冲突且 index 语义相反 | 直接 `import { SAT_COLORS } from './panels.js'` |
| D4 | `sim/index.html:206,252,350,357` | 选中态背景/描边硬写 `rgba(127, 227, 214, .N)`（旧 S1 青），与配套 `--sel`=#28cfc8 不同色 | 换成 `--sel` 的 alpha 派生（`color-mix` 或 `--sel-wash` token） |
| D5 | `StarTM/web/modules/views/third-person.js:261-262` | 本体身份色被 `light-manager.js:187/194` 每帧覆盖，实测三颗星全是 `00ff00`；这段是误导性死代码 | 要么把状态色挪到 face/发光层保留本体身份色，要么删掉这两行并把注释改成「本体按状态着色，身份色见环/引线/标签」（与 `index.html:466` 统一） |
| D6 | `StarTM/web/modules/sat-model.js:51` | 选中环第三个青值 `0x7fe3d6`，既非 `--accent-teal` 也非 `--border-active` | 用 `0x28cfc8`/`--border-active` 同值 |
| D8 | `sim/js/main.js:240,251` | 方向轴字母实际字高 ≈9.4px（`font-size="0.26"` × 36px/单位），且轴色 `#ff6b6b/#6bd0ff/#8ef0a8` 未走 token | `#axes` 盒子放大或把 viewBox 改成像素单位，字高≥11px；轴色补两个 token |
| D7 | `sim/js/scene-io.js` / `chart.js` 无 | 自测（`phase-05-test.md`）没有覆盖 canvas 内文字与 formation-inset，才让 C3/C2 假绿 | Phase 6 测试台需把 `ctx.font` 录制与放大窗取色纳入断言 |

## 未能验证 / 证据不足

1. ~~XYZ 方向轴 SVG 文字的实际渲染高度~~ —— 已用静态几何算定 ≈9.4 px（`sim/js/main.js:251` +
   `sim/index.html:317,503`），计入 C3 FAIL。浏览器复测脚本 `p5check4.py` 因页面未就绪（`#axes`/`#stage`
   取到 null）没跑成，不影响该结论。
2. **真实拖窗（非 emulation override）后的 resize 跟随**：同上未完成；目前只有「面板开合 + 视图切换」
   两条路径的实测通过证据。
3. **1792×864 播放期真实 fps**：测得 4.0 tick/s，但存在并发浏览器争用，数字不可信也不可否，
   需独占环境重跑。
4. **右栏运行时滚动**：CSS 结构证明独立，本次内容未超高所以没跑出滚动条。
5. `1280×720` 抽屉打开时放大窗挪到左侧后是否与左栏/方向轴冲突：只查了与 `#console` 的重叠（0），
   `left: 92px` 与 `#axes`（84px 宽）的间距未做像素级复核。

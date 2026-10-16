# Phase 1（中央三维场景）独立验收审查

审查者：独立验收子代理（不实现、不改码）。分支 `sim-system`，基线 HEAD `a8f7841`，工作树未提交改动。
审查手段：只读 `git status/diff/show`、源码逐行、数据文件、既有截图像素分析。**未启动浏览器、未运行 harness、未执行任何改变 Git 状态的命令。**

## 0. 审查前置声明：工作树在审查期间被并发改动

这一点直接影响可归因性，必须先写清楚。

| 时刻 | 事件 |
|---|---|
| 01:02–01:12 | Phase 1 交付改动（`config.js` 01:02、`store.js` 01:06、`index.html` 01:09、`formation-inset.js`/`main.js` 01:12） |
| 01:19–01:20 | Phase 1 截图与 `phase-01-test.md` 生成 |
| 01:14–01:22 | 本审查前 8 次读取：`git status` 显示 **9 个** Phase 1 文件被修改，`sim/js/panels.js` 仅 2 行版本号变化，`sim/config/`、`sim/js/loader.js`、`sim/js/chart.js` **干净** |
| 01:25–01:28 | 另一条工作线开始改 Phase 2 文件：`sim/config/display.json` 01:25、`chart.js` 01:27、`index.html` 01:27、`loader.js` 01:28（新增 `hasField` 导出）、`panels.js` 01:28（新增 `hasField` 导入） |

后果：
- `git status` 现在多出 `sim/config/display.json`、`sim/js/chart.js`、`sim/js/loader.js` 三项，**不属于 Phase 1 交付**，不计入本轮范围判定，但 `sim/config/` 已被改动这一事实需登记（见 §5）。
- 本审查对 `index.html` 图表容器与 `panels.js` 的结论按「Phase 1 交付态（01:09/01:12）」与「当前态（01:27/01:28）」分别陈述。
- Phase 1 交付态的可复现证据以 `docs/ui-implementation/screenshots/phase-01/*.png`（01:17–01:20，不可变）与 `phase-01-test.md` 为准。

---

## 1. 验收矩阵

| 条款 | 结论 | 证据 |
|---|---|---|
| **1.1** 地球直径占中央场景高 38–52%，用取景实现而非 CSS 裁剪 | **PASS** | `StarTM/web/modules/config.js:14` 机位 `(2.10,0.75,2.10)·RE_3D`，模长 √(105²+37.5²+105²)=**153.16**（旧值 113.00）。解析式 `2·tan(asin(50/153.16))/tan37.5°` = **45.0%**。**本审查独立像素实测**：`06-1792-earth-framing.png` 画布区（x 341–1381, y 57–713）用连通长游程分割出地球圆盘 —— 赤道宽 318 px、竖向 313 px（正圆，直径 ≈315 px），315/657 = **48.0%**，两种方法都落在 38–52%。圆盘完整位于画布内（y 171–483、x 346–663），**无 CSS 裁切**；`.scene{overflow:hidden}` 未切到地球。相机方向比 0.75/2.10=0.357 与旧值 0.55/1.55=0.355 基本一致 → 纯距离变化，未偷改俯角。 |
| **1.1** 未通过拉远相机来「修黑」 | **PASS** | 机位改动只为占比（`config.js:9-13` 注释与 `app-context.js:54-55` 光照注释分别归因）；夜侧提亮走 `app-context.js:56-58` 独立光照路径。截图 `03/06/07/08` 四角亮度 2.3–2.8（近黑），构图未再后退找亮面。符合主指令 §0.2 第 6 条禁令。 |
| **1.2** 三星独立可点击标签 | **部分 FAIL** | 独立标签 + 颜色 + 避让 = PASS（见下两行）；**「可点击」= FAIL**：`StarTM/web/modules/ui/tooltip-system.js:36-52` 的射线拾取只把 `satelliteMeshes3D/1D/Center + centerSatMarker` 放进 `tooltipMeshes`，`intersectObjects` 未传 `recursive`。Phase 1 把标签从模型子节点改成场景级精灵（`third-person.js:265-276`），标签**彻底不在拾取集合里** → 点标签无任何反应。违反 1.2「独立可点击标签」与 V0.3 §5.2「点击卫星/标签均选中同一 ID」。 |
| **1.2** 标签色与左栏/图表一致 | **PASS** | `config.js:18` `SAT_COLORS_HEX=[0x7fe3d6,0x6fa8dc,0xe8a33d]` ↔ `sim/js/panels.js:6` `SAT_COLORS=['#7fe3d6','#6fa8dc','#e8a33d']`，逐值严格相等。标签着色 `third-person.js:269-272`。截图 `_crop-labels.png`：TM0S1 淡青、TM0S2 淡蓝、TM0S3 琥珀，与左栏卡片圆点及图层卡图例同色。 |
| **1.2** 重合时屏幕空间偏移 + 引线，**不改模型世界坐标** | **PASS（关键项，已逐行证明）** | `third-person.js:29-63 updateSatelliteLabels()`：对 `m.position` **只读**（`cam.position.distanceTo(m.position)` 第 41 行、`_lblPos.copy(m.position)` 第 50 行、引线端点 0 用 `m.position` 第 57 行）；写入对象只有 `lb.position`(51)、`lb.scale`(53)、引线 `BufferGeometry` 两点(55-57)。函数体内 **不存在任何对 `mesh.position`/`scale`/轨道根数的赋值**。物理位置来源仍是 `third-person.js:348-352`/`378-382` 的 `mesh.position.set(X·S, Z·S, −Y·S)`，本次未改。偏移用相机基向量 `extractBasis`(36) 做 120° 均分扇形(47,49)，`worldPerPx`(38) 保证远近恒定。 |
| **1.2** 三张标签实际可见且不互相覆盖 | **PASS（截图证明）** | `_crop-labels.png`：三张标签分别在上/右下/左下，中心间距 = 62 px×√3 ≈ 107 px > 精灵盒宽 ≈34 px，无重叠。harness 报 `labels3D=[true,true,true]`（该断言本身不可信，见 §1「harness」行，但截图独立佐证）。 |
| **1.3** 小窗 220–260×160–190、标题含「非同尺度」 | **PASS** | `sim/index.html:238` `width:240px;height:176px`；`sim/index.html:418` 标题 `编队局部放大 · 非同尺度` + 副标 `RTN 相对位置`。截图实测 240×176。 |
| **1.3** 使用**真实** `formation_rtn` R/T/N，非编造 | **PASS（三重独立佐证）** | ① 文件存在：`sim-data/preview/formation_rtn.csv` 487 271 B，自描述头 `sat_id,rel_s,utcg,R,T,N,Vr,Vt,Vn` / 坐标系 `RTN` / 单位 `km`，1441 历元 ×3 星。② 取值路径：`formation-inset.js:15` `loadCategory('formation_rtn')`；`render/manifest.json` 的 `columns` 里**没有** `formation_rtn`（已核：二进制只含 attitude/display/formation_geom/ground_obs/power/sun_eclipse/thermal/time_ident）→ `loader.js:54` 必然回退 preview 文本，`entry.satIds=[1,2,3]` 数字星号，`getValue` 走 `satRows` 分支。③ **数值反查**：截图 `_crop-inset.png`（T+00:00:00）显示 `1.07 / 0.98 / 1.02` 与 `N: 0.26 / -0.07 km`；由 CSV 首历元手算三边 = 1.0668 / 0.9793 / 1.0236 km、ΔN₂=+0.2617、ΔN₃=−0.0747 → **逐位吻合**。`03-1792-center.png`（T+12:00:00）显示 `0.94 / 1.01 / 0.94`，手算同历元 = 0.941/1.007/0.943 km → 吻合。④ **跨文件交叉验证**：右栏 `formation_geom.edge_12/23/31` 显示 1066.81/979.33/1023.60 m，与 RTN 差向量模长 1066.8/979.3/1023.6 m 一致 → 证明三星共用同一 RTN 参考系、相减得到的是真相对位置。 |
| **1.3** 采样间隔由数据反解，非写死 | **PASS** | `formation-inset.js:16-17` `peStep = getValue(entry,1,1,'rel_s')`（preview 路径 = 60，若将来进二进制 = 1），`:64` 用 `simSeconds/peStep` 定行；`:95` 页脚把 `peStep` 如实显示为「采样 60 s」。`60` 仅作读取失败兜底，与 preview 实际值一致。截图页脚 `1 km ≈ 41.1 px · 采样 60 s` 与 `03` 图的 `46.7 px` 随构型自适应 → 比例也是算出来的。 |
| **1.3** 标题/副标诚实，未把示意说成真 | **PASS（带 1 条普通问题）** | 用的是真 RTN 相对位置，标题写「编队局部放大 · 非同尺度」+ 副标「RTN 相对位置」+ 画布内 `T→ R↑` 轴向标注 + `N: …/… km` 出面分量数值 → 未暗示方位为假、也未把投影说成三维。缺口：几何是 **R–T 面投影**而边标是**三维模长**，二者不严格自洽（本数据集 N 分量 ≤0.6 km，差在百分之几量级），小窗未点明「投影」，见 §4 N8。 |
| **1.3** 点小窗卫星同步全局选中 | **PASS（代码链）/ NOT-TESTED（无运行证据）** | `formation-inset.js:52-56` 命中 `hit` 圆(半径 12 px) → `onSelect(sat)`；`main.js:325` `initInset(...,{onSelect: sat => selectSat(sat)})` → `panels.js:170-177 selectSat()` 置 `selectedSat`、刷左栏 `aria-current`、调 `hooks.onSelect` → `main.js:309-312` `bridge.selectSat(sat-1)`（+ follow 模式下 `bridge.follow`）→ 三维 `selectedSatIdx` 更新，且**不写 `simSeconds`**。链路正确，但 harness 从未点击小窗，无运行时证据。 |
| **1.4** `activePageView` 与 `cameraMode` 两个独立状态 | **PASS（命名与要求不符但语义正确）** | `sim/js/store.js:10-11`：`view`（formation/satellite/ground）与 `cameraMode`（global/follow/formation）两条字段，注释明确「与 view 是两件事」。要求原文写的是 `activePageView`，实现叫 `view` —— 语义等价，命名偏差登记为普通问题。**耦合**：`main.js:150-1151` 页面视图会强制覆写 `cameraMode`（satellite→follow、formation→global），V0.3 §5.6 明确允许「切单星查看可切目标跟随」，故不算违规，但两态并非完全正交，见 §4 N1。 |
| **1.4** 顶栏/相机下拉/复位/选星四者不打架 | **PASS** | 唯一写入口 `setCameraMode()`(`main.js:137-143`) 与 `setPageView()`(`146-157`)：都先 `patch()` 进 store，再 `$('camSel').value=mode` 回显控件，再 `refreshLayers()`；`btnReset`(`387`) 走同一入口；`onSelect`(`311`) 读 `getState().cameraMode` 而不是读 DOM。harness 6 项同步实测（`phase-01-test.md:31-36`）：切单星→下拉 `follow`；选编队近景→三维 `view=center`；复位→控件与三维同回 `global/third`；地面观察→下拉 `disabled` 且三维 `first`；回总览→一致。这些是真实 DOM+探针双向核对，**非自证**。 |
| **1.5** 夜侧提亮适度、保留日照/地影/晨昏语义 | **PASS（判断：适度，未过）** | `app-context.js:56-58`：`AmbientLight(0x3a4d63)` 强度 0.75→1.0，新增 `HemisphereLight(0x2a4a68, 0x0a1219, 0.5)`，**未加夜灯纹理、未加自发光底**。按材质反算：夜面（NdotL=0）漫反射系数由 ≈0.17–0.29 抬到 ≈0.23–0.39（+0.08 半球光），昼面（NdotL=1）≈1.75→≈1.9 → 昼夜对比由 ≈7.6:1 降到 ≈5:0:1，晨昏线仍是强边界。截图 `06/08`：夜侧能辨大陆/海洋/经纬网，右上角仍有清晰昼侧月牙与明暗界线，**没被照成白天**。 |
| **1.5** 夜侧不暗示卫星受照/发电 | **FAIL（功能未生效）** | 语义层：`setShade`/`setLight` 数据驱动链未被改动，`main.js:94-100` 仍以 `display.actual_strobe` + `sun_eclipse.sun_ratio` 推给 `bridge.setLight`，`light-manager.js:176-195` 仍用 `k=sun_ratio` 乘本体与太阳翼漫反射色，发光面 `face` 只由 `isOn` 控制 → 提亮没有把「夜侧」写成「日照/发电」，且右栏 SOC/发电仍显示「暂不可用」（`06` 图），未伪造。**但**：新增的半球光在真实流程里活不过第一次场景重建（见 §2 B1），所以「抬夜侧」这一半实际未落地。 |
| **1.6** 三条轨道用三种身份色 | **PASS** | `third-person.js:82-86`：`ring.material.color.setHex(SAT_COLORS_HEX[k % 3])`，选中只调 `opacity`（0.95/0.3），**不再把选中换成青色、其余统一蓝**（旧码 `k===idx?0x7fe3d6:0x4488ff` 已删）。探针实测 `ringCols=['7fe3d6','6fa8dc','e8a33d']`（`test.md:28`），与 `panels.js:6` 逐值相等；`06` 图左上/右缘可见青弧与琥珀弧，图层卡图例三行同色（`main.js:409-410`）。 |
| **1.6** 60–80 px XYZ 指示器 + 按真实坐标系标注 | **PASS** | `sim/index.html:235` `#axes{width:72px;height:72px}`（区间内）。`main.js:226` `AXES=[X:(1,0,0), Y:(0,0,−1), Z:(0,1,0)]`。坐标系已三方核实：`third-person.js:348-352` 与 `playback-manager.js:1121`（`l.position.set(400x/n, 400z/n, −400y/n)`）都是场景=(x,z,−y)，`playback-manager.js:61` 注释亦写「场景轴 = ECI 经 (x,y,z)→(x,z,−y)」。反解 s=(x,z,−y) ⇒ x=sx, y=−sz, z=sy，故 J2000 X→(1,0,0)、Y→(0,0,−1)、Z→(0,1,0) —— **与代码逐项一致，是正确的逆映射**。投影用 `camBasis()`(`playback-manager.js:1180-1185`) 的真实相机右/上向，`y` 取负对上 SVG 向下轴（`main.js:233`）。按默认机位手算：X→右下、Y→右上、Z→正上，与 `06/07/08` 图左下角指示器（红 X 右下、蓝 Y 右、绿 Z 正上）一致。 |
| **1.6** 不支持图层禁用/隐藏并说明，非死复选框 | **PASS** | 桥侧真报能力：`playback-manager.js:1140-1160 setLayer` 对 `trails`/`terminator` 在对象不存在时 `return false`，`default`（gtrack/links）恒 false；新增 `layers()`(`1170-1178`) 能力表。外层 `main.js:172-181 refreshLayers()` 据此 `b.disabled=true` + `title='当前视角下没有「X」这一层'` + `.off` 置灰（`index.html:243-244`）。实测 `test.md:37-38`：编队近景下 `disabled=[trails,gtrack,links,terminator]`。`06` 图可见「地面轨迹」「星间连线」灰态。 |
| **1.7** 三相机模式 × 1792 截图 + 1366 总览 + 面板收起 | **FAIL** | 要求「分别截：编队总览、编队近景、目标跟随」。**编队近景截图不存在**：`03-1792-center.png` 实为地球全景（见 §2 B2）。**目标跟随截图也不存在**。1366×768 总览与收起（`04-*`）、1280×720（`05`）、面板收起（`02`）齐备。 |
| **1.7** 无重复 renderer / 监听 / rAF | **PASS（事实）/ 弱（断言）** | `app-context.js:49-52` renderer 只在 `initBaseScene` 建一次；`ResizeObserver`(`80-84`) 也只建一次并 observe(container)；`window.resize` 监听已被替换而非叠加。StarTM 侧外部驱动循环唯一（`playback-manager.js:271-275`，`loopTicks` 单点自增）。外层新增 `setInterval(updateAxes,200)`(`main.js:241`) 是第 3 个定时器（原有 `tick` 100 ms、加载提示 500 ms 且 `256` 已 `clearInterval`），非 rAF、不重复。小窗点击监听 `formation-inset.js:52` 由 `if(!cv)` 守卫，只绑一次。 |
| **1.7** 既有行为回归（时钟/加载/`orbitAt`/`setLayer`/四态缺失/导出/选星） | **PASS** | `orbitAt` 仍透传（`main.js:322`）、`setLayer` 保留且增强（返回值语义未破坏，`applyLayer` 仍按 false 提示）、`btnExport` 加载后解禁并走 `exportRows`（`main.js:336/440-442`）、`btnSave` 文案仍写「浏览器下载，未存服务器」（`438`，无虚假成功提示）。截图 `06/08` 左栏三卡 `SOC 未计算`、右栏 `电池 SOC 暂不可用 / 发电功率暂不可用 / 关键温度暂不可用` + 表头注「无数据的项显示"未计算"，不以 0 代替」→ 四态缺失未被破坏。harness 播放/暂停/拖到 43200/选 TM0S2 不重置时间 4 项实测通过。 |
| **1.7** ID 仍为 `TM0S1/2/3`（数字 0） | **PASS** | 全仓 `sim/` 与 `StarTM/web/` 检索 `TMOS`（字母 O）**零命中**；标签 `third-person.js:270` 模板 `` `TM0S${i+1}` ``，小窗 `formation-inset.js:89` 同式，`PAIRS` 常量(`:6`)亦用 `TM0S1–TM0S2`。截图三处均为数字 0。 |
| **1.7** 无伪造能源/热控数值 | **PASS** | Phase 1 未新增任何能源/热控读数；小窗只画 RTN；`kvKind` 写「固定结果回放」、四个配置入口 `disabled` + 真实原因（`08` 图）。 |
| 模块版本 `?v=33` 一致性 | **PASS** | 全量检索：`sim/index.html:521` `main.js?v=33`（唯一 module script）；`main.js:1/3/4/5` → store/panels/loader/formation-inset 均 `?v=33`；`panels.js:1/2` → loader/chart 均 `?v=33`；`formation-inset.js:3` → loader `?v=33`。**无任何裸 `./xxx.js` 导入**，不存在 `loader.js` 被解析成两个模块实例、64 MB `columns.f32` 缓存翻倍的风险。`chart.js`/`loader.js` 自身不 import 本地模块。 |
| `panels.js` 本阶段只该改版本号 | **PASS（交付态）→ 已被后续工作线改动** | Phase 1 交付态 `git diff` 仅 2 行 `?v=32→?v=33`（`git diff --stat` 报 `4 +-`）。01:28 起另一条线给它加了 `hasField` 导入（配套 `loader.js:92` 新增导出，当前自洽，不会 import 失败）。 |
| harness 断言是否自证/可否失败 | **部分 FAIL** | 见 §3 H3。至少 1 条（`引线存在`）与构造代码同义、不可能失败；1 条（`切视角不重建 renderer`）因传入失效的 `select` 值而变成空转（§2 B2）；1 条（轨迹线三色）容许「三条里只有两条不同」；1 条（rAF 单一）在 120 fps 下同样 PASS；小窗距离与 XYZ 方向**完全没有**对应断言。 |
| Git 安全 | **PASS** | 审查仅执行 `git status`、`git diff`、`git diff --stat`、`git show HEAD:<path>`（管道读取，未落盘）。无 commit / reset / checkout / clean / stash / 分支变更。`sim-data/`（gitignore）mtime 全部 2026-10-12 16:49、`sim/tools/` 全部 ≤2026-10-12 16:47 → 未被触碰。`sim/config/display.json` 于 01:25 被**并发工作线**修改，非 Phase 1 所为，但客观上 `sim/config/` 已脏，登记备查。 |

---

## 2. 阻塞问题

### B1（1.5）新增的 `HemisphereLight` 在真实流程中被 `clearSceneObjects` 永久删除，夜侧提亮只落地了一半

- `StarTM/web/core/app-context.js:57-58` 把半球光作为**基础场景光**加入，`initBaseScene` 全生命周期只执行一次。
- `StarTM/web/core/scene-utils.js:12-24` 的保留白名单只跳过 `THREE.AmbientLight` 与 `THREE.DirectionalLight`。Three.js 里 `HemisphereLight extends Light`，**既不是 AmbientLight 也不是 DirectionalLight** → 它被 `traverse` 收进 `toRemove` 并 `obj.parent.remove(obj)`，且此后没有任何代码再把它加回来。
- 触发时机不是「偶尔」，而是**必经路径**：`sim/js/main.js` 的「加载示例」里 `bridge.rebuildView()` → `playback-manager.js:1315 rebuildView(){ viewManager.switchView(appState.currentView, true); ... }`（`force=true`，不会被 `app.js:119` 的同视角早退挡掉）→ `app.js:145 clearSceneObjects(...)`。`third-person.js:216` 里还有第二次调用。
- 净效果：用户一点「加载示例」，半球光就没了，只剩 `AmbientLight` 0.75→1.0 这一半提亮。`IMPLEMENTATION_LOG.md:69` 把「新增 HemisphereLight 抬夜侧可辨识度」写成已完成事实，与运行时不符。
- 为什么没被测出：Phase 1 唯一的夜侧提亮证据是全景截图，而全景截图无法区分「+0.25 环境光」与「+0.25 环境光 +0.5 半球光」；本应能暴露差异的编队近景截图又不存在（B2）。
- 最小修法（任选其一）：① `scene-utils.js:14` 白名单加 `|| child instanceof THREE.HemisphereLight`；② 或把三盏基础光收进一个带 `userData.keepOnClear=true` 的 `Group`，`clearSceneObjects` 按该标记跳过。改完必须在**点过加载示例之后**再截编队近景与夜侧全景复测。

### B2（1.7）`03-1792-center.png` 不是编队近景；要求的编队近景与目标跟随截图都不存在，且一条回归断言因此变成空转

- Phase 1 把 `#camSel` 的 `option value` 从 `third/follow/center` 改成 `global/follow/formation`（`sim/index.html:411-413`），但 `outputs/cdp-check/harness.py:241` 与 `:247` 仍在写 `camSel.value='center'` / `'third'`。`<select>` 赋一个不存在的 value ⇒ `selectedIndex=-1`、`value=''`。
- 于是 `dispatchEvent('change')` → `main.js:138 setCameraMode('')` → `CAM_MODES['']` 不存在 → **直接 return，什么都没发生**。`03-1792-center.png` 拍到的是切换前的地球全景。
- 独立佐证（不依赖代码推理）：该图相机下拉在截图里**显示为空白**；其画布四角亮度 2.8，与 `06/07/08`（同为全景）一致，而编队近景下地球 silhouette 半角 65.9° > 半视场 37.5°，地球必然铺满画幅、四角不可能近黑。
- 连带后果：`harness.py:243-245 check("切视角不重建 renderer、rAF 不中断", same and Δticks>40)` 里 `same` 在「根本没切换」的前提下恒真 → 这条断言在本轮**不可失败**（`test.md:50` 报 `sameNode=True Δticks=88` 属空转结论）。
- 因此 §1.7 明文要求的「1792×864 下分别截 编队总览 / 编队近景 / 目标跟随」只完成 1/3；编队近景「三星与相对关系清晰可辨」、目标跟随「聚焦所选星且模型可辨识」（1.4/1.5/V0.3 §5.5.2-3）**均无运行证据**。注意：编队近景本身是工作的 —— `harness.py:176-177` 用合法值 `'formation'` 切进去过并拿到 `view='center'`、`rings=0`、`hasTerminator=false`（`test.md:37-38`），只是没在那个状态下截图、也没做 canvas 同一性核对。
- 最小修法：把 `harness.py:241/247` 的字面量改成 `formation`/`global`，在编队近景与目标跟随两种状态下各截一张，并把「canvas 同一节点 + rAF 不翻倍」的核对挪到真正发生 `third↔center` 切换的那一刻（即 `lay` 测试前后）。

---

## 3. 高优先级问题

### H1（1.2）标签不可点击，「点模型或标签均更新统一 selectedSatelliteId」未实现
`tooltip-system.js:36-52` 的拾取集合只有卫星网格；Phase 1 又把标签从网格子节点搬到了场景层（`third-person.js:265-276`），等于把「点标签选中」这条路彻底关死（旧实现即使递归也点不中，现在连对象都不在池里）。修法：`pickSatIdx` 里把 `sceneObjects.satLabels3D` 一并 push（精灵可被 raycast），并在命中后回落到 `sprite.userData.satIdx`（建标签时需补写该字段，目前只写在 mesh 上 `third-person.js:260`）。

### H2（范围蔓延）Phase 1 动了 Phase 2 的右栏图表容器，且日志否认
- `phase-00.diff` 的 index.html 分块为 `@@ -340,19 +358,43 @@` 与 `@@ -403,21 +445,7 @@`，HEAD 第 359–402 行（含 `<div class="chart" id="chDrift">`、`id="chSun"`）**未被 Phase 0 触及**；而 HEAD→工作树 diff 显示这段在 01:09 被改成 `chOrbit/chAttitude/chPower/chThermal`（全 `hidden`）。故该改动属 Phase 1。
- 「为四个单星标签建立独立图表容器」是 **V0.3 §2.1 / 主指令 2.1、2.5** 的条文，不是 Phase 1 的中央三维场景。
- 同时 `IMPLEMENTATION_LOG.md:100` 写「右栏图表与标签绑定**未动**（属 Phase 2）」，与自己的 diff 矛盾；而且 `test.md:57` 实测四个标签下仍是「目标区太阳高度（合肥）」，与「已删 chDrift/chSun、已建四个 hidden 容器」的 01:09 版本也对不上 —— 说明**测试产物与工作树快照不同步**，右栏图表状态无法在本轮干净归因。
- 副作用：`panels.js:390-406 buildCharts()` 现在会为 `chOrbit`、`chAttitude` 真实构造两个 Chart 实例与两个 `charthover/chartleave` 监听，而 `renderCharts` 因 `host.hidden` 直接跳过（`panels.js:431`）→ 白建、永不更新。
- 处置建议：Phase 1 范围内回退这段 index.html 改动（连同 `chDrift` 的删除一起回退，保持 Phase 2 起点干净），或把它显式改记为 Phase 2 已完成项并由 Phase 2 补完 tab→容器显隐接线。**不能以 Phase 1 名义计通过。**

### H3（测试可信度）harness 存在不可能失败/弱于其名、以及零覆盖的关键面
| 断言 | 问题 |
|---|---|
| `harness.py:151 引线存在 leaders==3` | `leaders3D` 取的是 `satLeaders.length`，而 `third-person.js:257-282` 循环里必然 push 3 条 → 与构造代码同义，**不可能失败**；既不查 `visible` 也不查是否真画到屏上。 |
| `harness.py:202 XYZ 已绘制 lines==3` | `updateAxes` 一次 `innerHTML` 恒写 3 条 `<line>` → 只证明函数跑过一次，**完全不校验轴向/标注/尺寸**，而 1.6 的实质风险恰在标注对不对。 |
| `harness.py:149 ringCols` | 条件 `len(set(...))>=2 and cols[1]!=cols[2]` 对 `['A','A','B']` 也放行；且不与 `panels.js` 的 `SAT_COLORS` 比对 → 「三色一致」这条本可失败的断言实际很松。 |
| `harness.py:150 labels3D` | 读的是 Three.js `.visible` 标志，检测不到实现者自己踩过的两个坑（半径过小导致重叠、深度剔除导致看不见）→ 真凭据只有截图。 |
| `harness.py:212 rAF 单一且在跑` | 阈值 `Δticks>60`（2 s 内 >30 fps）；若真存在两条循环，`loopTicks` 翻倍到 120 fps 同样 PASS → 断言名「单一」超出其判别力。应改为 `55 < fps < 75`。 |
| `harness.py:196-198` 小窗 | 只验标题含「非同尺度」、CSS 尺寸、`painted>500`、页脚含 `km`。**没有任何一条把画布上的距离数字与 `formation_rtn.csv` 对账** —— 而这正是 1.3 唯一的实质风险（编数字）。本审查手工反查才确认属实（§1 已给两组历元 + `formation_geom` 交叉验证）。 |
| `harness.py:264-269 tabs` | 采集了五个标签的 hero/图表清单，却**只有 `say()` 没有 `check()`** → 「0 FAIL」不受它约束，问题 C（能源页显示太阳高度）即使恶化也不会翻红。 |
| `harness.py:22-23` | `check` 首行 `(say if cond else FAIL.append)` 是丢弃结果的裸表达式，纯死代码（真正逻辑在 24-25 行）。不影响本轮结论，但该删。 |
| 通用 | 地球占比用解析式而非像素。本轮本审查独立像素实测 48.0% 与解析式 45.0% 同侧收敛，结论可用；但解析式假设地球在视轴正中，将来若加取景偏移该断言会失真。 |

### H4（1.3 可读性）小窗边长数字与星名标签压死
`_crop-inset.png` 与 `06/07/08` 均可见 `TM0S2` 与 `0.98` 叠印成「TM0B298」，无法读。原因：`formation-inset.js:81` 把边长写在边中点 `(mx,my-3)`，`:89` 把星名写在 `(x,y-9)`，两点在三星近等边（边长 0.9–1.1 km、窗宽 240 px）时必然靠近。修法：边中点沿边法向再外推 8–10 px，或给文字加 3 px 暗底描边/圆角背景；同时按 1.3「单位统一」把 `km` 直接跟在数字后（现在单位只在页脚出现，画布内的 `0.98` 无单位）。

---

## 4. 普通问题

- **N1（1.4 正交性）** `setPageView` 无条件覆写 `cameraMode`（`main.js:150-151`）。用户手动选了编队近景后，切一次页面视图再切回来，取景选择被丢弃。V0.3 §5.6 允许「切单星查看可切目标跟随」，但建议只在「未由用户显式改过相机模式」时自动取景，或让「编队总览→」不强制回 global。
- **N2（1.6 一致性）** `setPageView('ground')` 分支不调 `refreshLayers()`（`main.js:149` 只在 `setCameraMode` 里调），地面观察下 `layers()` 能力表已随 first 视角重建而变化，图层芯片可能停留在旧可用性 → 出现「可点但无效」的窗口。建议 `setPageView` 末尾统一 `refreshLayers()`。
- **N3（清理不彻底）** `scene-utils.js:47-53` 复位了 `satelliteMeshes3D/orbitRings/terminator/...`，但**没有**复位新加的 `so.satLabels3D` / `so.satLeaders`。切到 center/first 后这两个数组仍指向已被 `remove`+`dispose` 的精灵/线段，`setLayer('labels')`（`playback-manager.js:1150-1152`）会对已释放对象写 `.visible`。当前不崩，但 `__probe().labels3D` 在非全景视角下会报陈旧值，属未来踩坑点。
- **N4（1.6 标注语义）** 指示器只标 X/Y/Z，未说明这是 **J2000 惯性轴**而非场景/地固轴。映射本身正确，但读者无从判断参考系；建议加 8 px 角标「J2000」或在 tooltip 里写明。
- **N5（可读性下限）** 标签精灵盒高 16 屏幕 px，而字面在 64 px 画布里只占 42 px → 实际字形高 ≈10.5 CSS px（`sat-model.js:70-77` + `third-person.js:52`）。Phase 5 要执行「辅助文字不低于 11 px」，届时会翻红；且实现者注释里的「标签约 46 px 宽」按 `aspect=W/64` 实算约 34 px（结论「107 px 间距不重叠」仍成立）。
- **N6（V0.3 §5.2 未清账）** `_crop-labels.png` 里选中环是一个直径约 110 px 的粗亮青色开口圆环，压在三星投影点与 TM0S1 引线之间。V0.3 §5.2 明确「不要把选中环做成大号、粗亮的青色圆环遮挡卫星；应跟随目标屏幕尺寸或用轻量轮廓」。`placeSelectionRing` 的 `scale = mesh.scale.x*3.4`（`sat-model.js:64`）本轮未动 —— 属遗留，但 1.2 的「独立标识」验收面应当带上它。
- **N7（跨阶段，Phase 1 截图里可见的单位错标）** 右栏「星间距离 **km**」行显示 `1-2 1066.81 · 2-3 979.33 · 3-1 1023.60`，KPI「星间距离（平均）**1023.2 km**」，而 `docs/代码与数据现状清单.md:244` 记明 `formation_geom.edge_*` 单位是 km、前端 `×1000` 后是 **m**。即标签单位与实际数值差 1000 倍。该逻辑在 `panels.js`/`display.json`，**不是 Phase 1 引入**（Phase 1 未改 panels.js 逻辑），但它在 Phase 1 的三张 1792 截图里都成立，必须移交 Phase 2 显式修掉，别在「已验收」的噪声里丢掉。对比之下，小窗自己的单位处理是对的（km 且页脚声明）。
- **N8（1.3 表述精度）** 小窗几何是 R–T 面投影、边标是三维模长，`非同尺度` 只说明「放大倍率非真实」，没说「投影丢一个分量」。虽然 `T→ R↑` 与 `N: …/… km` 已经做了大部分披露，仍建议副标补「R–T 面投影」。
- **N9（归因卫生）** 见 §0：审查期间 `index.html / panels.js / loader.js / chart.js / display.json` 被并发修改，Phase 1 的「0 FAIL」报告与其对应工作树已非同一快照。后续每阶段审查应在报告首行钉住 `git diff --stat` 与文件 mtime 清单，否则复审无法复现。
- **N10（1.5「可控」）** 主指令 1.5 写「使用**可控的**适度环境光/半球光/夜侧纹理」。当前三项都是硬编码常量，既无配置项也无 UI 开关，夜面纹理方案未采用（诊断文档 §4 第 1 条的建议也只做到一半）。可判语义满足，但「可控」缺位，且诊断文档 §4 第 2 条建议的「本轨道为晨昏轨道，星下点太阳高度全天 ≤11.8°，夜面偏暗属正常」这句取景说明**未写入**（全 `sim/` 检索无该文案）→ 夜侧偏暗在 UI 上仍像一个未解释的观感问题。

---

## 5. 通过项（本轮已独立证实，复审时不必重做）

1. **1.1 取景**：机位常量 113.0→153.2 与注释里的推导一致；解析式 45.0% 与本审查的**像素实测 48.0%** 双重落在 38–52%；圆盘完整在画布内，无 CSS 裁切；相机方向比几乎未变（0.355→0.357），确认是纯距离调整，**没有借修黑之名拉远**。
2. **1.2 物理坐标未被改动（本轮最高风险项）**：`updateSatelliteLabels` 对 `mesh.position` 全程只读，写入面仅标签精灵 `position/scale` 与引线几何两点；卫星位置来源 `third-person.js:348-352/378-382` 未被触碰。截图三标签 120° 均分、互不覆盖、引线可见。
3. **1.3 数据真实性（本轮第二高风险项）**：小窗三边长与 N 分量在 **T+00:00:00 与 T+12:00:00 两个历元**均与 `sim-data/preview/formation_rtn.csv` 手算逐位吻合，并与**另一独立文件** `formation_geom.edge_*`（右栏显示的 1066.81/979.33/1023.60 m）交叉一致；`formation_rtn` 确实不在 render manifest 内，故必然走 preview 文本；采样间隔 60 s 是从 `rel_s` 反解并由页脚如实回显。**未发现任何编造数字。**
4. **1.4 状态**：`store.js` 两态字段 + 单一写入口 + 控件双向回显，6 项运行时同步实测为真实 DOM↔探针核对，可失败、非自证。
5. **1.6**：三色轨迹线（探针 `ringCols` + 截图 + 图例三处一致）、72 px XYZ 指示器且**轴向量经独立反演确认为 (x,y,z)→(x,z,−y) 的正确逆映射**、`setLayer` 视角感知 + `layers()` 能力表 + 前端置灰带 title 说明，`gtrack/links` 恒禁用。
6. **1.7 回归**：`orbitAt`/`setLayer`/导出/保存（文案诚实）/四态缺失（「未计算」「暂不可用」，不以 0 代替）/选星不重置时间均在工作；无重复 renderer、无叠加 `window.resize`、外部驱动 rAF 单条（实测 60.0 fps）；ID 全为数字 0；未新增能源/热控伪值。
7. **模块版本 `?v=33` 全量一致**，无裸路径导入，`loader.js` 不会被实例化两次。
8. **Git 安全**：`sim-data/`、`sim/tools/` mtime 证明未被触碰；本轮只读操作。
9. 实现者自陈的两个自引入缺陷（扇形半径 40→62 px、深度剔除→`depthTest=false`+`renderOrder`）确已在码内（`third-person.js:46-49`、`274/281`），且被截图独立证实。

---

允许进入下一阶段：**否**

最小修复清单（全部完成并复审通过后方可进 Phase 2）：

1. **[B1]** `StarTM/web/core/scene-utils.js:14` 保留白名单加入 `THREE.HemisphereLight`（或把基础光收进带保留标记的 Group）；改后**在点过「加载示例」之后**重截夜侧全景与编队近景，确认半球光仍在场景中（可临时在 `__probe` 里回报 scene 内光类型计数）。
2. **[B2]** 修 `outputs/cdp-check/harness.py:241/247` 的失效 option 字面量（`center→formation`、`third→global`），把 canvas 同一性/rAF 核对挪到真实发生 `third↔center` 切换处；补拍 §1.7 要求的**编队近景**与**目标跟随**两张 1792×864 截图，并肉眼确认编队近景下三星可辨、目标跟随下所选星占据可辨识屏幅。
3. **[H1]** 让标签可点击：`tooltip-system.js:36-52` 拾取集合纳入 `satLabels3D`，并在 `third-person.js:265-276` 给标签写 `userData.satIdx`；补一条「点标签 → `__probe().selectedSatIdx` 变化且 `simSeconds` 不变」的断言。
4. **[H2]** 就 `sim/index.html` 的 `chOrbit/chAttitude/chPower/chThermal`（及 `chDrift` 删除）二选一：回退出 Phase 1 范围，或在日志里改记为 Phase 2 交付并补完 tab→容器显隐接线；同时更正 `IMPLEMENTATION_LOG.md:100` 与 `test.md:57` 的矛盾陈述。
5. **[H3]** 把三条不可失败/弱于其名的断言改成可失败：`引线存在`→查 `satLeaders` 的 `visible` 与屏上像素；`XYZ 已绘制`→比对 `camBasis` 投影出的三组 (x,y) 与期望 J2000 逆映射；`ringCols`→与 `panels.js` 的 `SAT_COLORS` 逐值比对并要求三条互异；`rAF 单一`→改 `55<fps<75`；新增一条**小窗边标数字 ↔ `formation_rtn.csv` 手算值对账**；给 `tabs` 测量补 `check()`。
6. **[H4]** 小窗边长文字沿边法向外推并加描底，数字后补单位 `km`。
7. 顺手项（不阻塞门禁，但请在 Phase 2/5 账上登记，勿丢）：N1 页面视图强制覆写相机模式、N2 地面观察未 `refreshLayers`、N3 `satLabels3D/satLeaders` 未随 `clearSceneObjects` 复位、N4 指示器未标 J2000、N5 标签字形 ≈10.5 px、N6 粗亮青色选中环、**N7 右栏「星间距离 km」实为 m（差 1000 倍）**、N10 夜侧偏暗缺少「晨昏轨道」解释文案。

---
---

# 复审（第 2 轮）

审查者：独立验收子代理（第 2 轮）。**未改任何工程文件、未启动浏览器、未运行 harness、未执行任何改变 Git 状态的命令。**取证手段：逐行读源码、逐行核对 `phase-01.diff` 快照与工作树的一致性、独立重算 `sim-data/preview/formation_rtn.csv`、对 02:13 批次截图做像素级测量（连通域/最长游程/径向剖面/边缘检测）。

## R2.0 本轮取证条件（先钉住，否则复审无法复现——上一轮 N9 的教训）

| 项 | 实测结论 |
|---|---|
| 快照保真度 | **可信**。逐文件比对 `git diff -- <8 个跟踪文件>` 的 `+/-` 行集合与 `phase-01.diff` 对应块：`config.js / app-context.js / scene-utils.js / sat-model.js / third-person.js / playback-manager.js / tooltip-system.js / store.js` **全部 IDENTICAL**（本次审查前后各测一次，均未漂移）。新文件 `sim/js/formation-inset.js` 与快照 `=== NEW FILE ===` 段逐行比对：106 行 vs 106 行，**0 差异**。 |
| 快照覆盖范围 | **不完整**。`phase-01.diff` 不含 `sim/js/main.js` 与 `sim/index.html`，而 `IMPLEMENTATION_LOG.md:74-75` 把这两个文件明确列为 Phase 1 改动（`setCameraMode/refreshLayers/AXES/initInset`、`#axes`/`#formationInset`/`camSel` 改名）。→ 这两项只能按「round-1 记录 + 当前态」判定，无法从冻结快照复现。 |
| 审查期间工作树仍在动 | 同一文件两次 stat：`sim/js/main.js` 01:12:30/22008 B → **02:43:16/22748 B**；`sim/index.html` 02:32:42/35455 B → **02:42:45/41330 B**；`sim/js/panels.js` → 02:42:45；新出现未跟踪文件 **`sim/js/scene-io.js`**（02:42:45，main.js 已 `import`）。StarTM 侧 7 个 Phase 1 文件 mtime 全部 ≤02:12:49，未受影响。→ 本轮凡涉及 `sim/index.html`、`sim/js/panels.js` 的结论都注明是当前态，不当作 Phase 1 冻结态。 |
| 证据集混代 | `screenshots/phase-01/` 里 9 张为 02:13（本轮），但 **`_crop-inset.png`(01:17) 与 `_crop-labels.png`(01:20) 是上一轮产物**，且仍被 `phase-01-test.md:85-86` 列为本阶段截图。`_crop-inset.png` 显示的正是 H4 修复**前**的叠印版本（`TM0S2`+`0.98` 糊成「TM0B298」）与已废弃的页脚文案「1 km ≈ 41.1 px · 采样 60 s」。看它会对 H4 得出与看 02/03/06 相反的结论。 |
| 修复落地时序 | `third-person.js` 01:46:50、`tooltip-system.js`/`formation-inset.js` 01:47:14、`playback-manager.js` 02:00:24、`scene-utils.js` **02:12:49**，截图与 `phase-01-test.md` 02:13 → 02:13 那批证据确实覆盖了全部修复（含最后落地的 B1）。 |

---

## R2.1 上一轮问题逐条复核

| # | 上一轮结论 | 本轮判定 | 证据 |
|---|---|---|---|
| **B1** 半球光被 `clearSceneObjects` 删除 | 阻塞 | **FIXED** | `scene-utils.js:15-18` 白名单改为 `child instanceof THREE.Light`（`HemisphereLight extends Light` 成立）。**探针不是自证**：① 全仓 `new THREE.Scene` 只有 `app-context.js:43` 一处，`engine = {scene: appCtx.scene,…}`（`app.js:379`）在 `initBaseScene()`（`app.js:344`）之后取值，故 `playback-manager.js:53` 里的 `scene` 就是被渲染的那一棵；② 全仓唯一能移除场景子节点的是 `scene-utils.js:31`，现已跳过所有 Light；③ `sceneLights`（`:1251`）用 `o.isLight`（Three.js 在 `Light.prototype` 上的真实标记）+ `o.type` 枚举**实际场景图**，不是回显常量；④ 时序：harness 在 `btnAttach.click()`→`已就绪`（`main.js:337`）之后才读探针，而加载必经 `bridge.rebuildView()`（`main.js:284`）→ `switchView(force=true)` → `clearSceneObjects`（`app.js:145`），`third-person.js:216` 还有第二次。→ 报出的 `['AmbientLight','HemisphereLight','DirectionalLight']` 是**清场之后**的存活状态。 |
| **B2** `03-1792-center.png` 实为全景、断言空转 | 阻塞 | **PARTIAL**（台架与截图已修，§1.7 仍缺「目标跟随」一张） | ① 字面量已改：`harness.py:214/233/351` 写 `formation`，`:241/317/359` 写 `global`，`:314` 写 `follow`，与 `sim/index.html:413-415` 的三个 `option value` 逐一对得上，不再有 `selectedIndex=-1` 的空转路径。② **`03-1792-center.png` 经独立目视+像素核对，确实是编队近景**：相机下拉显示「编队近景」；三个分离的卫星模型（各自本体+翼，非重合一点）+ 三张独立标签 TM0S1/TM0S2/TM0S3；场景区中位亮度 8.5、p05 5.3（地球表面铺满画幅），而全景图 01/06 的中位数是 2.0/4.0 —— 与全景在统计上可区分。③ canvas 同一性核对已挪到真实切换处（`harness.py:350-355`：先存 `window.__cn`，切 `formation`，`pump(8)`，再比对节点），`sameNode=True` 这次是在真发生过 `third↔center` 的前提下取得的。④ **但 §1.7 要求的「目标跟随」1792×864 截图依然不存在**：`harness.py` 全部 `shot()` 调用（185/243/256/262/347/358/369/372）没有一次处于 `follow` 状态——`:314` 切到 follow 后只读了一次 `#axes.innerHTML`，`:317` 就切回 global。V0.3 §5.5.3「目标跟随必须聚焦所选星、选中卫星占据可辨识屏幕尺寸」与 §1.4「不得空黑」**至今零运行证据**（`IMPLEMENTATION_LOG.md:98` 自己也承认「目标跟随的取景未单独调参」）。 |
| **H1** 标签不可点击 | 高 | **FIXED** | 链路完整：`third-person.js:275` 写 `lb.userData.satIdx=i` → `tooltip-system.js:44-46` 把 `visible` 的场景级标签并入 `tooltipMeshes` → `:57` `raycaster.intersectObjects`（精灵本身可被 raycast，无需 recursive）→ `:61` `hitObj.userData.satIdx ?? parent` → `:23-25` canvas click → `__simbridge.onPick(idx)` → `main.js:57` `bridge.onPick = idx => selectSat(idx+1)` → `panels.js:189-196`（置 `selectedSat`、`aria-current`、`kvSat`、`hooks.onSelect`→`bridge.selectSat`），**不写 `simSeconds`**。**断言可失败**：`harness.py:271-284` 用 `labelNdc(2)`（`playback-manager.js:1189-1194`，`lb.position.project(camera)`）拿 NDC 换算成画布像素再派发点击；该点距三星投影重合点约 62 px，若标签不在拾取池里射线必然落空、`after` 保持 0。实测 `before=0 → after=2` 且外层 `kvSat=TM0S3`，一次同时证明三维拾取、桥回传、外层统一选中 ID 三段都通。 |
| **H2** Phase 1 夹带 Phase 2 右栏容器且日志否认 | 高 | **NOT FIXED（否认仍在）/ 功能副作用已由 Phase 2 消化** | `IMPLEMENTATION_LOG.md:100` 至今写着「右栏图表与标签绑定**未动**（属 Phase 2）」，Phase 1 的修改文件表（`:75`）只列了 `#axes`/`#formationInset`/`camSel` 改名/图层置灰，**没有**登记 `chOrbit/chAttitude/chPower/chThermal` 与删除 `chDrift`。本轮无法自行复现 01:09 那一版的 index.html（02:32、02:42 两次重写），故沿用上一轮的分块级证据 + 实现方本轮自认。功能面：`panels.js:448-449` 现在按 `spec.tab` 切 `host.hidden` 并只在可见时挂载，上一轮「白建两个 Chart 实例、永不更新」的副作用已消失。 |
| **H3-a** `ringCols` 断言过松 | 高 | **FIXED** | `harness.py:198` 要求三条互异（`len(set)==3`），`:199-200` 再要求**逐位等于** `['7fe3d6','6fa8dc','e8a33d']`，两条都要过。本审查独立核对 `sim/js/panels.js:6` `SAT_COLORS = ['#7fe3d6','#6fa8dc','#e8a33d']` 与 `config.js:19` `SAT_COLORS_HEX` 严格一致。残留弱点：期望值是抄在 harness 里的字面量，不读 `panels.js`，将来左栏改色它会以 FAIL 的形式提醒（可接受），但 `formation-inset.js:5` 与 `index.html:18-20` 还各有第三、第四份同色字面量，无一处断言覆盖。 |
| **H3-b** 「引线存在」与构造同义、不可能失败 | 高 | **NOT FIXED** | `harness.py:208` 仍是 `ph1['leaders'] == 3`，而 `leaders3D` 取的是 `satLeaders.length`（`playback-manager.js:1246`）——`third-person.js:257` 清空、`:286` 在同一循环里必然 push satCount 条，**与构造代码同义**。既不查 `ln.visible`，也不查屏上是否真画出线。旁边 `harness.py:204-207` 两段 `lead`/`ln` 计算完就丢弃（一个恒返回 1、一个恒返回 0），像是想做这个检查而没做完。 |
| **H3-c** XYZ 断言只数 `<line>` 条数 | 高 | **PARTIAL** | 新增 `harness.py:313-319`：切 `follow` 前后比对 `#axes.innerHTML`，断言 `ax1 != ax2` —— 这确实能杀掉「画死」的实现，可失败性上了一个台阶。但**仍未校验轴向/标注**（1.6 的实质风险），detail 串「493 vs 491 字节」也说明只差一个字符就 PASS。轴向我只能自己反推核对（见 R2.4 通过项 4）：结论是正确的。 |
| **H3-d** 小窗数字与 CSV 无对账 | 高 | **FIXED（本轮最强的新断言）** | `harness.py:286-311` 在 Python 侧独立解析 `sim-data/preview/formation_rtn.csv`，按 `sat_id/rel_s/R/T/N` 建表，用 `#tplus` 反解秒数取整到 60 s 网格，算三边与页脚文本比对，容差 0.002 km。**本审查独立重算**：`rel_s=0` → S12=1.067 / S23=0.979 / S31=1.024，ΔN₂=+0.26 / ΔN₃=−0.07（对上 06/07/08 与 test.md:50）；`rel_s=43200` → 0.941/1.007/0.943，ΔN₂=−0.24 / ΔN₃=+0.56（对上 03 与 02 两张 T+12:00 截图）。**两个历元、三处独立读数全部吻合，无编造。**弱点：页脚文本在 `:245` 取、时刻在 `:294` 取，非原子（本轮中间无走带所以侥幸对齐）；`pe=60` 在 harness 里写死，而小窗是从数据反解的，数据一改就会假 FAIL。 |
| **H3-e** `rAF 单一` 判别力不足 | 高 | **NOT FIXED（反而更弱）** | 见 R2.2 专段。`harness.py:323` 现在是 `base_ticks > 0`（上一轮是「2 s 内 Δ>60」），**下界彻底消失**；`:356` 的 `0 < after <= base*1.6` 能抓重复循环，但两条都不设 fps 地板；而真正能设地板的墙钟测量（`:184` 60.0 fps、`:421` 60.5 fps）**只 `say()` 不 `check()`**，返回值被丢弃。 |
| **H3-f** `tabs` 测量无断言 | 高 | **NOT FIXED** | `harness.py:376-381` 采五个标签的 hero/图表清单后仍只有 `say()`，无 `check()`。本轮该表里 `power`/`thermal` 全是「暂无数据/字段未提供」，与「0 FAIL」互不约束。 |
| **H3-g** `check()` 首行死代码 | 高 | **NOT FIXED** | `harness.py:34` `(say if cond else FAIL.append)` 丢弃结果的裸表达式仍在。 |
| **H4** 小窗边长压星名、无单位 | 高 | **FIXED** | `formation-inset.js:95-96`：三条边长移到页脚 `S12 … · S23 … · S31 … km`（带单位），`foot.title` 进一步写明 S12/S23/S31 的对应关系与「采样 N s」；画布内 `fillText` 只剩 `:87` 星名、`:90` `T→ R↑`、`:92` N 分量三处，**边中点文字已删**。**视觉复核**：02/03/06/07/08 五张 02:13 截图里小窗均无叠印。（`_crop-inset.png` 仍是修复前的样子，属证据混代，见 R2.0。） |
| N1 `setPageView` 无条件覆写 `cameraMode` | 普通 | **OPEN** | `main.js:149-151` 仍是 `satellite→setCameraMode('follow')`、`else→setCameraMode('global')`，用户手选的取景在切页面视图时被丢弃。 |
| N2 地面观察不调 `refreshLayers()` | 普通 | **OPEN** | `main.js:149` 的 ground 分支只 `setView('first')+follow(null)`；`refreshLayers()` 只在 `setCameraMode`（`:142`）里调。first 视角下 `layers()` 能力会变（`orbitRings` 被清空），芯片停留在旧可用性。harness `:221` 也只验了 `camSel.disabled`，没验芯片。 |
| N3 `satLabels3D/satLeaders` 未随清场复位 | 普通 | **OPEN** | `scene-utils.js:50-55` 复位了 `satelliteMeshes3D/orbitRings/terminator/selectionRing/…`，**仍无** `satLabels3D`/`satLeaders`。切到 center/first 后这两个数组指向已 `remove`+`dispose` 的精灵/线段，`setLayer('labels')`（`playback-manager.js:1150-1152`）会对已释放对象写 `.visible`，`__probe().labels3D` 在非全景视角报陈旧值。 |
| N4 指示器未标 J2000 | 普通 | **OPEN** | `index.html:469`（当前态）`#axes` 只有 X/Y/Z 三个 `<text>`，且 `aria-hidden="true"`，无参考系角标/tooltip。 |
| N5 标签字形 ≈10.5 px | 普通 | **OPEN** | `sat-model.js:70-77` 42 px 字体画进 64 px 高画布（字形占 0.656），`third-person.js:54` 精灵高 16 px → 字形 ≈10.5 CSS px，低于 Phase 5 的 11 px 下限。 |
| N6 粗亮青色选中环 | 普通 | **OPEN** | `sat-model.js:64` `ring.scale.setScalar(mesh.scale.x*3.4)` 未动；06 图上仍是一个开口大亮环压在三星投影点与引线之间，V0.3 §5.2 明文不推荐。Phase 1 本轮就改过这个文件（加了 `userData.aspect`）。 |
| N7 右栏「星间距离 km」实为 m | 普通 | **已在 Phase 2 修掉**（非 Phase 1 功劳） | 03/05 截图右栏现为「星间距离 · 来源 formation_geom，单位 km」+ 0.941/1.007/0.943，与 RTN 反算一致；「编队边长（m）」另图。 |
| N8 R–T 面投影 vs 三维模长未点明 | 普通 | **OPEN** | `formation-inset.js:69-96` 几何是 R–T 投影、边长是 `Math.hypot(dR,dT,dN)`，`foot.title` 只写「单位 km，采样 60 s」，未写「投影」。 |
| N9 归因卫生 | 普通 | **加重** | 见 R2.0：审查期间工作树仍在被改，且 `phase-01.diff` 漏掉 main.js/index.html 两个 Phase 1 文件。 |
| N10 「可控」光照 + 晨昏轨道解释文案 | 普通 | **OPEN** | `grep -i 'hemisphere|ambient|光照' sim/js sim/config sim/index.html` **零命中**，三盏光仍是 `app-context.js:56-61` 硬编码常量；「星下点太阳高度全天 ≤11.8°」只出现在 `IMPLEMENTATION_LOG.md:97`，未进 UI。 |

---

## R2.2 专项裁决：帧泵（`pump()`）是合法测量还是遮丑

**结论：方法合法，但描述失实、判据比它替换掉的版本更弱，且没有掩盖本轮任何 fps 问题——同时也没有能力暴露 fps 问题。**

1. **它不是遮丑**：`loopTicks` 只有一个自增点（`playback-manager.js:272`），`playbackLoop` 每次迭代 +1；rAF 链只有一条（`:271` 在函数体内续帧、`:275` 是 `startCsvPlayback` 的启动帧，且 `:120` `if (csvState.isPlaying) return` 防重入；`app.js:73-74/473` 的 `animate()` 是 StarTM 自己的渲染链，不计 tick）。所以 tick 数 ∝ 墙钟时间 × 循环条数，重复循环一定翻倍，`:356` 的 `after <= base*1.6` 因此**真能失败**（48→96 会翻红）。
2. **但「8 张强制合成帧 → 48 tick」不是 8 帧**：48/8=6 tick/帧在物理上不成立。真实含义是「8 次 CDP 截图耗时约 0.8 s，其间 rAF 以 60 Hz 跑了 48 次」。也就是说它测的还是墙钟，不是帧。
3. **它的前提在本轮不成立**：`harness.py:79-81` 写「窗口拿不到焦点时 Chrome 会把 rAF 节流到接近 0」，但 `bring_front()`（`:133-146`）配合 `--disable-backgrounding-occluded-windows/--disable-renderer-backgrounding/--disable-background-timer-throttling` 后，`:269` 断言并回报 `visibilityState=visible`，`:184`/`:421` 两次墙钟探针实测 **60.0 / 60.5 fps**。**本环境的墙钟 fps 是可测的**，「测不到」的说法不应写进结论。
4. **净缺口**：唯一能当 fps 地板的两次墙钟测量没有 `check()`；`base_ticks > 0` 在 5 fps（约 4 tick）下照样 PASS。上一轮要求的 `55 < fps < 75` 至今没有落地。

---

## R2.3 阻塞问题

无。上一轮两条阻塞中，B1 已彻底修复并经独立代码链证明；B2 的「假证据 + 空转断言」这一实质已修复（截图与断言都取自真实切换后状态）。

---

## R2.4 高优先级问题

- **G1（1.7 / V0.3 §5.5.3，承 B2）目标跟随零运行证据。** §1.7 要求 1792×864 下分别截「编队总览 / 编队近景 / 目标跟随」，至今 2/3；`follow` 分支在 `harness.py` 里只被用来读一次 `#axes`。本阶段交付物就是三种取景，第三种「聚焦所选星、不空黑、模型可辨识」既无截图也无探针。修起来最便宜：切 `follow` → `pump` → `shot('09-1792-follow.png')`，并加一条「`__probe().cam` 与所选星 `meshes[i].p` 距离 ≈ 18 单位、`mesh.scale` 在屏幅可辨」的断言。
- **G2（1.3 / 1.7，本轮新发现）1280×720 下编队局部放大窗被右栏完全遮住。** `index.html:376-380` 在 `max-width:1280px` 把 `#console` 变成 `position:absolute; width:min(88vw,410px); z-index:8`（该行为本身符合 V0.3 §2.2 line 166-171，不算违规），而 `#formationInset`（`:294`）钉在 `.scene` 右下 `right:12px; bottom:12px`。对 `05-1280x720-overview.png` 做边缘检测：console 左边界在 x≈861、右边界 x≈1261，场景区为 x 302..1272 → 小窗应在 x 1020..1260，**100% 落在 console 之下**；又因 `--panel: rgba(9,16,24,.93)`（`:26`）半透明，小窗标题「编队局部放大 · 非同尺度」与页脚「S12 0.941 · S23 1.007 · S31 0.943 km」在 y≈400 / y≈543 处**透出来压在右栏表格上**（图上可直接读出），比 H4 修掉的叠印更严重。harness 的 1280 检查只有 `ovf==[0,0]` 与 `canvasMatchesScene`，对遮挡零感知。修法：`@media (max-width:1280px)` 里隐藏小窗，或把它锚到 drawer 左侧，并补一条「小窗矩形不被任何 `z-index>2` 的兄弟面板覆盖」的断言。
- **G3（H3-b/H3-e/H3-f 残留）三条不可失败或零约束的断言仍未修。** 「引线存在」与构造同义；`rAF 循环在跑` 下界为 0；`tabs` 测量不参与判红。这三条都是上一轮点名项，改动量各 1–3 行。
- **G4（H2 残留）Phase 1 的范围越界仍是否认状态。** 门禁要求的不是回退，而是**如实登记**：`IMPLEMENTATION_LOG.md:100` 那句与事实矛盾，且 Phase 1 的修改文件表缺 `sim/index.html` 右栏那一节。把它改写成「Phase 1 顺带建立了四个隐藏图表容器（Phase 2 接线），已记为范围越界」即可结案。

---

## R2.5 普通问题

- **P1（文档卫生）`IMPLEMENTATION_LOG.md` 的 Phase 1 段没有随第 2 轮刷新。** `:62` 写「0 FAIL（34 项）」，而 02:13 的 `phase-01-test.md` 实有 **46 条 PASS**；`:83`「三条引线存在」、`:87`「XYZ 指示器 3 条轴已绘制」是上一轮的弱断言描述；`:86` 引用的页脚「1 km ≈ 41.1 px · 采样 60 s」在现码里**已不存在**；`:97`「场景带均值 L≈5.7」早于 B1 修复。本轮新增的 5 条可证伪断言（半球光存活、点标签、CSV 对账、指示器随相机变化、泵帧）**一条都没进日志**。
- **P2（证据卫生）** `_crop-inset.png`/`_crop-labels.png` 是 01:17/01:20 的上一轮产物，仍被 `phase-01-test.md:85-86` 当作本阶段截图列出，且前者展示的正是已修复的 H4 缺陷。建议改名加轮次前缀（本审查不代为删除）。
- **P3（注释失真）** `third-person.js:47-48` 称「标签约 46 px 宽」；按 `sat-model.js:73`（`W=measure+12`，画布高 64）与 `:55`（`scale = h*aspect`，h=16 px），`TM0S1` 实宽 ≈34 px。62 px 半径的结论仍成立，注释需更正。
- **P4（身份色四份字面量）** `config.js:19`、`panels.js:6`、`formation-inset.js:5`、`index.html:18-20` 各写一份 `7fe3d6/6fa8dc/e8a33d`；harness 只交叉核对了第一份与第二份。三份手抄是将来必然分叉的地方。
- **P5（小窗对账的原子性）** `harness.py:245` 取页脚、`:294` 取时刻，两步之间若有任何走带就会错配；`:296` 的 `pe=60` 写死，与小窗「从数据反解」的口径不一致。
- **P6（拾取坐标假设未文档化）** `tooltip-system.js:33-34` 用 `event.clientX / window.innerWidth` 而非 canvas 的 `getBoundingClientRect()`。本轮成立（`iframeInner` 与 `canvasCss` 同为 1042×657，画布在 iframe 视口原点），但一旦 iframe 内出现偏移或浮层，点标签会**静默打偏**，而 harness 的合成点击用了同一个假设，会一起错。建议改用包围盒并把这条假设写进注释。
- **P7（快照格式）** `phase-01.diff:360` 用 `=== NEW FILE ===` 追加裸源码，故该文件不是可 `git apply` 的 diff（内容本身逐行准确）。若要给下游机器消费，建议改为真正的 `--- /dev/null` 分块。

---

## R2.6 通过项（本轮独立证实）

1. **物理坐标未被改动（本阶段最高风险）**：`third-person.js:29-63 updateSatelliteLabels` 对 `m.position` **全程只读**（`:44` 算距、`:50` 复制、`:58` 引线端点 0），写入面只有 `lb.visible/position/scale`（`:41/53/55`）、`ln.visible`（`:42`）与引线两个 buffer 顶点（`:57-60`）；函数体内不存在任何对 mesh `position/scale/quaternion` 或轨道根数的赋值。位置来源 `mesh.position.set(X·S, Z·S, −Y·S)`（`playback-manager.js:1268` 同式）未被本次 diff 触及。`formation-inset.js` 只读数据画 2D 画布，`relAt` 的差值只在本地数组里，无任何回写。显示性缩放（`applyScreenScale`、`placeSelectionRing`）与姿态（`applyAttitude`）均为既有机制，本轮未改。
2. **1.1 取景 = 45.0%，且不是靠拉远修黑**：`config.js:15` 机位 `(2.10,0.75,2.10)·RE_3D`，模长 50·√9.3825 = **153.16**（旧 113.00）；解析式 `2·tan(asin(50/153.16))/tan37.5° = 45.0%`（harness 的公式经我逐项核对无误）。**独立像素实测**（06，canonical 机位、未经 `frameDaylight`）：过盘心的最长竖向游程 y 159→472 = **313 px = 47.6%**，与 45.0%×1.04（`third-person.js:229` 的 1.04R 大气壳）+边缘辉光吻合；圆盘完整在画布内（上下留白 24%/27%），**无 CSS 裁切**；相机方向比 0.75/2.10=0.357 对旧值 0.55/1.55=0.355 → 纯距离变化。诚实披露：`main.js:333` 在加载时会调一次 `frameDaylight()`（`playback-manager.js:1216-1228`，**HEAD 已存在，非 Phase 1 引入**）把方位角转向昼侧，它保持 `|cam|` 不变故不影响占比，但意味着 01/02 这类「夜侧有多黑」的观感截图取的是有利方位；06 才是公正的一张，它的左缘确实偏暗。
3. **1.5 夜侧提亮适度、语义未被破坏**：`app-context.js:56-61` 环境光 0.75→1.0 + 半球光 (0x2a4a68, 0x0a1219, 0.5)，**未加夜灯纹理、未加自发光底**；晨昏线与 `setLight/setShade` 数据链未被触碰，所有截图的 SOC/发电/关键温度仍是「字段未提供 / 暂无数据」。实测：背景空间中位 1.7、夜侧盘面中位 ≈10.7、昼侧明显更亮且明暗界清晰（06）→ 夜侧「看得出是表面」而没被照成白天。两条保留意见：半球光的轴是场景 +Y、与太阳方向无关，属通用环境提亮而非物理项；编队近景夜面（03，T+12:00）中位 8.5 且几乎无纹理起伏，抬升量偏小。另 1.5 要求的「**可控**」缺位（N10）。
4. **1.6 XYZ 指示器标注是正确逆映射（本轮独立反推）**：场景=(x,z,−y) ⟹ 给定场景向量 s 反解 J2000 为 (sx, −sz, sy)；故 J2000 X→(1,0,0)、Y→(0,0,−1)、Z→(0,1,0)，与 `main.js:226 AXES` **逐项一致**；投影 `x=v·right, y=−(v·up)`（`:234-235`）与 SVG 向下轴匹配，`camBasis()`（`playback-manager.js:1180-1185`）取的是真实相机基向量。尺寸 `#axes 72px`（`index.html:241`）在 60–80 区间。
5. **1.6 三色与图层**：`third-person.js:84` `SAT_COLORS_HEX[k%3]`，旧的 `k===idx?0x7fe3d6:0x4488ff` 已删，选中只改 opacity（`:85`）；与 `panels.js:6` 逐值相等，探针/图例/标签/小窗四处同色。`setLayer` 视角感知返回 false + `layers()` 能力表 + `main.js:172-181` 置灰带 title，运行态实测编队近景 `disabled=[trails,gtrack,links,terminator]`、`rings=0`、`hasTerminator=false`。
6. **1.2/1.4 状态与选星**：`store.js` `view`/`cameraMode` 两态；唯一写入口 `setCameraMode`/`setPageView`，控件双向回显；`selectSat` 不写 `simSeconds`（`panels.js:189-196`），harness「选星不重置时间」在 T+12:00 实测成立。
7. **回归**：`new THREE.WebGLRenderer` 全仓 1 处；rAF 驱动链 1 条（`isPlaying` 防重入）；`main.js` 监听全部在模块作用域，常驻定时器 2 个（`tick` 100 ms、`updateAxes` 200 ms）+ 1 个已 `clearInterval` 的加载提示，小窗 click 由 `if(!cv)` 守卫；`orbitAt`（`playback-manager.js:1133`）与 `setLayer` 均在位并被消费；导出/保存在加载后解禁且文案诚实；缺值分类扩到 7 类（`panels.js:90-99`）未被压平；ID 全为数字 0（`grep TMOS` 在 `sim/`、`StarTM/web/` **零命中**）；未新增能源/热控数值；`?v=33` 全量一致、无裸路径导入。
8. **1.3 数据真实性**：三处独立历元与 `formation_rtn.csv` 手算逐位吻合（见 H3-d），采样间隔从 `rel_s` 反解并在 title 里如实回显，`formation_rtn` 不在 render manifest 内故必走 preview 文本。

---

## R2.7 门禁裁决

允许进入下一阶段：**否**

最小修复清单（4 项，预计均为十行以内改动；完成后第 3 轮只需核对这 4 项 + 抽查无回归）：

1. **[G1]** `outputs/cdp-check/harness.py`：在 `camSel='follow'` 状态下补一张 `09-1792-follow.png`（1792×864），并加一条可失败断言——`__probe().cam` 与所选星 `meshes[i].p` 的距离 ≈ `follow(idx,18)` 的 18 单位、`meshes[i].scale` 换算屏幅 ≥ 一个下限值。同时肉眼确认「不空黑、所选星可辨识」。
2. **[G2]** `sim/index.html`：`@media (max-width:1280px)` 内让 `#formationInset` 不被 `#console` 覆盖（隐藏，或锚到 drawer 左侧并保证 `z-index` 与矩形都不相交）；harness 的 1280×720 检查里补一条「小窗矩形与任何覆盖型面板不相交」的断言，别只测 `ovf`/`canvasMatchesScene`。
3. **[G3]** `harness.py`：① 「引线存在」改查 `satLeaders` 的 `visible` 与屏上像素（或至少 `labels3D[i] && leaders3D[i].visible` 成对）；② 把 `:184`/`:421` 的墙钟 fps 从 `say()` 升成 `check(55<fps<75)`，`rAF 循环在跑` 的下界从 `>0` 收回；③ `tabs` 测量补 `check()`；④ 删掉 `:34`、`:204-207` 的死代码。
4. **[G4]** `docs/ui-implementation/IMPLEMENTATION_LOG.md`：更正 `:100` 的「右栏未动」，在 Phase 1 的修改文件表里登记 `sim/index.html` 右栏四个图表容器与 `chDrift` 删除属越界（Phase 2 已接线）；同时刷新 Phase 1 段的测试小结（46 项、五条新可证伪断言、`:86` 已废弃的页脚文案、`:97` 早于 B1 的亮度数字），并把 `_crop-*.png` 改名标轮次或删除。

不阻塞但请登记勿丢：N1（页面视图覆写相机模式）、N2（ground 分支未 `refreshLayers`）、N3（`satLabels3D/satLeaders` 未随清场复位）、N4（指示器未标 J2000）、N5（标签字形 ≈10.5 px）、N6（粗亮青色选中环）、N8（R–T 投影未点明）、N10（光照不可控 + 缺「晨昏轨道 ≤11.8°」说明文案）、P3–P7。

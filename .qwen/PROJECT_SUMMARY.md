用户希望我生成一个全面的项目总结，使用 Markdown 格式。
这个总结需要基于以上的对话历史。

**项目目标 (Overall Goal):**
用户的初始目标是总结一个卫星星座可视化项目（基于 Three.js 和 Python 后端）。随后，用户要求进行代码重构，以减少 `app.js` 的文件长度并提高可维护性。目前的主要目标是修复 CSV 模式下视角切换时出现的渲染问题（如主星视角不显示、第一视角卡顿、第三视角延迟等），并希望参照 WS 模式的实现方案来修复 CSV 模式的问题。

**关键知识 (Key Knowledge):**
1.  **技术栈**: 前端使用 Three.js (ES Modules), 后端使用 Python (`server.py` 提供静态文件, `server_ws.py` 提供 WebSocket 数据流, `propagate_stream.py` 进行轨道计算)。
2.  **架构**: 经历了模块化重构。`app.js` 是主入口，逻辑已拆分到 `modules/` 目录下的 `views/` (视角), `modes/` (数据模式), `ui/` (界面控制) 等子模块。
3.  **WS 模式工作原理**:
    *   依赖 `runWsPlayback` 持续调用 `startInterpolation`。
    *   视角模块的 `initXxxScene` 函数内部会自动检测 WS 状态并调用 `updateXxxWs` 进行首次渲染。
    *   插值循环 `startInterpolation` 根据 `currentView` 自动选择正确的渲染路径。
4.  **CSV 模式工作原理**:
    *   依赖 `setInterval` 定时器更新 `csvState.currentTimeIdx`。
    *   渲染函数通过 `csvState.currentTimeIdx` 索引访问 `appState.csv.satelliteData`。
    *   非播放状态下，没有持续的插值循环驱动渲染。
5.  **关键差异**:
    *   WS 模式在 `switchView` 中缺少显式的 Third/First 渲染调用，但靠 `initXxxScene` 内部逻辑和插值循环“兜底”了。
    *   CSV 模式在 `switchView` 中有显式渲染调用，但如果数据索引无效、数据未加载或 `startInterpolation` 未触发，渲染会失败。
    *   `clearSceneObjects()` 会清空场景引用，如果 `init` 函数没正确重建，渲染函数会静默失败。

**最近采取的行动 (Recent Actions):**
1.  **项目总结**: 用户要求分析项目结构，我提供了包含核心功能、架构、技术亮点的总结。
2.  **死代码清理**: 清理了 VVLH 坐标系相关的未使用函数。
3.  **模块化重构 (阶段 1-6)**:
    *   提取了 `config.js`, `math-utils.js`, `state.js` 等核心模块。
    *   提取了视角模块 (`third-person.js` 等)、UI 模块、数据模式模块。
    *   `app.js` 行数从 ~1619 行减少到 ~1200 行左右。
4.  **Bug 修复**:
    *   修复了变量重复声明 (`earthRotationStartTime`, `THIRD_PERSON_CAMERA_POS` 等)。
    *   修复了 `cameraPanOffset` 未定义问题。
    *   修复了 WS 模式下切换到 CSV 模式时主星视角蓝屏的问题（检查数据有效性）。
    *   修复了 CSV 模式第一视角/主星视角切换时不立即渲染的问题（添加 `renderer.render` 强制渲染）。
    *   修复了相机切换时的“极点吸附”问题（在动画期间禁用 `OrbitControls`）。
    *   修复了相机 `up` 向量未重置导致画面倾斜的问题。
    *   修复了 CSV 播放时双重渲染导致的闪烁（删除了冗余的 `updateCurrentView`）。
5.  **当前问题分析**: 深度分析了 WS 和 CSV 模式在 `switchView` 中的差异，发现 WS 靠“持续插值”和“初始化自动渲染”兜底，而 CSV 强依赖 `switchView` 中的显式调用和索引有效性。

**当前计划 (Current Plan):**
1.  **[DONE]** 分析 WS 与 CSV 模式视角切换的逻辑差异，确定 WS 模式“看似正常”的原因（插值兜底 + init 内部渲染）。
2.  **[IN PROGRESS]** 修复 CSV 模式下的视角切换问题：
    *   确保 `switchView` 中 CSV 模式的渲染调用参数正确。
    *   确保 `initXxxScene` 内部的 CSV 渲染逻辑也能处理相机参数（或确保 `switchView` 后的强制渲染有效）。
    *   统一数据索引校验逻辑。
3.  **[TODO]** 测试验证：
    *   测试 CSV 模式下：停止状态 -> 主星视角是否正常。
    *   测试 CSV 模式下：主星 -> 第一视角是否需要拖动。
    *   测试播放状态 -> 第三视角是否有延迟。
4.  **[TODO]** 继续精简 `app.js`（如果时间允许）。

**总结生成**:
我将根据上述思考生成 Markdown 总结。重点突出项目背景、重构进度、WS/CSV 模式的差异分析以及下一步的修复策略。用户明确要求不要使用工具直接生成。

结构：
- Project Summary
- Overall Goal
- Key Knowledge
- Recent Actions
- Current Plan
- Issues & Troubleshooting (添加此项以记录已知 bug 和修复方案)
- File Structure (简略)

这将帮助未来的 session 快速理解上下文，特别是那些复杂的视角切换逻辑和模块化结构。# Project Summary

## Overall Goal
Refactor and optimize a 3D satellite constellation visualization project (Three.js frontend, Python backend) to improve code maintainability and fix rendering issues during view switching in CSV mode.

## Key Knowledge
- **Tech Stack**: Three.js (ES Modules), Python (HTTP server, WebSocket server for real-time orbital data, Numba for orbit calculation).
- **Architecture**: `app.js` serves as the entry point; core logic has been modularized into `modules/` (subdirectories: `views/`, `modes/`, `ui/`).
- **Data Modes**:
    - **WS Mode (WebSocket)**: Relies on `runWsPlayback` driving `startInterpolation` every second. View switching works because `init*Scene` modules auto-render WS data, and the interpolation loop continuously corrects the view.
    - **CSV Mode**: Relies on `setInterval` and `csvState.currentTimeIdx`. Rendering is event-driven. If the index is invalid or the playback loop isn't running, the view may remain blank after switching.
- **View Switching**: Involves `clearSceneObjects()`, calling modular `init*SceneMod`, and forcing a render. Critical to reset `camera.up` and `OrbitControls` state to avoid "pole snapping" or skewed views.
- **State Management**: Uses a centralized `appState` object. Local variables in `app.js` (like `csvState`) must stay synchronized with `appState`.

## Recent Actions
- **Modular Refactoring**: Extracted configurations, math utilities, state management, and view/UI logic into separate modules, reducing `app.js` from ~1619 lines to ~1200 lines.
- **Code Cleanup**: Removed dead code (unused VVLH functions), fixed variable redeclarations (`earthRotationStartTime`, `cameraPanOffset`), and optimized resource disposal.
- **Bug Fixes**:
    - Fixed view switching "pole snapping" by disabling `OrbitControls` during transitions.
    - Fixed camera skew by resetting `camera.up.set(0, 1, 0)` on view switch.
    - Fixed CSV mode "blank screen" on switch by adding explicit `renderer.render()` calls and validating data indices before rendering.
    - Fixed double-rendering flicker in CSV playback by removing redundant `updateCurrentView()` calls.
    - Analyzed the root cause of WS vs. CSV behavior differences: WS has a self-correcting interpolation loop; CSV does not when paused.

## Current Plan
1.  **[DONE]** Analyze WS vs. CSV view switching logic to identify why WS works (interpolation兜底) and CSV fails (strict dependency on explicit calls and valid indices).
2.  **[IN PROGRESS]** Implement robust CSV view switching:
    - Ensure `switchView` calls the correct rendering functions for CSV.
    - Ensure `initXxxScene` internal calls handle camera parameters or rely on a unified post-init render.
3.  **[TODO]** Verify specific user-reported issues:
    - CSV Stop State -> Center View (should render immediately).
    - CSV Center -> First View (should not require mouse drag).
    - CSV Playing -> Third View (should have no delay).
4.  **[TODO]** Further reduce `app.js` line count by extracting remaining heavy functions (like `switchView` or playback loops) into dedicated controller modules.

## File Structure
```
web/
├── app.js                    # Main entry point (orchestration)
├── modules/
│   ├── config.js             # Constants & shared geometry
│   ├── math-utils.js         # Coordinate transforms
│   ├── state.js              # Global state container
│   ├── views/                # View modules (third/first/center person)
│   ├── modes/                # Data modes (CSV/WS)
│   └── ui/                   # UI components (tooltips, stats, controls)
└── index.html, style.css     # Frontend assets
```

---

## Summary Metadata
**Update time**: 2026-04-08T10:33:55.988Z 

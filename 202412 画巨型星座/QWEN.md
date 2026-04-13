## Qwen Added Memories
- ## 项目概况
- **名称**: 巨型星座 3D 可视化系统 (Giant Constellation Visualization)
- **技术栈**: Three.js (前端), Python (WebSocket 后端)
- **架构**: 模块化设计 (`app.js` 入口, `managers/` 逻辑, `modules/` 功能, `core/` 渲染循环)
- **核心功能**: 多视角 (第三/第一/主星) 切换, CSV/WS 数据播放, 地月模拟, 卫星独立灯光控制。

## 最近修复的 Bug 清单 (2026-04-13)
1. **主星视角灯光不匹配**: 修复了 `satelliteMeshesCenter` 索引偏移问题 (网格 `i-1` 对应数据 `i`)，并补全了缺失的灯光应用逻辑。
2. **编队面板与视角不匹配**: 在 `constellation-panel.js` 中增加了 `FORMATION_SCALE = 5`，使其 2D 投影形状与 3D 第一视角放大效果一致。
3. **CSV 循环回绕不同步**: 修复了时间索引回绕到 `startIdx` 时未重置 `startJD` 和 `startTime` 导致地球自转脱节的问题。
4. **停止态拖动时间轴地球自转**: 区分了停止/播放状态，停止时不设置 `startTime` 而是直接更新 GMST。
5. **WS 播放 55-60s 闪现**: 根本原因是方位角 360° 环绕平均错误。改用向量平均 (Vector Averaging) 修复；同时限制了 `accumulator` 最大值。
6. **刷新后 WS 渲染失败**: 修复了页面卸载时的 WS 清理逻辑及初始化时的状态强制重置。

## 关键技术细节
- **坐标转换**: 场景单位 (地球=50) <-> 数据 (米)。
- **灯光颜色**: 开灯 (黄色发光), 关灯 (视角相关: 第一视角绿/红, 主星视角黄/绿)。
- **状态同步**: `appState` 为唯一真理来源。

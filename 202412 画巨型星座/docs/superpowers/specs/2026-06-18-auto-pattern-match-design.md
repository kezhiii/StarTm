# 自动图案重匹配设计

## 目标
上传图像后，系统基于当前方位角/仰角以及卫星编队在轨旋转，自动周期性重算应点亮哪些卫星，确保图案在观察者眼中始终正确。

## 架构

在 `constellation-panel.js` 中新增 `autoMatcher` 对象，持有缓存数据 + 定时检测角度变化，触发增量重匹配。

```
constellation-panel.js
├── autoMatcher
│   ├── cachedOriginalShapePoints  // 原始 shape（M⁻¹ 变换前）
│   ├── cachedTransform             // 上次最优变换
│   ├── lastAzimuth, lastElevation  // 上次触发时的角度
│   ├── isRunning                   // 是否运行
│   ├── intervalId                  // setInterval ID
│   ├── lastMatchTime               // 上次匹配时间
│   │
│   ├── start()        // 上传图像后调用
│   ├── stop()         // 关闭面板/重置时调用
│   ├── tick()         // 每 1.5s: 检查角度变化
│   ├── reMatch()      // 执行增量匹配
│   └── updateStatusText()  // 画布上显示状态
```

## 角度监控

**数据来源：** 利用已有 `appState` 获取当前 chief ECI + 仰角/方位角计算逻辑（`render()` 中已有），抽离为 `getCurrentObsAngle()`。

**调用间隔：** `setInterval(1500ms)` 轮询

**触发条件：** `|Δazimuth| ≥ 5°` 或 `|Δelevation| ≥ 2°`

**防抖：**
- 最小触发间隔 2 秒（无论角度变化多剧烈）
- 当 elevation < 0（地平线下）跳过匹配，保持上次灯光，显示"地平线下"状态

**模式兼容：** CSV 和 WS 模式通过同一 `appState` 读取数据，共享检测逻辑。

## 增量匹配（Local Search）

跳过完整 grid search，在上次最优 transform 附近做局部搜索。

**搜索范围：**
- `scale`:  prevScale × [0.9, 1.1], 5 步
- `tx`:     prevTx ± 卫星范围 × 0.1, 3 步
- `ty`:     prevTy ± 卫星范围 × 0.1, 3 步
- `angle`:  centerAngle=0, 禁用角度搜索

**候选组合：** 5 × 3 × 3 = 45 种（vs 完整搜索的数百种）

**流程：**
1. 重算当前 M⁻¹ 矩阵（当前 chief + obs lat/lon + gmst）
2. M⁻¹ × 原始 shapePoints → 新的 effectiveShapePoints
3. 局部搜索 45 种组合，贪心算法评估 cost
4. Top-3 候选用匈牙利算法做精细搜索
5. 用 reverseNearestNeighborLighting 计算 lightMap
6. 更新 light-manager

**完整搜索回退：**
- 局部搜索 bestCost 比上次 high 50% → 局部最优，触发一次完整搜索
- 距上次完整搜索超过 30 秒 → 触发一次完整搜索防止误差累积

代码位置：
- `image-processor.js`: 新增 `incrementalMatch()` 函数
- `constellation-panel.js`: 新增 `autoMatcher` 对象

## 灯光过渡

瞬间切换（snap），每次重匹配后直接调用 `lightManager.setLight()` 更新。

## UI

不加新按钮，上传图案后自动开始。

在画布左上角或右下角显示状态文字（`render()` 中绘制）：
- `🔄 自动跟踪中` — 正常运行
- `⏸ 已暂停` — 用户点击文字暂停
- `🔭 地平线下` — elevation < 0

点击状态文字可切换暂停/恢复。

## 生命周期

| 事件 | 行为 |
|------|------|
| 上传图像成功 | `autoMatcher.start(cachedShapePoints, transform)` |
| 关闭面板 | `autoMatcher.stop()` |
| 重置灯光 | `autoMatcher.stop()` + 清空缓存 |
| 重新上传图像 | `autoMatcher.stop()` + 用新数据 `autoMatcher.start()` |
| 模式切换 | `autoMatcher.stop()`（下次上传再重新开始） |

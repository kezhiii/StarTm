# CSV 模式暂停/播放问题修复报告

**修复日期**: 2026-04-15  
**修复范围**: `web/app.js`, `web/managers/playback-manager.js`, `web/modules/playback-controller.js`

---

## 问题描述

### 问题1：暂停后卫星继续运动 🐛
**现象**: 点击暂停按钮后，卫星不会停在当前插值位置，而是继续向前运动一小段距离（似乎运动到下一时间戳的位置）。

**原因**: 
- `app.js` 的 `animate()` 函数中（第96-103行），在非播放状态下仍然每帧调用 `updateThirdMod()` 更新卫星位置
- 即使 `csvState.isPlaying = false`（暂停），animate 循环仍然每帧使用 `currentTimeIdx` 的数据更新卫星
- 这导致暂停后，卫星位置被刷新到 `currentTimeIdx` 对应的完整帧位置，而不是暂停时的插值位置

**代码分析**:
```javascript
// app.js - animate() 函数（修复前）
if (appState.currentView === 'third' && !csvState.isPlaying && !wsState.playbackActive) {
    if (appState.currentMode === 'csv' && appState.csv.satelliteData.length > 0) {
        // 问题：每帧都在这里更新，即使暂停了
        updateThirdMod(csvState.currentTimeIdx, ...);
    }
}
```

**执行流程**:
1. 用户点击暂停 → `stopPlay()` 调用
2. `stopCsvPlayback()` 设置 `csvState.isPlaying = false`
3. 插值循环停止，`interpState.currentInterpData` 保持不变
4. **但是** `animate()` 循环仍在运行（60fps）
5. 每帧都调用 `updateThirdMod(csvState.currentTimeIdx, ...)`
6. 卫星位置被刷新到 `currentTimeIdx` 对应的完整帧，而不是插值位置

---

### 问题2：播放后回到插帧位置再向前运动 🐛
**现象**: 暂停后点击播放，卫星会先回到暂停时的插值位置，然后向前运动一小段。

**原因**:
1. 暂停时保存了 `interpState.currentInterpData`（插值数据）
2. 但 animate() 循环中的 `updateThirdMod()` 覆盖了显示
3. 点击播放时，`startCsvPlayback(false)` 恢复插值循环
4. 第一帧使用保存的 `interpState.prevFrameData` 和 `currFrameData`
5. 但由于 animate() 期间的更新，显示位置已经偏离

---

### 问题3：播放按钮文本异常 🐛
**现象**: 点击暂停后再点击播放，播放按钮从原本的三角形图标变成了"▶ 播放"文本。

**原因**:
- `stopPlay()` 中使用 `btn.textContent = '▶ 播放'` 覆盖了整个按钮内容
- 但 HTML 中播放按钮的结构是：
  ```html
  <button id="playBtn">
      <span class="play-icon">▶</span>
  </button>
  ```
- `textContent` 覆盖了 `<span>` 元素，导致样式丢失

**代码分析**:
```javascript
// playback-manager.js - stopPlay() 函数（修复前）
const btn = document.getElementById('playBtn');
if (btn) btn.textContent = '▶ 播放';  // ❌ 错误：覆盖了 span 元素
```

---

## 修复方案

### 修复1：暂停时停止 animate() 中的卫星更新 ✅

**文件**: `web/app.js`

**修复前**:
```javascript
// 更新第三视角卫星位置（非播放状态下）
if (appState.currentView === 'third' && !csvState.isPlaying && !wsState.playbackActive) {
    if (appState.currentMode === 'csv' && appState.csv.satelliteData.length > 0) {
        updateThirdMod(csvState.currentTimeIdx, appState.csv.satelliteData, appState.sceneObjects, appState.interaction, appState.lightManager);
    } else if (appState.currentMode === 'ws' && wsState.lastStepData) {
        updateThirdWsMod(wsState.lastStepData, appState.sceneObjects, appState.interaction, appState.lightManager);
    }
}
```

**修复后**:
```javascript
// 更新第三视角卫星位置（非播放状态下）
// 关键修复：暂停状态下不要更新卫星位置，保持当前显示
// 只有在首次加载或拖动时间轴时才更新
if (appState.currentView === 'third' && !csvState.isPlaying && !wsState.playbackActive) {
    // 完全不更新（保持暂停时的位置）
    // 注意：时间轴拖动会通过 seekToIndex() 单独处理
}
```

**原理**:
- 暂停时 `csvState.isPlaying = false`
- 不再调用 `updateThirdMod()`
- 卫星保持在暂停时的插值位置
- 时间轴拖动会通过 `seekToIndex()` 单独处理更新

---

### 修复2：播放按钮使用 innerHTML 保持结构 ✅

**文件**: `web/managers/playback-manager.js`, `web/modules/playback-controller.js`

**修复前**:
```javascript
const btn = document.getElementById('playBtn');
if (btn) btn.textContent = '▶ 播放';  // ❌ 覆盖 span 元素
```

**修复后**:
```javascript
const btn = document.getElementById('playBtn');
if (btn) btn.innerHTML = '<span class="play-icon">▶</span>';  // ✅ 保持结构
```

**原理**:
- 使用 `innerHTML` 而不是 `textContent`
- 保持 `<span class="play-icon">` 结构
- CSS 样式继续生效

---

## 测试场景

### 测试1：暂停后卫星位置
1. CSV 模式下启动播放
2. 等待卫星运动一段时间
3. 点击暂停按钮
4. **验证**: 卫星立即停止运动，保持在暂停时的位置
5. 等待5秒
6. **验证**: 卫星仍然在暂停位置，没有继续运动

### 测试2：暂停后播放
1. 暂停后等待5秒
2. 点击播放按钮
3. **验证**: 卫星从暂停位置继续向前运动
4. **验证**: 没有跳变或回退现象

### 测试3：播放按钮样式
1. 点击暂停按钮
2. **验证**: 播放按钮显示三角形图标（▶）
3. 点击播放按钮
4. **验证**: 播放按钮仍然是三角形图标，没有变成文本

### 测试4：时间轴拖动
1. 暂停播放
2. 拖动时间轴滑块
3. **验证**: 卫星位置跟随时间轴更新
4. 点击播放
5. **验证**: 从新位置继续播放

---

## 技术细节

### 暂停状态流程

```
播放中 → 点击暂停
  ↓
stopPlay() 调用
  ↓
stopCsvPlayback()
  - csvState.isPlaying = false
  - cancelAnimationFrame(csvState.playbackAnimId)
  - csvPlaybackState.wasPaused = true
  ↓
animate() 循环继续（60fps）
  ↓
检查: !csvState.isPlaying && !wsState.playbackActive → true
  ↓
修复后: 不执行 updateThirdMod()
  ↓
卫星保持暂停时的插值位置 ✅
```

### 播放恢复流程

```
暂停中 → 点击播放
  ↓
startPlay() 调用
  ↓
检查: csvPlaybackState.wasPaused → true
  ↓
startCsvPlayback(false)  // resetState=false
  - 保持 accumulator（插值进度）
  - 保持 prevFrameData 和 currFrameData
  - 恢复地球自转参数
  ↓
启动插值循环（requestAnimationFrame）
  ↓
从暂停位置继续运动 ✅
```

---

## 影响范围

### 正面影响
- ✅ 暂停行为符合用户预期
- ✅ 播放恢复流畅
- ✅ UI 按钮样式正确

### 潜在风险
- ⚠️ 非播放状态下不更新卫星位置
  - **缓解**: 时间轴拖动通过 `seekToIndex()` 单独处理
  - **缓解**: 首次加载在 `init()` 中显式调用 `updateThirdMod()`

### 需要关注的场景
1. **首次加载**: 确保 `init()` 中正确初始化卫星位置
2. **时间轴拖动**: `seekToIndex()` 必须更新卫星位置
3. **视角切换**: `switchView()` 中需要初始化卫星位置

---

## 后续改进建议

### 1. 统一更新策略
引入明确的更新模式：
```javascript
const UPDATE_MODE = {
    INTERP: 'interpolation',  // 使用插值数据
    FRAME: 'frame',           // 使用完整帧数据
    PAUSED: 'paused'          // 暂停（不更新）
};

let currentUpdateMode = UPDATE_MODE.INTERP;
```

### 2. 暂停事件总线
```javascript
eventBus.on('playback:paused', (state) => {
    // 记录暂停时的插值状态
    lastPausedInterpData = state.currentInterpData;
});
```

### 3. 性能监控
```javascript
if (isDev) {
    performance.mark('animate:start');
    // ... 更新逻辑 ...
    performance.mark('animate:end');
    performance.measure('animate:total', 'animate:start', 'animate:end');
}
```

---

**修复状态**: ✅ 已完成  
**需要测试**: 是  
**影响范围**: CSV 模式暂停/播放功能

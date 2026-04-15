# WS/CSV 模式切换问题修复报告

**修复日期**: 2026-04-15  
**修复范围**: `web/managers/mode-manager.js`, `web/managers/playback-manager.js`

---

## 发现的问题

### 1. 状态管理不一致 🔴
**问题**: `mode-manager.js` 中使用本地变量 `currentMode` 缓存 `appState.currentMode`，但两者可能不同步。

**影响**: 切换模式后，本地变量可能与 appState 不一致，导致后续逻辑判断错误。

**修复**: 移除本地变量，直接读取 `appState.currentMode`。

### 2. switchToCsv 使用深层嵌套 setTimeout 🔴
**问题**: 
```javascript
setTimeout(() => {
    if (currentView === 'center') {
        switchView('third');
        setTimeout(() => {
            switchView('center');
            setTimeout(() => startCsvPlayback(true), 100);
        }, 100);
    }
}, 200);
```

**影响**: 
- 难以理解和维护
- 错误传播不可靠
- 时序依赖脆弱

**修复**: 简化为单次延迟，直接切换当前视角。

### 3. 切换时没有正确清理 WS 状态 🟡
**问题**: `switchToCsv` 中只关闭了连接，没有清理：
- `wsState.dataQueue`
- `wsState.lastStepData`
- `wsState.playbackActive`
- 插值状态

**影响**: 残留的 WS 数据可能导致切换后显示异常。

**修复**: 完整清理所有 WS 相关状态。

### 4. 切换时没有清理插值状态 🟡
**问题**: 从 WS 切换到 CSV 时，`interpState` 中仍然保留 WS 的帧数据。

**影响**: 可能导致插值混乱，显示错误的卫星位置。

**修复**: 在 `switchToCsv` 中重置插值状态。

### 5. 切换时地球自转参数未重置 🟡
**问题**: `switchToCsv` 没有重置 `earthRotationState`。

**影响**: 地球可能使用错误的时间基准，导致自转位置不正确。

**修复**: 使用 CSV 当前帧的时间戳重置地球自转参数。

### 6. switchToWs 未完全清理 CSV 播放状态 🟡
**问题**: 只调用了 `stopCsvPlayback()`，但没有显式清理：
- `csvState.isPlaying`
- `csvState.playbackAnimId`

**修复**: 显式清理所有 CSV 播放状态。

---

## 修复内容

### mode-manager.js

#### 修复1: 移除本地状态缓存
```javascript
// 修复前
let currentMode = appState.currentMode;
let currentView = appState.currentView;
let csvState = appState.csv.state;
let wsState = appState.ws;

// 修复后
// 直接访问 appState.xxx
```

#### 修复2: 简化 switchToCsv 逻辑
```javascript
// 修复前：深层嵌套 setTimeout（200ms → 100ms → 100ms）
setTimeout(() => {
    if (currentView === 'center') {
        switchView('third');
        setTimeout(() => {
            switchView('center');
            setTimeout(() => startCsvPlayback(true), 100);
        }, 100);
    } else {
        switchView(currentView);
        setTimeout(() => startCsvPlayback(true), 100);
    }
}, 200);

// 修复后：单次延迟
const currentView = appState.currentView;
switchView(currentView);
setTimeout(() => {
    startCsvPlayback(true);
}, 150);
```

#### 修复3: 完整清理 WS 状态
```javascript
// 新增
wsState.dataQueue = [];
wsState.lastStepData = null;
wsState.playbackActive = false;

// 清理插值状态
const interpState = appState.interpolation;
interpState.prevFrameData = null;
interpState.currFrameData = null;
interpState.currentInterpData = null;
```

#### 修复4: 重置地球自转参数
```javascript
// 新增
const earthRotationState = appState.earthRotation;
const d = parseTimestamp(group.timestamp);
earthRotationState.startJD = dateToJD(d.year, d.month, d.day, d.hour, d.minute, d.second);
earthRotationState.startTime = performance.now();
earthRotationState.speedFactor = 1;
```

#### 修复5: switchToWs 完整清理
```javascript
// 新增显式清理
stopCsvPlayback();
const csvState = appState.csv.state;
csvState.isPlaying = false;
if (csvState.playbackAnimId) {
    cancelAnimationFrame(csvState.playbackAnimId);
    csvState.playbackAnimId = null;
}
```

#### 修复6: WS 断开时不自动切换模式
```javascript
// 修复前：自动切回 CSV
onWsDisconnected: () => {
    currentMode = 'csv';
    appState.currentMode = 'csv';
}

// 修复后：由用户决定
onWsDisconnected: () => {
    console.log('[MODE-MGR] WS 断开');
}
```

---

## 测试建议

### 测试场景1: WS → CSV 切换
1. 启动应用（默认 WS 模式）
2. 等待 WS 连接成功并开始播放
3. 点击"切换到 CSV 模式"
4. **验证**:
   - WS 连接已关闭
   - CSV UI 已显示（时间滑块、开始/结束选择器）
   - 卫星正常显示
   - 地球自转位置正确

### 测试场景2: CSV → WS 切换
1. 在 CSV 模式下播放数据
2. 点击"切换到 WS 模式"
3. **验证**:
   - CSV 播放已停止
   - CSV UI 已隐藏
   - WS 连接开始
   - 连接成功后自动播放

### 测试场景3: 快速连续切换
1. 快速点击模式切换按钮
2. **验证**:
   - 没有崩溃
   - 最终状态正确
   - 没有残留的播放循环

### 测试场景4: WS 断开后切换
1. 在 WS 模式下断开后端
2. 等待重试耗尽
3. 切换到 CSV 模式
4. **验证**: 正常切换到 CSV，没有错误

---

## 后续改进建议

### 1. 引入状态机
使用 XState 或自定义状态机管理模式切换状态：
```javascript
const modeStateMachine = {
    states: ['WS_CONNECTING', 'WS_CONNECTED', 'WS_PLAYING', 
             'CSV_STOPPED', 'CSV_PLAYING', 'TRANSITIONING'],
    transitions: {
        'WS_CONNECTED' → 'TRANSITIONING' → 'CSV_PLAYING',
        'CSV_PLAYING' → 'TRANSITIONING' → 'WS_CONNECTING'
    }
};
```

### 2. 异步切换
使用 async/await 替代 setTimeout：
```javascript
async function switchToCsv() {
    await stopWsAsync();
    await cleanupWsState();
    await rebuildScene();
    await delay(150);
    startCsvPlayback(true);
}
```

### 3. 事件总线
引入事件总线解耦管理器：
```javascript
eventBus.on('mode:switch', (from, to) => { ... });
eventBus.emit('mode:switch', 'ws', 'csv');
```

---

**修复状态**: ✅ 已完成  
**需要测试**: 是  
**影响范围**: 模式切换功能

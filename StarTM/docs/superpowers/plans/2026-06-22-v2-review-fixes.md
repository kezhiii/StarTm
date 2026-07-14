# V2 审查报告全部问题修复 — 实施总计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 系统性修复 V2 代码审查报告中标记的全部问题（7 P0 + 13 P1 + 10 P2 + 死代码清理 + 架构改进），恢复功能正确性、提升渲染性能、偿还架构债务。

**Architecture:** 计划按五个阶段递进：Phase I 修复关键 Bug（P0），Phase II 清理死代码减少干扰，Phase III 性能优化（P1），Phase IV 代码质量改进（P2），Phase V 架构重构。每个 Phase 可独立交付和验证。建议每个 Phase 完成后做一次回归测试。

**Tech Stack:** JavaScript (ES Modules), Three.js, HTML5 Canvas, WebSocket, 浏览器 DevTools

**项目根目录:** `E:\project_code\serproject\StarTM\web\`

**测试方法:** 项目无自动化测试框架。每个任务通过浏览器手动验证 + DevTools 性能面板 + 控制台日志检查。

---

## 范围说明

V2 报告涵盖的问题横跨多个独立子系统。本总计划按 Phase 组织，每个 Phase 可作为独立执行单元。Phase I-III 可直接执行；Phase IV 需补充细节（特别是 Task 27 列索引）；Phase V 需单独编写详细计划。

| Phase | 范围 | 预估工作量 | 风险 |
|-------|------|-----------|------|
| I: P0 关键 Bug | 7 个 Bug，涉及 6 个文件 | 4-6 小时 | 低（局部修改） |
| II: 死代码清理 | 13 个文件 + 3 个函数 | 1 小时 | 极低 |
| III: P1 性能优化 | 12 项，涉及 10 个文件 | 5-7 小时 | 中（渲染路径） |
| IV: P2 代码质量 | 11 项（含 Task 21 CSV 延迟解析），涉及 9 个文件 | 6-10 小时 | 中-高（Task 21 高风险） |
| V: 架构改进 | playback-manager 拆分、appState 接口化 | 8-12 小时 | 高（需单独详细计划） |

---

## Phase I: P0 关键 Bug 修复

### Task 1: 方位角 0/360 度环绕修复

**Files:**
- Modify: `modules/views/first-person.js:261,262` (CSV 版本)
- Modify: `modules/views/first-person.js:508,509` (WS 版本)

- [ ] **Step 1: 修复 CSV 版本的方位角计算（第 261 行）**

找到 `updateSatellitesFirstPerson()` 函数内第 260-262 行：

```javascript
// 修改前（第 261-262 行）
const azR = centerAz * DEG + (local.az * DEG - centerAz * DEG) * FORMATION_SCALE;
const elR = centerEl * DEG + (local.el * DEG - centerEl * DEG) * FORMATION_SCALE;
```

替换为：

```javascript
// 修改后 — 角度差规范化到 [-180, 180]
let dAz = local.az - centerAz;
if (dAz > 180) dAz -= 360;
if (dAz < -180) dAz += 360;
const azR = centerAz * DEG + dAz * DEG * FORMATION_SCALE;
const elR = centerEl * DEG + (local.el - centerEl) * DEG * FORMATION_SCALE;
```

- [ ] **Step 2: 修复 WS 版本的方位角计算（第 508 行）**

找到 `updateSatellitesFirstPersonWs()` 函数内第 507-509 行，应用完全相同的修改：

```javascript
// 修改前（第 508-509 行）
const azR = centerAz * DEG + (local.az * DEG - centerAz * DEG) * FORMATION_SCALE;
const elR = centerEl * DEG + (local.el * DEG - centerEl * DEG) * FORMATION_SCALE;
```

替换为：

```javascript
// 修改后
let dAz = local.az - centerAz;
if (dAz > 180) dAz -= 360;
if (dAz < -180) dAz += 360;
const azR = centerAz * DEG + dAz * DEG * FORMATION_SCALE;
const elR = centerEl * DEG + (local.el - centerEl) * DEG * FORMATION_SCALE;
```

- [ ] **Step 3: 手动验证**

在浏览器中切换到第一人称视角，找到一个编队跨越方位角 0/360 度边界的时间点。验证卫星不再被放到错误的天空位置。

- [ ] **Step 4: 提交**

```bash
git add modules/views/first-person.js
git commit -m "fix: normalize azimuth angle difference to [-180,180] to fix 0/360 wraparound"
```

---

### Task 2: material.disposed 无效检查替换

**Files:**
- Modify: `modules/light-manager.js:157`

- [ ] **Step 1: 替换失效的 disposed 检查**

找到 `_updateSatelliteLight()` 函数内第 156-159 行：

```javascript
// 修改前（第 157 行）
if (!mesh.material || mesh.material.disposed || !mesh.parent) {
    return;
}
```

替换为：

```javascript
// 修改后 — 移除不存在的 disposed 属性，保留 mesh.parent 检查
if (!mesh.material || !mesh.parent) {
    return;
}
```

Three.js 的 `Material` 类没有 `disposed` 公开属性。`mesh.parent` 为 null 已经覆盖了 mesh 已从场景移除的情况。

- [ ] **Step 2: 手动验证**

在 DevTools Console 中执行以下检查，确认无错误：

```javascript
// 切换视角多次，观察控制台无 WebGL 材质相关报错
```

- [ ] **Step 3: 提交**

```bash
git add modules/light-manager.js
git commit -m "fix: remove invalid material.disposed check in light-manager"
```

---

### Task 3: appState.domCache 初始化

**Files:**
- Modify: `app.js`（初始化阶段，约第 335-400 行区域）

- [ ] **Step 1: 在 app.js 初始化阶段创建 domCache**

在 `app.js` 的 `init()` 函数中，在 `appState` 创建之后、各模块初始化之前，添加 domCache 初始化：

```javascript
// 在 appState 创建后添加
// 初始化 DOM 缓存 — 缓存高频访问的 DOM 元素
const domElements = [
    'coordDisplay',      // interpolation.js, first-person.js, center-person.js
    'timeDisplay',       // interpolation.js, first-person.js
    'visibleCount',      // interpolation.js, first-person.js
    'azimuth-display',   // first-person.js, center-person.js
    'elevation-display'  // first-person.js, center-person.js
];
appState.domCache = new Map();
for (const id of domElements) {
    const el = document.getElementById(id);
    if (el) appState.domCache.set(id, el);
}
```

注意：这 5 个 ID 是当前代码中所有 `domCache.get()` 调用使用的完整列表（已验证）。如果后续有新元素需要缓存，只需在此数组中追加。

- [ ] **Step 2: 验证 domCache 生效**

在 DevTools Console 中运行：

```javascript
// 检查 domCache 是否正确初始化
console.log(appState.domCache.size); // 应为 5
console.log(appState.domCache.get('coordDisplay')); // 应为 HTML 元素
```

- [ ] **Step 3: 提交**

```bash
git add app.js
git commit -m "fix: initialize appState.domCache to enable DOM caching"
```

---

### Task 4: slider 空指针防护

**Files:**
- Modify: `managers/ui-manager.js:64-67`

- [ ] **Step 1: 添加 slider 空检查**

找到 `initTimeControls()` 函数内第 63-67 行：

```javascript
// 修改前（第 64-67 行）
        slider.max = Math.max(0, appState.csv.timeIndices.length - 1);
        slider.addEventListener('input', () => {
            seekToIndex(parseInt(slider.value));
        });
    }
```

替换为：

```javascript
// 修改后 — 添加空检查
        if (slider) {
            slider.max = Math.max(0, appState.csv.timeIndices.length - 1);
            slider.addEventListener('input', () => {
                seekToIndex(parseInt(slider.value));
            });
        }
    }
```

- [ ] **Step 2: 验证**

在 DevTools 中临时隐藏 `#timeSlider` 元素后刷新页面，确认无 TypeError 抛出。

- [ ] **Step 3: 提交**

```bash
git add managers/ui-manager.js
git commit -m "fix: add null check for timeSlider element"
```

---

### Task 5: changeSpeed() 竞态条件修复

**Files:**
- Modify: `managers/playback-manager.js:896-935`

- [ ] **Step 1: 添加防抖锁，防止快速连按**

在模块级变量区域（第 20-28 行附近）添加锁变量：

```javascript
let _changeSpeedLock = false;
```

然后在 `changeSpeed()` 函数（第 896 行）中，用 `try/finally` 包裹原有逻辑：

```javascript
function changeSpeed() {
    DBG.log(`changeSpeed: wasPaused=${csvPlaybackState.wasPaused}, isPlaying=${csvState.isPlaying}`);
    if (_changeSpeedLock) {
        DBG.log('changeSpeed: locked, skip');
        return;
    }
    _changeSpeedLock = true;
    try {
        // ... 保留原有函数体（第 898-980 行全部逻辑）...
    } finally {
        _changeSpeedLock = false;
    }
}
```

- [ ] **Step 2: 手动验证**

快速连续点击速度切换按钮 5 次，确认无双重递增或状态异常。

- [ ] **Step 3: 提交**

```bash
git add managers/playback-manager.js
git commit -m "fix: add debounce lock to changeSpeed to prevent race condition"
```

---

### Task 6: WebSocket 连接状态竞态修复

**Files:**
- Modify: `managers/playback-manager.js:636-645`

- [ ] **Step 1: 在 connectWebSocket 中添加连接代际标记**

在模块级变量区域添加代际计数器：

```javascript
let _wsGeneration = 0;  // 连接代际，用于检测过期回调
```

在 `connectWebSocket()` 函数（第 636 行）中，递增代际并在 onclose 中检查：

```javascript
function connectWebSocket(autoPlay = false, onConnected, onDisconnected) {
    _wsGeneration++;  // 新连接 = 新代际
    const currentGen = _wsGeneration;
    console.log('[WS] 开始连接, autoPlay=', autoPlay, 'gen=', currentGen);

    // 清理旧连接
    if (wsState.connection) {
        const readyState = wsState.connection.readyState;
        console.log('[WS] 发现旧连接, readyState=', readyState);
        if (readyState === WebSocket.CONNECTING || readyState === WebSocket.OPEN) {
            wsState.connection.onclose = null;
            wsState.connection.close();
        }
        wsState.connection = null;
    }

    // ... 创建新 WebSocket ...
    // 在 onclose 回调中添加代际检查：
    ws.onclose = (event) => {
        if (currentGen !== _wsGeneration) {
            console.log('[WS] 忽略过期连接的 onclose (gen mismatch)');
            return;  // 这是旧连接的回调，忽略
        }
        // ... 原有 onclose 逻辑 ...
    };
}
```

- [ ] **Step 2: 同时修复 visibilitychange 监听器泄漏**

在 `setupVisibilityHandler()` 函数（第 592 行）中，将匿名函数改为命名函数引用：

```javascript
// 修改前（第 603 行）
document.addEventListener('visibilitychange', () => { ... });

// 修改后 — 使用命名函数，支持移除
function _onVisibilityChange() {
    if (!wsState.connection || wsState.connection.readyState !== WebSocket.OPEN) {
        return;
    }
    // ... 原有逻辑（第 608-627 行）...
}

// 移除旧的（如果存在）
if (wsState._visibilityHandler) {
    document.removeEventListener('visibilitychange', wsState._visibilityHandler);
}
wsState._visibilityHandler = _onVisibilityChange;
document.addEventListener('visibilitychange', _onVisibilityChange);
```

- [ ] **Step 3: 手动验证**

1. 连接 WebSocket，断开，再连接 — 确认无意外重连
2. 在 DevTools Event Listeners 面板中检查 `visibilitychange` 监听器数量为 1

- [ ] **Step 4: 提交**

```bash
git add managers/playback-manager.js
git commit -m "fix: add generation counter to WebSocket to prevent stale onclose race; fix visibilitychange listener leak"
```

---

### Task 7: Escape 键监听器泄漏修复

**Files:**
- Modify: `modules/ui/constellation-panel.js:366-370`

- [ ] **Step 1: 将匿名监听改为命名函数 + 清理机制**

找到 `init()` 函数内第 365-370 行：

```javascript
// 修改前（第 366-370 行）
    // Escape键退出全屏
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isFullscreen) {
            fullscreenBtn.click();
        }
    });
```

替换为：

```javascript
// 修改后 — 命名函数 + 清理
    // 移除旧的监听器（如果面板被重建）
    if (window._constellationEscHandler) {
        document.removeEventListener('keydown', window._constellationEscHandler);
    }
    window._constellationEscHandler = (e) => {
        if (e.key === 'Escape' && isFullscreen) {
            fullscreenBtn.click();
        }
    };
    document.addEventListener('keydown', window._constellationEscHandler);
```

- [ ] **Step 2: 手动验证**

多次打开/关闭编队面板后，在 DevTools Event Listeners 中检查 `keydown` 监听器数量不增长。

- [ ] **Step 3: 提交**

```bash
git add modules/ui/constellation-panel.js
git commit -m "fix: prevent Escape key listener leak in constellation-panel"
```

---

## Phase II: 死代码清理

### Task 8: 删除死代码文件（13 个）

**Files:**
- Delete: `core/bootstrap.js` (146 行)
- Delete: `core/di-container.js` (87 行)
- Delete: `core/dom-cache.js` (153 行)
- Delete: `core/engine.js` (83 行)
- Delete: `core/render-loop.js` (82 行)
- Delete: `modules/playback-controller.js` (204 行)
- Delete: `modules/view-switcher.js` (21 行)
- Delete: `managers/view-manager.js` (170 行)
- Delete: `modules/modes/index.js` (3 行) — V2 遗漏
- Delete: `modules/modes/csv-mode.js` (206 行) — V2 遗漏
- Delete: `modules/modes/ws-mode.js` (296 行) — V2 遗漏
- Delete: `modules/ui/index.js` (5 行) — V2 遗漏
- Delete: `modules/ui/time-controls.js` (129 行) — V2 遗漏

- [ ] **Step 1: 确认无活跃导入**

运行以下命令确认这些文件不被任何活跃代码导入：

```bash
cd "E:/project_code/serproject/StarTM/web"
grep -rn "bootstrap\|di-container\|dom-cache\|core/engine\|render-loop\|playback-controller\|view-switcher\|view-manager\|modes/index\|modes/csv-mode\|modes/ws-mode\|ui/index\|ui/time-controls" --include="*.js" --include="*.html" | grep -v "^core/bootstrap\|^core/di-container\|^core/dom-cache\|^core/engine\|^core/render-loop\|^modules/playback-controller\|^modules/view-switcher\|^managers/view-manager\|^modules/modes\|^modules/ui/index\|^modules/ui/time-controls"
```

预期结果：无匹配输出。

- [ ] **Step 2: 删除文件（移入回收站）**

```bash
# Windows: 使用 PowerShell 移入回收站
powershell -Command "Add-Type -AssemblyName Microsoft.VisualBasic; @('core/bootstrap.js','core/di-container.js','core/dom-cache.js','core/engine.js','core/render-loop.js','modules/playback-controller.js','modules/view-switcher.js','managers/view-manager.js','modules/modes/index.js','modules/modes/csv-mode.js','modules/modes/ws-mode.js','modules/ui/index.js','modules/ui/time-controls.js') | ForEach-Object { [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile((Resolve-Path $_), 'OnlyErrorDialogs', 'SendToRecycleBin') }"
```

- [ ] **Step 3: 删除空的 modes 目录**

```bash
# 如果 modes/ 目录下已无文件
rmdir modules/modes 2>nul
```

- [ ] **Step 4: 验证项目正常运行**

在浏览器中打开项目，确认所有功能正常（视角切换、CSV 播放、WS 播放、编队面板）。

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "chore: remove 13 dead code files (~1585 lines)"
```

---

### Task 9: 清理函数级死代码

**Files:**
- Modify: `modules/moon-orbit.js:51-72` (删除 `calcMoonECI`)
- Modify: `modules/views/third-person.js:39-42` (删除 `latLonToSurface3D`)
- Modify: `modules/light-timeline.js:281-283` (删除 `toggleForm`)

- [ ] **Step 1: 删除 calcMoonECI（moon-orbit.js 第 51-72 行）**

删除以下函数（已导出但从未被导入）：

```javascript
// 删除整个函数（第 44-72 行，含 JSDoc 注释）
/**
 * 计算月球ECI坐标
 * @param {number} startJD - 起始儒略日
 * @param {number} elapsedMs - 从起始时间经过的毫秒数（模拟时间）
 * @returns {Object} 月球ECI坐标（米）
 */
export function calcMoonECI(startJD, elapsedMs) {
    // ... 第 52-71 行全部删除
}
```

- [ ] **Step 2: 删除 latLonToSurface3D（third-person.js 第 36-42 行）**

删除以下函数（本地函数，从未被调用）：

```javascript
// 删除（第 36-42 行）
/**
 * 经纬度转 3D 表面坐标
 */
function latLonToSurface3D(lat, lon) {
    const latR = lat * DEG, lonR = lon * DEG;
    return new THREE.Vector3(RE_3D * Math.cos(latR) * Math.cos(lonR), RE_3D * Math.sin(latR), -RE_3D * Math.cos(latR) * Math.sin(lonR));
}
```

- [ ] **Step 3: 删除 toggleForm（light-timeline.js 第 281-283 行）**

删除以下函数（未导出也未内部调用）：

```javascript
// 删除（第 281-283 行）
    function toggleForm() {
        addForm.style.display = 'flex';
    }
```

- [ ] **Step 4: 验证**

在浏览器中确认月球显示、第三人称视角、灯光时间线功能正常。

- [ ] **Step 5: 提交**

```bash
git add modules/moon-orbit.js modules/views/third-person.js modules/light-timeline.js
git commit -m "chore: remove 3 dead functions (calcMoonECI, latLonToSurface3D, toggleForm)"
```

---

## Phase III: P1 性能优化

### Task 10: applyAll() 改为脏标记增量更新

**Files:**
- Modify: `modules/light-manager.js:191-195`

- [ ] **Step 1: 添加脏标记机制**

在 `createLightManager()` 函数内，找到 `applyAll()` 方法（第 191 行），替换为：

```javascript
// 在 lightStates 声明附近添加
let _dirtyIndices = new Set();  // 脏标记：记录状态变化的卫星索引
let _allDirty = true;  // 初始全量更新

// 替换 applyAll（第 191-195 行）
applyAll() {
    if (_allDirty) {
        lightStates.forEach((state, idx) => {
            this._updateSatelliteLight(idx, state.isOn);
        });
        _allDirty = false;
        _dirtyIndices.clear();
    } else if (_dirtyIndices.size > 0) {
        _dirtyIndices.forEach(idx => {
            const state = lightStates[idx];
            if (state) this._updateSatelliteLight(idx, state.isOn);
        });
        _dirtyIndices.clear();
    }
    // 无脏标记时：零操作
},
```

同时需要在修改状态的方法中添加脏标记：

```javascript
// setLight（第 46-54 行）— 添加脏标记
setLight(satIdx, isOn) {
    if (!lightStates.has(satIdx)) {
        console.warn(`[LIGHT] 卫星 ${satIdx} 不存在`);
        return;
    }
    lightStates.set(satIdx, { isOn });
    _dirtyIndices.add(satIdx);  // 新增
    // 注意：移除 this._updateSatelliteLight(satIdx, isOn) 的直接调用
    // 改为在 applyAll() 中统一处理
},

// toggleLight（第 60-68 行）— 添加脏标记
toggleLight(satIdx) {
    const state = lightStates.get(satIdx);
    if (state) {
        const newState = !state.isOn;
        lightStates.set(satIdx, { isOn: newState });
        _dirtyIndices.add(satIdx);  // 新增
        // 注意：移除 this._updateSatelliteLight(satIdx, newState) 的直接调用
        return newState;
    }
    return false;
},

// setAllLights — 标记全量脏
setAllLights(isOn) {
    lightStates.forEach((state, idx) => {
        state.isOn = isOn;
    });
    _allDirty = true;  // 新增
},
```

**注意**：`setLight` 和 `toggleLight` 中移除了 `_updateSatelliteLight` 的直接调用，改为在下一帧 `applyAll()` 中统一处理。这意味着灯光状态变化会有最多 1 帧（~16ms）的延迟，用户不可感知。如果需要即时反馈，可保留 `_updateSatelliteLight` 直接调用并同时设置脏标记（此时脏标记用于 `applyAll` 跳过已更新的卫星）。

- [ ] **Step 2: 验证性能提升**

在 DevTools Performance 面板录制 5 秒动画，对比修改前后的 `applyAll` 执行时间。预期从 ~2ms/帧降到 <0.1ms/帧。

- [ ] **Step 3: 提交**

```bash
git add modules/light-manager.js
git commit -m "perf: replace applyAll full update with dirty-flag incremental update"
```

---

### Task 11: 第三人称视角 DOM 缓存

**Files:**
- Modify: `modules/views/third-person.js:130-200`

- [ ] **Step 1: 缓存 coordDisplay 元素引用**

在 `third-person.js` 模块级作用域添加缓存变量：

```javascript
// 在文件顶部 import 语句后添加
let _coordDisplayCache = null;
```

在 `updateSatellitesThirdPerson()` 函数（第 130 行）中，替换第 137 行：

```javascript
// 修改前（第 137 行）
const coordDisplay = document.getElementById('coordDisplay');

// 修改后
if (!_coordDisplayCache) _coordDisplayCache = document.getElementById('coordDisplay');
const coordDisplay = _coordDisplayCache;
```

在 `updateSatellitesThirdPersonWs()` 函数（第 173 行）中，替换第 192 行，应用相同修改。

- [ ] **Step 2: 验证**

在 DevTools Performance 面板中录制，确认无重复 `getElementById` 调用。

- [ ] **Step 3: 提交**

```bash
git add modules/views/third-person.js
git commit -m "perf: cache coordDisplay DOM reference in third-person view"
```

---

### Task 12: 第一人称视角坐标转换缓存（消除 2N 重复计算）

**Files:**
- Modify: `modules/views/first-person.js:220-268` (CSV 版本)
- Modify: `modules/views/first-person.js:456-515` (WS 版本，相同模式)

- [ ] **Step 1: 缓存第一遍的 eciToEcef + ecefToLocal 结果**

找到 `updateSatellitesFirstPerson()` 函数（第 200 行），将第一遍和第二遍的重复坐标变换合并为单次计算：

```javascript
// 修改前（第 220-268 行）— 两遍各调用一次 eciToEcef + ecefToLocal
// 第一遍：计算编队中心方向
let centerAzSumX = 0, centerAzSumY = 0, centerElSum = 0;
for (let i = 0; i < satCount; i++) {
    const sat = sats[i];
    const ecef = eciToEcef(sat.X, sat.Y, sat.Z, gmst);
    const local = ecefToLocal(ecef.x, ecef.y, ecef.z, currentLat, currentLon);
    // ... 累加 centerAz/centerEl ...
}
// 第二遍：又调用一次 eciToEcef + ecefToLocal
for (let idx = 0; idx < satCount; idx++) {
    const sat = sats[idx];
    const ecef = eciToEcef(sat.X, sat.Y, sat.Z, gmst);
    const local = ecefToLocal(ecef.x, ecef.y, ecef.z, currentLat, currentLon);
    // ... 使用 local ...
}

// 修改后 — 单次遍历缓存所有 local 坐标
const localCoords = new Array(satCount);

// 第一遍：计算 local 坐标 + 编队中心方向
let centerAzSumX = 0, centerAzSumY = 0, centerElSum = 0;
for (let i = 0; i < satCount; i++) {
    const sat = sats[i];
    const ecef = eciToEcef(sat.X, sat.Y, sat.Z, gmst);
    const local = ecefToLocal(ecef.x, ecef.y, ecef.z, currentLat, currentLon);
    localCoords[i] = local;  // 缓存
    const azRad = local.az * DEG;
    centerAzSumX += Math.cos(azRad);
    centerAzSumY += Math.sin(azRad);
    centerElSum += local.el;
}

let centerAz = 0, centerEl = 0;
if (satCount > 0) {
    centerAz = Math.atan2(centerAzSumY, centerAzSumX) / DEG;
    if (centerAz < 0) centerAz += 360;
    centerEl = centerElSum / satCount;
}

// 第二遍：使用缓存的 local 坐标（不再重复 eciToEcef/ecefToLocal）
let visibleCount = 0;
const lightMgr = appState.lightManager;
const hasLightMgr = !!lightMgr;

for (let idx = 0; idx < satCount && idx < meshes.length; idx++) {
    const mesh = meshes[idx];
    const local = localCoords[idx];  // 从缓存取
    mesh.visible = true;
    // ... 其余逻辑不变，但使用缓存的 local ...
}
```

- [ ] **Step 2: 对 WS 版本 `updateSatellitesFirstPersonWs()` 应用相同修改**

找到该函数（第 456 行），应用相同的缓存模式。

- [ ] **Step 3: 验证**

切换到第一人称视角，确认卫星位置与修改前一致。在 DevTools Performance 中对比每帧 `eciToEcef`/`ecefToLocal` 调用次数从 2N 降到 N。

- [ ] **Step 4: 提交**

```bash
git add modules/views/first-person.js
git commit -m "perf: cache eciToEcef+ecefToLocal results to eliminate 2N coordinate transforms"
```

---

### Task 13: BFS shift() 替换为索引递增

**Files:**
- Modify: `modules/image-processor.js:199-200` (连通域 BFS)
- Modify: `modules/image-processor.js:714-715` (匈牙利 BFS)

- [ ] **Step 1: 修复连通域 BFS（第 199-200 行）**

```javascript
// 修改前（第 195-200 行）
const queue = [{x, y}];
const pixels = [];
labels[idx] = currentLabel;

while (queue.length > 0) {
    const p = queue.shift();

// 修改后 — 使用索引递增代替 shift
const queue = [{x, y}];
const pixels = [];
labels[idx] = currentLabel;

let qHead = 0;
while (qHead < queue.length) {
    const p = queue[qHead++];
```

- [ ] **Step 2: 修复匈牙利 BFS（第 714-715 行）**

```javascript
// 修改前（第 708-715 行）
const queue = [i];
visitedX[i] = true;

let found = false;
let lastY = -1;

while (queue.length > 0 && !found) {
    const x = queue.shift();

// 修改后
const queue = [i];
visitedX[i] = true;

let found = false;
let lastY = -1;

let qHead = 0;
while (qHead < queue.length && !found) {
    const x = queue[qHead++];
```

- [ ] **Step 3: 验证**

上传一张测试图片进行星座图案匹配，确认匹配结果与修改前一致。

- [ ] **Step 4: 提交**

```bash
git add modules/image-processor.js
git commit -m "perf: replace BFS queue.shift() with index pointer in image-processor"
```

---

### Task 14: farthestPointSample splice 替换为标记法

**Files:**
- Modify: `modules/image-processor.js:410-455`

- [ ] **Step 1: 用标记法替代 splice**

```javascript
// 修改前（第 410-455 行）— splice 版本
function farthestPointSample(points, n) {
    if (points.length <= n) return points;
    const selected = [];
    const remaining = [...points];
    // ... splice 操作 ...
}

// 修改后 — 标记法（不修改数组结构）
function farthestPointSample(points, n) {
    if (points.length <= n) return points;

    const selected = [];
    const used = new Uint8Array(points.length);  // 标记已选

    // 选择第一个点（质心最近的点）
    let cx = 0, cy = 0;
    for (const p of points) { cx += p.x; cy += p.y; }
    cx /= points.length;
    cy /= points.length;

    let minDist = Infinity;
    let firstIdx = 0;
    for (let i = 0; i < points.length; i++) {
        const d = distance(points[i], { x: cx, y: cy });
        if (d < minDist) { minDist = d; firstIdx = i; }
    }
    selected.push(points[firstIdx]);
    used[firstIdx] = 1;

    // 维护每个点到最近已选点的距离
    const minDists = new Float64Array(points.length).fill(Infinity);

    while (selected.length < n) {
        const lastSelected = selected[selected.length - 1];
        let maxMinDist = -1;
        let bestIdx = -1;

        for (let i = 0; i < points.length; i++) {
            if (used[i]) continue;
            const d = distance(points[i], lastSelected);
            if (d < minDists[i]) minDists[i] = d;
            if (minDists[i] > maxMinDist) {
                maxMinDist = minDists[i];
                bestIdx = i;
            }
        }

        if (bestIdx === -1) break;
        selected.push(points[bestIdx]);
        used[bestIdx] = 1;
    }

    return selected;
}
```

- [ ] **Step 2: 验证**

上传不同尺寸的图片进行图案匹配，确认采样结果与修改前视觉一致。

- [ ] **Step 3: 提交**

```bash
git add modules/image-processor.js
git commit -m "perf: replace splice with mark-as-used in farthestPointSample"
```

---

### Task 15: 星空球体几何精度降低

**Files:**
- Modify: `modules/star-field.js:25`

- [ ] **Step 1: 降低球体分段数**

```javascript
// 修改前（第 25 行）
const starGeometry = new THREE.SphereGeometry(10000, 64, 32);

// 修改后 — 从内部观察，32x16 已足够
const starGeometry = new THREE.SphereGeometry(10000, 32, 16);
```

这将三角面数从 4096 降到 1024，减少 75% 顶点。

- [ ] **Step 2: 验证**

观察星空背景，确认无明显视觉差异（特别是纹理接缝和极点区域）。

- [ ] **Step 3: 提交**

```bash
git add modules/star-field.js
git commit -m "perf: reduce star sphere geometry from 64x32 to 32x16 segments"
```

---

### Task 16: 视角切换消除冗余渲染帧

**Files:**
- Modify: `app.js:269-275`

- [ ] **Step 1: 移除冗余的嵌套 requestAnimationFrame**

找到 `switchView()` 函数内第 269-275 行：

```javascript
// 修改前（第 269-275 行）
            appCtx.renderer.render(appCtx.scene, appCtx.camera);
            requestAnimationFrame(() => {
                appCtx.renderer.render(appCtx.scene, appCtx.camera);
                requestAnimationFrame(() => {
                    appCtx.renderer.render(appCtx.scene, appCtx.camera);
                });
            });

// 修改后 — 只渲染一次
            appCtx.renderer.render(appCtx.scene, appCtx.camera);
```

- [ ] **Step 2: 验证**

切换视角，确认画面无闪烁或延迟。

- [ ] **Step 3: 提交**

```bash
git add app.js
git commit -m "perf: remove redundant triple render frames on view switch"
```

---

### Task 17: WS 渲染循环添加脏检查跳过冗余插值

**Files:**
- Modify: `managers/playback-manager.js:493-529`

- [ ] **Step 1: 添加进度变化阈值检查**

在 `renderLoop()` 函数（第 493 行）中添加跳过逻辑：

```javascript
// 修改前（第 506-526 行）
            const progress = Math.min(wsState.renderAccumulator / RENDER_INTERVAL, 1.0);

            if (interpState.currFrameData) {
                const interpData = interpolateSatellites(
                    interpState.prevFrameData,
                    interpState.currFrameData,
                    progress
                );
                // ... 视角更新 ...
            }

// 修改后 — 添加脏检查
            const progress = Math.min(wsState.renderAccumulator / RENDER_INTERVAL, 1.0);

            // 跳过冗余帧：进度变化 < 1% 且已有插值结果时跳过
            const progressDelta = Math.abs(progress - (interpState.currentProgress || 0));
            if (interpState.currFrameData && (progressDelta > 0.01 || !interpState.currentInterpData)) {
                const interpData = interpolateSatellites(
                    interpState.prevFrameData,
                    interpState.currFrameData,
                    progress
                );
                interpState.currentInterpData = interpData;
                interpState.currentProgress = progress;

                const currentView = appState.currentView;
                if (currentView === 'third') {
                    updateSatellitesThirdPersonInterp(interpData, appState.sceneObjects, appState.interaction, appState);
                } else if (currentView === 'first') {
                    updateSatellitesFirstPersonInterp(interpData, appState);
                } else {
                    updateSatellitesCenterPersonInterp(interpData, appState, camera, cameraPanOffset, modules.updateCenterPersonCamera);
                }
            }
```

- [ ] **Step 2: 验证**

在 DevTools Performance 面板中观察 WS 模式下的帧耗时，确认 59/60 帧跳过了插值计算。

- [ ] **Step 3: 提交**

```bash
git add managers/playback-manager.js
git commit -m "perf: skip redundant interpolation when progress change is below 1%"
```

---

### Task 18: WS 数据队列 shift() 替换为 slice

**Files:**
- Modify: `managers/playback-manager.js:761`

- [ ] **Step 1: 用单次 slice 替代 while+shift 循环**

```javascript
// 修改前（第 761 行）
while (wsState.dataQueue.length > WS_MAX_QUEUE_SIZE) wsState.dataQueue.shift();

// 修改后 — 一次性裁剪，O(n) 而非 O(n*k)
if (wsState.dataQueue.length > WS_MAX_QUEUE_SIZE) {
    wsState.dataQueue = wsState.dataQueue.slice(-WS_MAX_QUEUE_SIZE);
}
```

- [ ] **Step 2: 提交**

```bash
git add managers/playback-manager.js
git commit -m "perf: replace while+shift queue trim with single slice"
```

---

### Task 19: Canvas 渐变缓存为预渲染精灵

**Files:**
- Modify: `modules/ui/constellation-panel.js` (渐变创建区域)

- [ ] **Step 1: 创建并缓存预渲染发光精灵**

在 `createConstellationPanel()` 闭包内添加缓存：

```javascript
// 在模块闭包内添加
let _glowSpriteCache = null;

function getGlowSprite(ctx, radius, color) {
    const cacheKey = `${radius}_${color}`;
    if (!_glowSpriteCache) _glowSpriteCache = new Map();
    if (_glowSpriteCache.has(cacheKey)) return _glowSpriteCache.get(cacheKey);

    // 创建离屏 canvas 预渲染
    const offscreen = document.createElement('canvas');
    offscreen.width = radius * 2;
    offscreen.height = radius * 2;
    const offCtx = offscreen.getContext('2d');
    const gradient = offCtx.createRadialGradient(radius, radius, 0, radius, radius, radius);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, 'transparent');
    offCtx.fillStyle = gradient;
    offCtx.fillRect(0, 0, radius * 2, radius * 2);

    _glowSpriteCache.set(cacheKey, offscreen);
    return offscreen;
}
```

在使用 `createRadialGradient` 的位置替换为 `ctx.drawImage(getGlowSprite(ctx, radius, color), x - radius, y - radius)`。

- [ ] **Step 2: 验证**

全开灯 200 颗卫星，观察 Canvas 绘制性能是否提升。

- [ ] **Step 3: 提交**

```bash
git add modules/ui/constellation-panel.js
git commit -m "perf: cache pre-rendered glow sprites to avoid per-frame gradient creation"
```

---

### Task 20: 灯光时间线 DOM 批量创建

**Files:**
- Modify: `modules/light-timeline.js:214-249`

- [ ] **Step 1: 使用 DocumentFragment 批量添加**

替换 `renderSatelliteGrid()` 函数（第 214-249 行）中的逐个 `appendChild`：

```javascript
// 修改前（第 230-249 行）— 逐个创建和添加
for (let i = 0; i < satCount; i++) {
    const item = document.createElement('label');
    // ... 设置样式和内容 ...
    grid.appendChild(item);
}

// 修改后 — 使用 DocumentFragment + innerHTML 批量创建
const fragment = document.createDocumentFragment();
const items = [];
for (let i = 0; i < satCount; i++) {
    items.push(`<label style="display:flex;align-items:center;justify-content:center;gap:2px;padding:2px 4px;background:rgba(20,40,60,0.6);border-radius:2px;cursor:pointer;font-size:10px;color:#fff;"><input type="checkbox" value="${i}" class="sat-checkbox" style="cursor:pointer;"><span>${i}</span></label>`);
}
const wrapper = document.createElement('div');
wrapper.innerHTML = items.join('');
while (wrapper.firstChild) fragment.appendChild(wrapper.firstChild);
grid.appendChild(fragment);
```

- [ ] **Step 2: 提交**

```bash
git add modules/light-timeline.js
git commit -m "perf: batch DOM creation in light-timeline with DocumentFragment"
```

---

### Task 21: CSV 大数据集优化（延迟解析）— 降级为 P2，移至 Phase IV

> **风险等级：高**。此任务需要修改所有 `satelliteData[i]` 的读取方（`playback-manager.js`、`interpolation.js`、`constellation-panel.js` 等），影响范围大。建议分两步执行：第一步添加 `getFrameData()` 并保持 `satelliteData` 兼容，第二步逐步迁移调用方。

**Files:**
- Modify: `managers/csv-manager.js:87-107`

- [ ] **Step 1: 改用延迟解析，避免一次性创建百万对象**

将 `parseCompactApiData()` 中的全量 `.map()` 改为按需解析：

```javascript
// 修改前（第 90-107 行）— 一次性创建所有对象
appState.csv.satelliteData = timestamps.map((ts, i) => ({
    timestamp: ts,
    sats: data[i].map(satArray => ({ ... }))
}));

// 修改后 — 存储原始数据，按需解析
appState.csv._rawData = data;  // 保留原始数组
appState.csv.satelliteData = null;  // 不再预创建

// 添加按需解析函数
function getFrameData(frameIdx) {
    if (!appState.csv._rawData) return null;
    const ts = timestamps[frameIdx];
    const frameData = appState.csv._rawData[frameIdx];
    return {
        timestamp: ts,
        sats: frameData.map(satArray => ({
            sat_id: satArray[COL.sat_id],
            a: satArray[COL.a], e: satArray[COL.e], i: satArray[COL.i],
            OMG: satArray[COL.OMG], omg: satArray[COL.omg], f: satArray[COL.f],
            X: satArray[COL.X], Y: satArray[COL.Y], Z: satArray[COL.Z],
            Vx: satArray[COL.Vx], Vy: satArray[COL.Vy], Vz: satArray[COL.Vz]
        }))
    };
}

// 导出供其他模块使用
appState.csv.getFrameData = getFrameData;
```

注意：此任务影响范围较大，需要同步更新 `satelliteData` 的所有读取方（`playback-manager.js`、`interpolation.js` 等），将 `appState.csv.satelliteData[i]` 替换为 `appState.csv.getFrameData(i)`。建议分两步：先添加 `getFrameData` 并保持 `satelliteData` 兼容，再逐步迁移调用方。

- [ ] **Step 2: 验证**

加载 10000 帧 x 200 星数据集，对比修改前后的页面卡顿时间。

- [ ] **Step 3: 提交**

```bash
git add managers/csv-manager.js
git commit -m "perf: lazy-parse CSV satellite data to avoid bulk object creation"
```

---

## Phase IV: P2 代码质量改进

### Task 22: 统一 CSV 解析逻辑

**Files:**
- Create: `modules/utils/csv-parser.js`
- Modify: `managers/csv-manager.js`
- Modify: `managers/ui-manager.js`
- Modify: `modules/modes/csv-mode.js`（如果未被 Task 8 删除）

- [ ] **Step 1: 创建共享的 CSV 解析工具函数**

```javascript
// modules/utils/csv-parser.js
/**
 * 统一 CSV 文本解析
 * @param {string} text - CSV 原始文本
 * @returns {Array<Object>} 解析后的数据行
 */
export function parseCsvText(text) {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim());
    return lines.slice(1).map(line => {
        const values = line.split(',');
        const row = {};
        headers.forEach((h, i) => {
            const v = values[i]?.trim();
            row[h] = v !== undefined && v !== '' ? parseFloat(v) : NaN;
        });
        return row;
    });
}
```

- [ ] **Step 2: 在 csv-manager.js 和 ui-manager.js 中替换重复逻辑**

将两处（或三处）几乎相同的 CSV 解析代码替换为 `import { parseCsvText } from '../modules/utils/csv-parser.js'`。

- [ ] **Step 3: 提交**

```bash
git add modules/utils/csv-parser.js managers/csv-manager.js managers/ui-manager.js
git commit -m "refactor: extract shared parseCsvText to eliminate CSV parsing duplication"
```

---

### Task 23: 修复 createLogger WARN/ERROR 降级 Bug

**Files:**
- Modify: `core/logger.js:73-75`

- [ ] **Step 1: 修复颜色模式下的日志级别降级**

找到 `logWithStyle()` 函数（第 73-75 行）：

```javascript
// 修改前（第 73-75 行）— 所有级别都走 console.log
if (config.useColors && typeof window !== 'undefined') {
    const color = COLORS[LEVEL_NAMES[level]];
    console.log(`%c${mainMsg}`, `color: ${color}; font-weight: bold`, ...args);
}

// 修改后 — 按级别分发到正确的 console 方法
if (config.useColors && typeof window !== 'undefined') {
    const color = COLORS[LEVEL_NAMES[level]];
    const style = `color: ${color}; font-weight: bold`;
    if (level === LOG_LEVELS.WARN) {
        console.warn(`%c${mainMsg}`, style, ...args);
    } else if (level === LOG_LEVELS.ERROR) {
        console.error(`%c${mainMsg}`, style, ...args);
    } else {
        console.log(`%c${mainMsg}`, style, ...args);
    }
}
```

- [ ] **Step 2: 验证**

在 DevTools Console 中，过滤 "Warnings" 和 "Errors"，确认 WARN/ERROR 级别的消息正确显示。

- [ ] **Step 3: 提交**

```bash
git add core/logger.js
git commit -m "fix: route WARN/ERROR to correct console methods in color mode"
```

---

### Task 24: 纹理 URL 配置统一

**Files:**
- Modify: `modules/texture-loader.js:5-8`

- [ ] **Step 1: 从 config.js 导入 TEXTURE_URLS，删除本地重复定义**

```javascript
// 修改前（texture-loader.js 第 5-8 行）
const TEXTURE_URLS = {
    earth: 'https://unpkg.com/three-globe@2.31.1/example/img/earth-blue-marble.jpg',
    moon: 'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/moon_1024.jpg'
};

// 修改后 — 从 config.js 导入统一配置
import { TEXTURE_URLS } from './config.js';
```

- [ ] **Step 2: 提交**

```bash
git add modules/texture-loader.js
git commit -m "fix: unify TEXTURE_URLS to single source in config.js"
```

---

### Task 25: app-context.js resize 监听器可移除

**Files:**
- Modify: `core/app-context.js:66-70`

- [ ] **Step 1: 保存监听器引用，支持清理**

```javascript
// 修改前（第 66-70 行）
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// 修改后
const _resizeHandler = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
};

// 移除旧的（如果存在）
if (window._appContextResizeHandler) {
    window.removeEventListener('resize', window._appContextResizeHandler);
}
window._appContextResizeHandler = _resizeHandler;
window.addEventListener('resize', _resizeHandler);
```

- [ ] **Step 2: 提交**

```bash
git add core/app-context.js
git commit -m "fix: make resize listener removable to prevent accumulation"
```

---

### Task 26: 共享材质 CENTER_SAT_MAT 使用 clone

**Files:**
- Modify: `modules/views/center-person.js:80`

- [ ] **Step 1: 对共享材质调用 clone()**

```javascript
// 修改前（第 80 行）
sceneObjects.centerSatMarker = new THREE.Mesh(CENTER_SAT_GEOM, CENTER_SAT_MAT);

// 修改后 — clone 防止污染共享材质
sceneObjects.centerSatMarker = new THREE.Mesh(CENTER_SAT_GEOM, CENTER_SAT_MAT.clone());
```

- [ ] **Step 2: 提交**

```bash
git add modules/views/center-person.js
git commit -m "fix: clone CENTER_SAT_MAT to prevent shared material mutation"
```

---

### Task 27: interpolateSatellites 添加 sat_id 一致性校验

**Files:**
- Modify: `modules/interpolation.js:17-23`

- [ ] **Step 1: 在插值循环中添加 sat_id 检查**

```javascript
// 修改前（第 17-23 行）
const interpolated = [];
for (let i = 0; i < currData.length; i++) {
    const prev = prevData[i];
    const curr = currData[i];
    if (!prev) {
        interpolated.push(curr);
        continue;
    }

// 修改后 — 添加 sat_id 校验
const interpolated = [];
for (let i = 0; i < currData.length; i++) {
    const curr = currData[i];
    // 尝试通过 sat_id 找到对应的前帧数据
    let prev = prevData[i];
    if (prev && curr && prev[1] !== curr[1]) {
        // sat_id 不匹配，尝试在 prevData 中查找
        prev = null;
        for (let j = 0; j < prevData.length; j++) {
            if (prevData[j][1] === curr[1]) { prev = prevData[j]; break; }
        }
    }
    if (!prev) {
        interpolated.push(curr);
        continue;
    }
```

注意：stepData 数组格式为 `[timestamp, sat_id, a, e, i, OMG, omg, f, X, Y, Z, Vx, Vy, Vz]`，其中 `sat_id` 位于索引 [1]（已通过 `playback-manager.js:911` 的 `stepData[0][1]` 确认）。`prev[1]` 和 `curr[1]` 对应 sat_id。

- [ ] **Step 2: 提交**

```bash
git add modules/interpolation.js
git commit -m "fix: add sat_id consistency check in interpolateSatellites"
```

---

### Task 28: constellation-panel 主星状态提取去重

**Files:**
- Modify: `modules/ui/constellation-panel.js`

- [ ] **Step 1: 提取公共函数 getChiefStateAndGmst()**

在 `createConstellationPanel()` 闭包内添加：

```javascript
/**
 * 获取主星状态和 GMST（统一 CSV/WS 分支）
 * @returns {{ chiefState: object, gmst: number } | null}
 */
function getChiefStateAndGmst() {
    const currentMode = appState.currentMode;
    let chiefState = null;
    let gmst = 0;

    if (currentMode === 'csv') {
        const csvState = appState.csv;
        const timeIdx = csvState.currentTimeIdx;
        const frameData = csvState.satelliteData?.[timeIdx];
        if (!frameData || !frameData.sats?.[0]) return null;
        const chief = frameData.sats[0];
        const jd = dateToJD(...parseTimestamp(frameData.timestamp).values());
        gmst = calcGMST(jd);
        chiefState = { X: chief.X, Y: chief.Y, Z: chief.Z, Vx: chief.Vx, Vy: chief.Vy, Vz: chief.Vz };
    } else if (currentMode === 'ws') {
        const wsState = appState.ws;
        if (!wsState.lastStepData || wsState.lastStepData.length === 0) return null;
        const chief = wsState.lastStepData[0];
        const jd = dateToJD(...parseTimestamp(chief[0]).values());
        gmst = calcGMST(jd);
        chiefState = { X: chief[8], Y: chief[9], Z: chief[10], Vx: chief[11], Vy: chief[12], Vz: chief[13] };
    }
    return { chiefState, gmst };
}
```

然后在 `getCurrentObsAngle()`、`getCurrentHillCoords()`、`render()`、`handlePatternUpload()` 四个函数中，将重复的 CSV/WS 分支判断替换为 `const result = getChiefStateAndGmst(); if (!result) return;`。

- [ ] **Step 2: 验证**

在 CSV 和 WS 两种模式下分别测试编队面板功能。

- [ ] **Step 3: 提交**

```bash
git add modules/ui/constellation-panel.js
git commit -m "refactor: extract getChiefStateAndGmst to deduplicate chief state logic"
```

---

### Task 29: 输入校验添加 parseFloat NaN 检查

**Files:**
- Modify: `managers/csv-manager.js:129`
- Modify: `managers/ui-manager.js:134-142`

- [ ] **Step 1: 在 csv-manager 时间戳解析中添加校验**

```javascript
// 在 parseTimestamp 调用后添加 NaN 检查
const parsed = parseTimestamp(rawTimestamp);
if (!parsed || isNaN(parsed.year)) {
    console.warn(`[CSV] Invalid timestamp at row: ${rawTimestamp}`);
    return null;  // 或跳过该行
}
```

- [ ] **Step 2: 在 ui-manager parseFloat 处添加校验**

```javascript
// 在每个 parseFloat 调用后检查
const value = parseFloat(input);
if (isNaN(value)) {
    console.warn(`[UI] Invalid numeric input: ${input}`);
    return;  // 跳过或使用默认值
}
```

- [ ] **Step 3: 提交**

```bash
git add managers/csv-manager.js managers/ui-manager.js
git commit -m "fix: add NaN validation for parseFloat inputs to prevent silent propagation"
```

---

## Phase V: 架构改进

> **注意**：Phase V（Task 30-32）为长期架构改进，当前版本仅有框架性描述。建议在 Phase I-IV 全部完成并验证后，再为 Phase V 编写独立的详细实施计划。Task 30（playback-manager 拆分）风险最高，应优先出详细设计。

### Task 30: playback-manager.js 拆分

**Files:**
- Create: `managers/csv-playback.js`
- Create: `managers/ws-playback.js`
- Create: `managers/ws-connection.js`
- Modify: `managers/playback-manager.js`（变为薄代理层）

- [ ] **Step 1: 提取 ws-connection.js（WebSocket 连接管理，约 200 行）**

将 `connectWebSocket()`、`clearWsConnection()`、`setupVisibilityHandler()` 提取到 `managers/ws-connection.js`。

- [ ] **Step 2: 提取 csv-playback.js（CSV 播放控制，约 300 行）**

将 `startCsvPlayback()`、`stopCsvPlayback()`、`changeSpeed()`、`seekToIndex()` 和相关状态提取到 `managers/csv-playback.js`。

- [ ] **Step 3: 提取 ws-playback.js（WS 播放控制，约 200 行）**

将 WS 播放/暂停/渲染循环逻辑提取到 `managers/ws-playback.js`。

- [ ] **Step 4: playback-manager.js 变为薄代理**

保留统一播放控制接口，内部委托给三个子模块。

- [ ] **Step 5: 全面回归测试**

测试 CSV 播放、WS 播放、速度切换、页面切换后台/前台、断线重连。

- [ ] **Step 6: 提交**

```bash
git add managers/
git commit -m "refactor: split playback-manager into csv-playback, ws-playback, ws-connection"
```

---

### Task 31: appState 接口化（长期）

**Files:**
- Create: `core/app-state-interface.js`
- Modify: `app.js`
- Modify: 各模块文件

- [ ] **Step 1: 定义 appState 的命名空间接口**

创建 `core/app-state-interface.js`，定义每个模块可访问的 appState 属性子集。使用 `Proxy` 或 getter/setter 限制访问范围。

- [ ] **Step 2: 逐步迁移各模块**

按模块逐个将 `appState` 直接引用替换为受限接口。每迁移一个模块后验证功能。

- [ ] **Step 3: 提交**

```bash
git add -A
git commit -m "refactor: introduce appState interface to restrict module access scope"
```

---

### Task 32: 事件监听器统一管理

**Files:**
- Create: `core/event-registry.js`
- Modify: `core/app-context.js`
- Modify: `modules/ui/constellation-panel.js`
- Modify: `managers/playback-manager.js`
- Modify: `managers/ui-manager.js`

- [ ] **Step 1: 创建事件注册表**

```javascript
// core/event-registry.js
const _listeners = new Map();

export function addManagedListener(target, event, handler, options) {
    const key = `${event}_${target.constructor.name}_${handler.name || 'anon'}`;
    // 移除同 key 旧监听器
    if (_listeners.has(key)) {
        const old = _listeners.get(key);
        old.target.removeEventListener(old.event, old.handler, old.options);
    }
    target.addEventListener(event, handler, options);
    _listeners.set(key, { handler, options, target, event });
}

export function removeAllManagedListeners() {
    _listeners.forEach(({ target, event, handler, options }) => {
        target.removeEventListener(event, handler, options);
    });
    _listeners.clear();
}
```

注意：key 格式 `${event}_${target.constructor.name}_${handler.name}` 使用 handler 函数名区分同一 target 上的同类型监听器。如果使用匿名函数，`handler.name` 为空，需额外计数器避免冲突。建议所有监听器使用命名函数。

- [ ] **Step 2: 迁移现有监听器**

将 `app-context.js` 的 resize、`constellation-panel.js` 的 Escape、`playback-manager.js` 的 visibilitychange 等改为使用 `addManagedListener`。

- [ ] **Step 3: 提交**

```bash
git add core/event-registry.js core/app-context.js modules/ui/constellation-panel.js managers/playback-manager.js
git commit -m "refactor: introduce event registry for centralized listener lifecycle management"
```

---

## 附录：V2 审查报告勘误

以下是我在分析 V2 报告时发现的遗漏，已整合到上述计划中：

| 项 | V2 报告状态 | 实际情况 | 已纳入 Task |
|----|-----------|---------|-----------|
| `modules/modes/index.js` (3行) | 未列入死代码 | 无活跃导入，确认死代码 | Task 8 |
| `modules/modes/csv-mode.js` (206行) | 未列入死代码 | 仅被死代码 modes/index.js 导入 | Task 8 |
| `modules/modes/ws-mode.js` (296行) | 未列入死代码 | 仅被死代码 modes/index.js 导入 | Task 8 |
| `modules/ui/index.js` (5行) | 未列入死代码 | 无活跃导入 | Task 8 |
| `modules/ui/time-controls.js` (129行) | 未列入死代码 | 仅被死代码 ui/index.js 导入 | Task 8 |
| domCache 读取处数量 | "8处" | 实际约 24 处（view-update 3 + interpolation 9 + center-person 6 + first-person 6） | Task 3 |
| domCache 元素 ID 列表 | 计划列出 7 个 ID | 实际 5 个：`coordDisplay`, `timeDisplay`, `visibleCount`, `azimuth-display`, `elevation-display` | Task 3（已修正） |
| `hide()` 未停 autoMatcher | "已改为设计行为" | hide() 确实未停 autoMatcher，setInterval 在后台持续运行 | 设计意图需确认 |

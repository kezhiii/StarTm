# 自动图案重匹配 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After image upload, automatically re-evaluate satellite lighting every ~2s based on changing observation geometry and satellite positions.

**Architecture:** Add `autoMatcher` to constellation-panel.js (cached shape+angle monitoring+periodic re-match) + add `incrementalMatch()` to image-processor.js (local search around previous transform). No new UI buttons — status shown as canvas overlay text.

**Tech Stack:** Vanilla JS (client-side), Three.js, Canvas 2D

---

### Task 1: Add `getCurrentObsAngle()` helper to constellation-panel.js

**Files:**
- Modify: `web/modules/ui/constellation-panel.js` (after the imports, before the createConstellationPanel function)

- [ ] **Step 1: Read the constellation-panel.js imports and the render() function to understand the current data access pattern**

Run the following to see current imports and mode-specific data access:

```bash
cd "StarTM"; Get-Content web/modules/ui/constellation-panel.js -Head 8
# Also check render() lines 394-413
```

- [ ] **Step 2: Add `getCurrentObsAngle()` helper inside createConstellationPanel, after the `satPositions` variable declaration**

Insert a helper that reads current chief ECI + GMST from appState, then computes azimuth/elevation:

```javascript
    // 地面视角补偿：M⁻¹矩阵 {a,b,c,d}，由 computeHillToGroundMatrix 返回
    let transformMatrix = null;

    // ===== Auto-match state =====
    let autoMatcher = null;

    /**
     * 获取当前观测角度（方位角/仰角）
     * @returns {{ azimuth: number, elevation: number, chiefState: object, gmst: number } | null}
     */
    function getCurrentObsAngle() {
        const currentMode = appState.currentMode;
        let chiefState = null;
        let gmst = 0;

        if (currentMode === 'csv' && appState.csv.satelliteData) {
            const idx = appState.csv.state.currentTimeIdx;
            if (appState.csv.satelliteData[idx]) {
                const s = appState.csv.satelliteData[idx].sats[0];
                chiefState = { X: s.X, Y: s.Y, Z: s.Z, Vx: s.Vx, Vy: s.Vy, Vz: s.Vz };
                const ts = appState.csv.satelliteData[idx].timestamp;
                const d = parseTimestamp(ts);
                gmst = calcGMST(dateToJD(d.year, d.month, d.day, d.hour, d.minute, d.second));
            }
        } else if (currentMode === 'ws' && appState.ws.lastStepData) {
            const d0 = appState.ws.lastStepData[0];
            chiefState = { X: d0[8], Y: d0[9], Z: d0[10], Vx: d0[11], Vy: d0[12], Vz: d0[13] };
            const d = parseTimestamp(d0[0]);
            gmst = calcGMST(dateToJD(d.year, d.month, d.day, d.hour, d.minute, d.second));
        }

        if (!chiefState) return null;

        const { currentLat, currentLon } = appState.interaction;
        const chiefEcef = eciToEcef(chiefState.X, chiefState.Y, chiefState.Z, gmst);
        const local = ecefToLocal(chiefEcef.x, chiefEcef.y, chiefEcef.z, currentLat, currentLon);

        return { azimuth: local.az, elevation: local.el, chiefState, gmst };
    }
```

- [ ] **Step 3: Verify `getCurrentObsAngle()` is the only place we call `parseTimestamp`/`calcGMST`/`ecefToLocal` for chief state**

Run:
```bash
Select-String -Pattern "parseTimestamp" web/modules/ui/constellation-panel.js
# Should still show uses in render() and handlePatternUpload() — that's fine
```

---

### Task 2: Add `incrementalMatch()` to image-processor.js

**Files:**
- Modify: `web/modules/image-processor.js` (add a new exported function before the `processImage` function)

- [ ] **Step 1: Read current `findBestTransform` signature to understand return value**

```bash
Select-String -Pattern "export function findBestTransform" web/modules/image-processor.js
```

- [ ] **Step 2: Add `incrementalMatch()` after the `reverseNearestNeighborLighting` function and before `processImage`**

```javascript
/**
 * 增量匹配：在上次最优变换附近局部搜索，跳过完整 grid search
 * @param {Array} shapePoints - M⁻¹ 变换后的 shape 点
 * @param {Array} satPositions - 卫星 Hill 坐标 [{x, y}, ...]
 * @param {Object} prevTransform - 上次最优变换 { bestScale, bestTx, bestTy, bestCost }
 * @returns {{ lightMap: Map, transform: Object }}
 */
function incrementalMatch(shapePoints, satPositions, prevTransform) {
    const satCount = satPositions.length;

    // 卫星范围（用于局部搜索的平移边界）
    let cx = 0, cy = 0;
    for (const sat of satPositions) { cx += sat.x; cy += sat.y; }
    cx /= satCount; cy /= satCount;

    let maxDist = 0;
    for (const s of satPositions) {
        const d = Math.sqrt((s.x - cx) ** 2 + (s.y - cy) ** 2);
        if (d > maxDist) maxDist = d;
    }
    if (maxDist < 1) maxDist = 1;

    const prevScale = prevTransform.bestScale || 1;
    const prevTx = prevTransform.bestTx || 0;
    const prevTy = prevTransform.bestTy || 0;
    const prevCost = prevTransform.bestCost || Infinity;

    // 局部搜索范围：scale ±10%, tx/ty ±10% 卫星范围
    const minScale = prevScale * 0.9;
    const maxScale = prevScale * 1.1;
    const tRange = maxDist * 0.1;
    const nScale = 5;
    const nTrans = 3;

    const candidates = [];

    for (let si = 0; si < nScale; si++) {
        const scale = minScale + (maxScale - minScale) * si / (nScale - 1);
        const scaled = scalePoints(shapePoints, scale);

        for (let ti = 0; ti < nTrans; ti++) {
            const tx = prevTx - tRange + (tRange * 2) * ti / (nTrans - 1);

            for (let tj = 0; tj < nTrans; tj++) {
                const ty = prevTy - tRange + (tRange * 2) * tj / (nTrans - 1);

                const shiftedSat = satPositions.map(s => ({ x: s.x - tx, y: s.y - ty }));
                const { totalCost } = matchShapeToSatellites(scaled, shiftedSat);

                candidates.push({ scale, tx, ty, cost: totalCost });
            }
        }
    }

    candidates.sort((a, b) => a.cost - b.cost);
    const topK = Math.min(3, candidates.length);
    const topCandidates = candidates.slice(0, topK);

    // 检查是否需要回退到完整搜索
    const needsFullSearch = topCandidates[0].cost > prevCost * 1.5;
    if (needsFullSearch) {
        console.warn(`[INCREMENTAL] 局部搜索 cost=${topCandidates[0].cost.toFixed(2)} 远超上次 ${prevCost.toFixed(2)}，触发完整搜索`);
        // 当允许角度搜索且 cost 过高时，回退到完整搜索（只搜一次）
        return runFullSearch(shapePoints, satPositions, prevTransform);
    }

    // 精细搜索：Top-3 候选用匈牙利算法
    let bestCost = Infinity, bestScale = prevScale, bestTx = prevTx, bestTy = prevTy;
    const fineShapePoints = shapePoints.slice(0, Math.min(shapePoints.length, satCount));
    const subScaleSteps = 3;

    for (const cand of topCandidates) {
        const sRange = Math.abs(cand.scale * 0.05);
        for (let si = 0; si <= subScaleSteps; si++) {
            const fs = cand.scale - sRange + (sRange * 2) * si / subScaleSteps;
            if (fs <= 0) continue;

            const rotated = rotatePoints(fineShapePoints, 0);
            const scaled = scalePoints(rotated, fs);
            const shiftedSat = satPositions.map(s => ({ x: s.x - cand.tx, y: s.y - cand.ty }));

            const { totalCost } = hungarianMatch(scaled, shiftedSat);
            if (totalCost < bestCost) {
                bestCost = totalCost;
                bestScale = fs;
                bestTx = cand.tx;
                bestTy = cand.ty;
            }
        }
    }

    // 计算最终匹配
    const bestRotated = rotatePoints(shapePoints, 0);
    const bestScaled = scalePoints(bestRotated, bestScale);
    const alignedSat = satPositions.map(s => ({ x: s.x - bestTx, y: s.y - bestTy }));

    const matchCount = Math.min(bestScaled.length, alignedSat.length);
    const { matches } = hungarianMatch(bestScaled.slice(0, matchCount), alignedSat.slice(0, matchCount));

    // 计算点亮半径阈值
    const sampleSize = Math.min(50, alignedSat.length);
    const satNearestDists = [];
    for (let i = 0; i < sampleSize; i++) {
        let minDist = Infinity;
        for (let j = 0; j < alignedSat.length; j++) {
            if (i === j) continue;
            const d = Math.sqrt((alignedSat[i].x - alignedSat[j].x) ** 2 + (alignedSat[i].y - alignedSat[j].y) ** 2);
            if (d < minDist) minDist = d;
        }
        satNearestDists.push(minDist);
    }
    satNearestDists.sort((a, b) => a - b);
    const medianSatDist = satNearestDists[Math.floor(satNearestDists.length / 2)];
    const radiusThreshold = medianSatDist * 0.7;

    const lightMap = reverseNearestNeighborLighting(bestScaled, alignedSat, radiusThreshold);

    const transform = {
        bestAngle: 0,
        bestScale,
        bestTx,
        bestTy,
        bestCost,
        matches,
        centerX: cx,
        centerY: cy,
        transformedPoints: bestScaled
    };

    return { lightMap, transform };
}

/**
 * 回退完整搜索（用于增量匹配检测到局部最优时）
 */
function runFullSearch(shapePoints, satPositions, prevTransform) {
    // 围绕当前最佳解做一个有限范围的完整搜索（角度禁用）
    const safeScale = prevTransform.bestScale || 1;
    const safeTx = prevTransform.bestTx || 0;
    const safeTy = prevTransform.bestTy || 0;

    const satCount = satPositions.length;
    let cx = 0, cy = 0;
    for (const sat of satPositions) { cx += sat.x; cy += sat.y; }
    cx /= satCount; cy /= satCount;

    let maxDist = 0;
    for (const s of satPositions) {
        const d = Math.sqrt((s.x - cx) ** 2 + (s.y - cy) ** 2);
        if (d > maxDist) maxDist = d;
    }

    const minScale = maxDist * 0.3 / Math.max(...shapePoints.map(p => Math.sqrt(p.x*p.x + p.y*p.y)));
    const maxScale = maxDist * 1.7 / Math.max(...shapePoints.map(p => Math.sqrt(p.x*p.x + p.y*p.y)));

    // 有限范围搜索：围绕上次值，但范围更大
    const candidates = [];
    const scaleSteps = 5;
    const scaleRange = maxScale - minScale;

    for (let si = 0; si <= scaleSteps; si++) {
        const scale = minScale + scaleRange * si / scaleSteps;
        const scaled = scalePoints(shapePoints, scale);

        for (let ti = 0; ti < 3; ti++) {
            const tx = safeTx - maxDist * 0.3 + maxDist * 0.3 * ti;
            for (let tj = 0; tj < 3; tj++) {
                const ty = safeTy - maxDist * 0.3 + maxDist * 0.3 * tj;
                const shiftedSat = satPositions.map(s => ({ x: s.x - tx, y: s.y - ty }));
                const { totalCost } = matchShapeToSatellites(scaled, shiftedSat);
                candidates.push({ scale, tx, ty, cost: totalCost });
            }
        }
    }

    candidates.sort((a, b) => a.cost - b.cost);
    const topCandidates = candidates.slice(0, 5);

    let bestCost = Infinity, bestScale = safeScale, bestTx = safeTx, bestTy = safeTy;
    const fineShapePoints = shapePoints.slice(0, Math.min(shapePoints.length, satCount));

    for (const cand of topCandidates) {
        for (let si = 0; si <= 3; si++) {
            const fs = cand.scale * (0.95 + 0.033 * si);
            const rotated = rotatePoints(fineShapePoints, 0);
            const scaled = scalePoints(rotated, fs);
            const shiftedSat = satPositions.map(s => ({ x: s.x - cand.tx, y: s.y - cand.ty }));
            const { totalCost } = hungarianMatch(scaled, shiftedSat);
            if (totalCost < bestCost) {
                bestCost = totalCost; bestScale = fs; bestTx = cand.tx; bestTy = cand.ty;
            }
        }
    }

    const bestRotated = rotatePoints(shapePoints, 0);
    const bestScaled = scalePoints(bestRotated, bestScale);
    const alignedSat = satPositions.map(s => ({ x: s.x - bestTx, y: s.y - bestTy }));
    const matchCount = Math.min(bestScaled.length, alignedSat.length);
    const { matches } = hungarianMatch(bestScaled.slice(0, matchCount), alignedSat.slice(0, matchCount));

    const sampleSize = Math.min(50, alignedSat.length);
    const satNearestDists = [];
    for (let i = 0; i < sampleSize; i++) {
        let minDist = Infinity;
        for (let j = 0; j < alignedSat.length; j++) {
            if (i === j) continue;
            const d = Math.sqrt((alignedSat[i].x - alignedSat[j].x) ** 2 + (alignedSat[i].y - alignedSat[j].y) ** 2);
            if (d < minDist) minDist = d;
        }
        satNearestDists.push(minDist);
    }
    satNearestDists.sort((a, b) => a - b);
    const medianSatDist = satNearestDists[Math.floor(satNearestDists.length / 2)];
    const radiusThreshold = medianSatDist * 0.7;
    const lightMap = reverseNearestNeighborLighting(bestScaled, alignedSat, radiusThreshold);

    return {
        lightMap,
        transform: { bestAngle: 0, bestScale, bestTx, bestTy, bestCost, matches, centerX: cx, centerY: cy, transformedPoints: bestScaled }
    };
}
```

- [ ] **Step 3: Export `incrementalMatch` from image-processor.js**

At the end of the file where other exports are:

```javascript
export { incrementalMatch };
```

Or add it to the existing export section.

---

### Task 3: Add `autoMatcher` object to constellation-panel.js

**Files:**
- Modify: `web/modules/ui/constellation-panel.js`

- [ ] **Step 1: Add autoMatcher after the `transformMatrix` variable declaration**

```javascript
    // ===== Auto-match state =====
    let autoMatcher = null;
    const AUTO_MATCH_INTERVAL = 1500;   // 轮询间隔 ms
    const AZ_THRESHOLD = 5;              // 方位角变化阈值 °
    const EL_THRESHOLD = 2;              // 仰角变化阈值 °
    const MIN_MATCH_INTERVAL = 2000;     // 最小触发间隔 ms
    const FULL_SEARCH_INTERVAL = 30000;  // 最大完整搜索间隔 ms

    /**
     * 创建自动跟踪器
     */
    function createAutoMatcher(cachedShapePoints, cachedTransform) {
        if (autoMatcher) autoMatcher.stop();

        let intervalId = null;
        let lastAz = null;
        let lastEl = null;
        let lastMatchTime = 0;
        let lastFullSearchTime = 0;
        let isPaused = false;
        let lastTransform = { ...cachedTransform };

        const cachedShape = cachedShapePoints;

        function start() {
            if (intervalId) return;
            console.log('[AUTO] 开始自动跟踪');
            intervalId = setInterval(tick, AUTO_MATCH_INTERVAL);
        }

        function stop() {
            if (intervalId) {
                clearInterval(intervalId);
                intervalId = null;
            }
            console.log('[AUTO] 停止自动跟踪');
        }

        function pause() {
            isPaused = true;
            console.log('[AUTO] 暂停');
        }

        function resume() {
            isPaused = false;
            console.log('[AUTO] 恢复');
        }

        function tick() {
            if (isPaused) return;

            const obs = getCurrentObsAngle();
            if (!obs) return;
            if (obs.elevation < 0) return;

            const az = obs.azimuth;
            const el = obs.elevation;

            if (lastAz === null || lastEl === null) {
                lastAz = az;
                lastEl = el;
                return;
            }

            const dAz = Math.abs(az - lastAz);
            const dEl = Math.abs(el - lastEl);
            const now = Date.now();
            const timeSinceLastMatch = now - lastMatchTime;
            const timeSinceFullSearch = now - lastFullSearchTime;

            const shouldMatch = (dAz >= AZ_THRESHOLD || dEl >= EL_THRESHOLD) && timeSinceLastMatch >= MIN_MATCH_INTERVAL;
            const forceFullSearch = timeSinceFullSearch >= FULL_SEARCH_INTERVAL;

            if (shouldMatch || forceFullSearch) {
                lastAz = az;
                lastEl = el;
                reMatch(forceFullSearch);
            }
        }

        function reMatch(forceFullSearch) {
            const now = Date.now();
            const obs = getCurrentObsAngle();
            if (!obs) return;
            if (obs.elevation < 0) return;

            const { chiefState, gmst } = obs;
            const { currentLat, currentLon } = appState.interaction;

            // 1. 获取当前卫星 Hill 坐标
            const currentMode = appState.currentMode;
            let hillCoords = null;

            if (currentMode === 'csv' && appState.csv.satelliteData) {
                const idx = appState.csv.state.currentTimeIdx;
                if (appState.csv.satelliteData[idx]) {
                    const satData = appState.csv.satelliteData[idx].sats;
                    const chief = satData[0];
                    const chiefData = { X: chief.X, Y: chief.Y, Z: chief.Z, Vx: chief.Vx, Vy: chief.Vy, Vz: chief.Vz };
                    hillCoords = [];
                    satData.forEach((sat, i) => {
                        const hill = eciToHill(chiefData, { X: sat.X === undefined ? sat[8] : sat.X, Y: sat.Y === undefined ? sat[9] : sat.Y, Z: sat.Z === undefined ? sat[10] : sat.Z });
                        hillCoords.push({ x: hill.alongTrack, y: hill.crossTrack, idx: i });
                    });
                }
            } else if (currentMode === 'ws' && appState.ws.lastStepData) {
                const wsData = appState.ws.lastStepData;
                const d0 = wsData[0];
                const chiefData = { X: d0[8], Y: d0[9], Z: d0[10], Vx: d0[11], Vy: d0[12], Vz: d0[13] };
                hillCoords = [];
                wsData.forEach((d, i) => {
                    const hill = eciToHill(chiefData, { X: d[8], Y: d[9], Z: d[10] });
                    hillCoords.push({ x: hill.alongTrack, y: hill.crossTrack, idx: i });
                });
            }

            if (!hillCoords || hillCoords.length === 0) return;

            // 2. 重算 M⁻¹
            const matrix = computeHillToGroundMatrix(chiefState, currentLat, currentLon, gmst);
            if (!matrix) return;
            transformMatrix = matrix;

            // 3. M⁻¹ × 原始 shape
            const { a, b, c, d } = matrix;
            const effectiveShape = cachedShape.map(p => ({
                x: a * p.x - b * p.y,
                y: c * p.x - d * p.y
            }));

            // 4. 增量匹配
            const { lightMap, transform } = incrementalMatch(
                effectiveShape,
                hillCoords,
                forceFullSearch ? { bestScale: lastTransform.bestScale || 1, bestTx: 0, bestTy: 0, bestCost: Infinity } : lastTransform
            );

            // 5. 更新缓存
            lastTransform = transform;
            lastMatchTime = now;
            if (forceFullSearch) lastFullSearchTime = now;

            // 6. 应用灯光
            const lightMgr = appState.lightManager;
            if (lightMgr) {
                const satCount = appState.config?.satCount || hillCoords.length;
                for (let i = 0; i < satCount; i++) {
                    lightMgr.setLight(i, false);
                }
                lightMap.forEach((isOn, idx) => {
                    if (isOn) lightMgr.setLight(idx, true);
                });
            }

            render();
        }

        function getStatus() {
            if (!intervalId) return 'stopped';
            if (isPaused) return 'paused';
            return 'running';
        }

        function togglePause() {
            if (isPaused) resume();
            else pause();
        }

        start();

        return {
            stop,
            togglePause,
            getStatus,
        };
    }
```

- [ ] **Step 2: Inject `incrementalMatch` import at the top of constellation-panel.js**

Update the import line to include `incrementalMatch`:

```javascript
import { processImage } from '../image-processor.js';
```

Change to:

```javascript
import { processImage, incrementalMatch } from '../image-processor.js';
```

---

### Task 4: Wire `autoMatcher` into upload handler and lifecycle

**Files:**
- Modify: `web/modules/ui/constellation-panel.js`

- [ ] **Step 1: Start autoMatcher after successful image upload**

In `handlePatternUpload`, after applying lights (after line 716), start the autoMatcher:

```javascript
                // 启动自动跟踪
                if (shapePoints && shapePoints.length > 0) {
                    if (autoMatcher) autoMatcher.stop();
                    autoMatcher = createAutoMatcher(shapePoints, transform);
                }
```

Add this right after the `console.log('[PATTERN] 灯光已应用');` line (line 716).

- [ ] **Step 2: Stop autoMatcher on reset lights**

In `handleResetLights` (line 734), add:

```javascript
    function handleResetLights() {
        if (autoMatcher) {
            autoMatcher.stop();
            autoMatcher = null;
        }
        transformMatrix = null;
        // ...existing reset code...
```

- [ ] **Step 3: Stop autoMatcher on panel hide**

In the `hide()` function (line 344):

```javascript
    function hide() {
        if (autoMatcher) {
            autoMatcher.stop();
            autoMatcher = null;
        }
        if (panel) panel.style.display = 'none';
        isVisible = false;
    }
```

- [ ] **Step 4: Draw status text on canvas in `render()`**

After the crosshair drawing (after line 388), add status text. Before the "获取当前卫星数据" section:

```javascript
        // 绘制自动跟踪状态
        if (autoMatcher) {
            const status = autoMatcher.getStatus();
            const obs = getCurrentObsAngle();
            let statusText = '';
            let statusColor = '#44ff88';

            if (obs && obs.elevation < 0) {
                statusText = '🔭 地平线下';
                statusColor = '#888';
            } else if (status === 'running') {
                statusText = '🔄 自动跟踪中';
            } else if (status === 'paused') {
                statusText = '⏸ 已暂停';
                statusColor = '#ffaa44';
            }

            if (statusText) {
                ctx.fillStyle = statusColor;
                ctx.font = 'bold 12px Arial';
                ctx.textAlign = 'left';
                ctx.fillText(statusText, 8, 18);
                // 记录点击区域（右下角也可切换）
                ctx.textAlign = 'right';
                ctx.fillStyle = '#4488ff44';
                ctx.font = '10px Arial';
                ctx.fillText('点击切换', W - 8, H - 8);
            }
        }
```

Note: The click-to-toggle will be handled by adding a hit-test in `handleCanvasClick`.

- [ ] **Step 5: Add click-to-toggle in canvas click handler**

Find `handleCanvasClick` and add hit-test for status toggle:

```javascript
    function handleCanvasClick(e) {
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        // 检查是否点击了状态文字区域（右下角）
        if (autoMatcher && mx > W - 80 && my > H - 30) {
            autoMatcher.togglePause();
            render();
            return;
        }

        // ... existing click handling for satellite selection ...
```

Read the existing `handleCanvasClick` first to see how satellite click detection works.

---

### Task 5: Manual verification

**File:** No file changes — run the app in browser.

- [ ] **Step 1: Start the app**

```bash
cd "StarTM"; python main_fastapi.py
```

Or open the HTML file directly in a browser.

- [ ] **Step 2: Upload a pattern image**

1. Open the constellation panel
2. Click "上传图案"
3. Select a test pattern image
4. Verify: pattern appears correctly, satellites are lit

- [ ] **Step 3: Verify auto-tracking starts**

1. Check console: should show `[AUTO] 开始自动跟踪`
2. Check canvas: should show `🔄 自动跟踪中` in top-left
3. Wait ~3-5 seconds for angle check interval

- [ ] **Step 4: Verify re-match on angle change**

1. In WS mode, advance time (or wait for frames to flow)
2. Console should show `[INCREMENTAL]` logs when re-match triggers
3. Observe: lit satellites should change as the viewing geometry changes

- [ ] **Step 5: Verify pause/resume**

1. Click the status text area (bottom-right corner)
2. Verify text changes to `⏸ 已暂停`
3. Click again to resume
4. Verify text changes back to `🔄 自动跟踪中`

- [ ] **Step 6: Verify lifecycle (close/reopen/reset)**

1. Close panel → verify `[AUTO] 停止自动跟踪` in console
2. Reopen → verify no auto-tracking (no status text)
3. Upload a new image → verify auto-tracking restarts
4. Click "重置" → verify auto-tracking stops

---

### Self-Review Check

- [ ] **Spec coverage:** All requirements in the spec have corresponding tasks: angle monitoring (Task 3), incremental matching (Task 2), lifecycle wiring (Task 4), status display (Task 4), click toggle (Task 4).
- [ ] **Placeholder scan:** No TBD, TODO, or vague steps. Every code block contains complete code.
- [ ] **Type consistency:** `incrementalMatch` return value `{ lightMap, transform }` matches usage in Task 3. `createAutoMatcher` return `{ stop, togglePause, getStatus }` matches usage in Task 4.

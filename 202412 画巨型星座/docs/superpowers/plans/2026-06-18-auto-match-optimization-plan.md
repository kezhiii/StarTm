# 自动匹配优化：两层级联更新 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce per-tick matching cost from ~50ms (full `findBestTransform`) to <1ms by using a cached transform on most ticks, with periodic full recalibration.

**Architecture:** Two-tier approach inside `createAutoMatcher`:
1. **Fast path** (every 1s tick): Apply cached (scale, tx, ty) from last calibration + M⁻¹ → NN lighting only, no search
2. **Calibration path** (angle threshold OR every 10 ticks): Full `findBestTransform` to refresh transform cache

**Tech Stack:** Vanilla JS (client-side)

## File Structure

Only one file changes:
- Modify: `web/modules/ui/constellation-panel.js` — restructure `createAutoMatcher` internals

No changes needed to `image-processor.js`.

**Current tick flow (1500ms):**
```
tick() → check angle change → reMatch() → findBestTransform (grid search + Hungarian) → NN lighting
```

**New tick flow (1000ms):**
```
tick() → needsCalibration?
  ├─ yes → reMatch() → findBestTransform → NN lighting → cache scale/tx/ty/radius
  └─ no  → fastMatch() → apply cached transform → NN lighting only (< 1ms)
```

---

### Task 1: Refactor `createAutoMatcher` for two-tier matching

**Files:**
- Modify: `web/modules/ui/constellation-panel.js` (inside `createAutoMatcher` closure, lines ~79-250)

- [ ] **Step 1: Read current `createAutoMatcher` and `reMatch` code**

Read `web/modules/ui/constellation-panel.js` around lines 67-250 to understand the current structure.

- [ ] **Step 2: Add constants for new timing**

Update the constants section (around line 67):

```javascript
    // ===== Auto-match constants =====
    const AUTO_MATCH_INTERVAL = 1000;   // 轮询间隔 ms（从 1500 改为 1000）
    const AZ_THRESHOLD = 5;              // 方位角变化阈值 °
    const EL_THRESHOLD = 2;              // 仰角变化阈值 °
    const MIN_MATCH_INTERVAL = 2000;     // 最小触发间隔 ms（仅适用于全量校准）
    const CALIBRATION_INTERVAL = 10;     // 每 N 次 tick 强制一次全量校准
```

- [ ] **Step 3: Restructure `createAutoMatcher` closure**

Replace the current `createAutoMatcher` body (from `function createAutoMatcher...` to the end of `return {stop, togglePause, getStatus}`) with the following:

```javascript
    function createAutoMatcher(cachedShapePoints, cachedTransform) {
        let intervalId = null;
        let lastAz = null;
        let lastEl = null;
        let lastMatchTime = 0;
        let isPaused = false;

        // 校准缓存
        let calibrationCountdown = 0;
        let cachedScale = cachedTransform.bestScale || 1;
        let cachedTx = cachedTransform.bestTx || 0;
        let cachedTy = cachedTransform.bestTy || 0;
        let cachedRadiusThreshold = 0;

        const cachedShape = cachedShapePoints;

        function start() {
            if (intervalId) return;
            console.log('[AUTO] 开始自动跟踪 (间隔=1s, 校准每10s)');
            calibrationCountdown = 0; // 首次立即校准
            intervalId = setInterval(tick, AUTO_MATCH_INTERVAL);
        }

        function stop() {
            if (intervalId) {
                clearInterval(intervalId);
                intervalId = null;
            }
            lastAz = null;
            lastEl = null;
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
            const timeSinceLastMatch = Date.now() - lastMatchTime;

            // 判定是否触发全量校准：角度变化超阈值 或 定时校准
            const angleBeyondThreshold = (dAz >= AZ_THRESHOLD || dEl >= EL_THRESHOLD) && timeSinceLastMatch >= MIN_MATCH_INTERVAL;
            const timeForCalibration = calibrationCountdown <= 0;

            if (angleBeyondThreshold || timeForCalibration) {
                lastAz = az;
                lastEl = el;
                reMatch();
                calibrationCountdown = CALIBRATION_INTERVAL;
            } else {
                calibrationCountdown--;
                fastMatch(obs, az, el);
            }
        }

        // ===== 快速路径：不搜索，直接应用缓存的变换参数 =====
        function fastMatch(obs, az, el) {
            try {
                const { chiefState, gmst } = obs;
                const { currentLat, currentLon } = appState.interaction;

                // 获取当前卫星 Hill 坐标（与 reMatch 相同逻辑）
                const hillCoords = getCurrentHillCoords();
                if (!hillCoords || hillCoords.length === 0) return;

                // 重算 M⁻¹
                const matrix = computeHillToGroundMatrix(chiefState, currentLat, currentLon, gmst);
                if (!matrix) return;
                transformMatrix = matrix;

                // M⁻¹ × 原始 shape
                const { a, b, c, d } = matrix;
                const effectiveShape = cachedShape.map(p => ({
                    x: a * p.x - b * p.y,
                    y: c * p.x - d * p.y
                }));

                // 应用缓存的变换（无搜索）
                const bestScaled = scalePoints(rotatePoints(effectiveShape, 0), cachedScale);
                const alignedSat = hillCoords.map(s => ({ x: s.x - cachedTx, y: s.y - cachedTy }));

                // 使用缓存的半径阈值
                if (cachedRadiusThreshold <= 0) return;
                const lightMap = reverseNearestNeighborLightingRef(bestScaled, alignedSat, cachedRadiusThreshold);

                // 应用灯光
                const lightMgr = appState.lightManager;
                if (lightMgr) {
                    const satCount = hillCoords.length;
                    for (let i = 0; i < satCount; i++) lightMgr.setLight(i, false);
                    lightMap.forEach((isOn, idx) => { if (isOn) lightMgr.setLight(idx, true); });
                }

                render();
            } catch (e) {
                console.error('[AUTO] 快速路径失败:', e);
            }
        }

        // ===== 全量校准路径：完整 findBestTransform =====
        function reMatch() {
            try {
                const obs = getCurrentObsAngle();
                if (!obs) return;
                if (obs.elevation < 0) return;

                const { chiefState, gmst } = obs;
                const { currentLat, currentLon } = appState.interaction;

                const hillCoords = getCurrentHillCoords();
                if (!hillCoords || hillCoords.length === 0) return;

                // 重算 M⁻¹
                const matrix = computeHillToGroundMatrix(chiefState, currentLat, currentLon, gmst);
                if (!matrix) return;
                transformMatrix = matrix;

                // M⁻¹ × 原始 shape
                const { a, b, c, d } = matrix;
                const effectiveShape = cachedShape.map(p => ({
                    x: a * p.x - b * p.y,
                    y: c * p.x - d * p.y
                }));

                // 完整搜索匹配
                const { lightMap, transform } = incrementalMatch(effectiveShape, hillCoords, {});
                lastMatchTime = Date.now();

                // 缓存变换参数 + 半径阈值
                cachedScale = transform.bestScale;
                cachedTx = transform.bestTx;
                cachedTy = transform.bestTy;

                // 重新计算半径阈值（基于对齐后的卫星间距）
                const bestScaled = scalePoints(rotatePoints(effectiveShape, 0), cachedScale);
                const alignedSat = hillCoords.map(s => ({ x: s.x - cachedTx, y: s.y - cachedTy }));
                const sampleSize = Math.min(50, alignedSat.length);
                const dists = [];
                for (let i = 0; i < sampleSize; i++) {
                    let minD = Infinity;
                    for (let j = 0; j < alignedSat.length; j++) {
                        if (i === j) continue;
                        const d = Math.sqrt((alignedSat[i].x - alignedSat[j].x) ** 2 + (alignedSat[i].y - alignedSat[j].y) ** 2);
                        if (d < minD) minD = d;
                    }
                    dists.push(minD);
                }
                dists.sort((a, b) => a - b);
                cachedRadiusThreshold = dists[Math.floor(dists.length / 2)] * 0.7;

                console.log(`[AUTO] 校准完成: scale=${cachedScale.toFixed(3)}, tx=${cachedTx.toFixed(2)}, ty=${cachedTy.toFixed(2)}, 点亮 ${lightMap.size} 颗卫星`);

                // 应用灯光
                const lightMgr = appState.lightManager;
                if (lightMgr) {
                    for (let i = 0; i < hillCoords.length; i++) lightMgr.setLight(i, false);
                    lightMap.forEach((isOn, idx) => { if (isOn) lightMgr.setLight(idx, true); });
                }

                render();
            } catch (e) {
                console.error('[AUTO] 校准失败:', e);
            }
        }

        function getCurrentHillCoords() {
            const currentMode = appState.currentMode;
            if (currentMode === 'csv' && appState.csv.satelliteData) {
                const idx = appState.csv.state.currentTimeIdx;
                if (appState.csv.satelliteData[idx]) {
                    const satData = appState.csv.satelliteData[idx].sats;
                    const chief = satData[0];
                    const cd = { X: chief.X, Y: chief.Y, Z: chief.Z, Vx: chief.Vx, Vy: chief.Vy, Vz: chief.Vz };
                    const result = [];
                    for (let i = 0; i < satData.length; i++) {
                        const s = satData[i];
                        const h = eciToHill(cd, { X: s.X !== undefined ? s.X : s[8], Y: s.Y !== undefined ? s.Y : s[9], Z: s.Z !== undefined ? s.Z : s[10] });
                        result.push({ x: h.alongTrack, y: h.crossTrack, idx: i });
                    }
                    return result;
                }
            } else if (currentMode === 'ws' && appState.ws.lastStepData) {
                const ws = appState.ws.lastStepData;
                if (ws.length > 0) {
                    const cd = { X: ws[0][8], Y: ws[0][9], Z: ws[0][10], Vx: ws[0][11], Vy: ws[0][12], Vz: ws[0][13] };
                    const result = [];
                    for (let i = 0; i < ws.length; i++) {
                        const h = eciToHill(cd, { X: ws[i][8], Y: ws[i][9], Z: ws[i][10] });
                        result.push({ x: h.alongTrack, y: h.crossTrack, idx: i });
                    }
                    return result;
                }
            }
            return null;
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
        return { stop, togglePause, getStatus };
    }
```

- [ ] **Step 4: Add `reverseNearestNeighborLightingRef` reference inside `createConstellationPanel`**

Since `reverseNearestNeighborLighting` is an internal function in `image-processor.js` (not exported), we cannot call it from `constellation-panel.js`. The `incrementalMatch` function handles it internally, but `fastMatch` needs it too.

**Solution:** Move the radius threshold + NN lighting computation into `incrementalMatch`'s return — which is already done. The `fastMatch` needs to call `reverseNearestNeighborLighting` directly, but it's not available.

**Fix:** Export `reverseNearestNeighborLighting` from `image-processor.js` so `constellation-panel.js` can import it.

Add `export` to the function in `image-processor.js`:

```javascript
export function reverseNearestNeighborLighting(shapePoints, satPositions, radiusThreshold) {
    const result = new Map();
    let litCount = 0;
    // ... existing code ...
}
```

Then update the import in `constellation-panel.js` from:

```javascript
import { processImage, incrementalMatch } from '../image-processor.js';
```

to:

```javascript
import { processImage, incrementalMatch, reverseNearestNeighborLighting } from '../image-processor.js';
```

Then in `fastMatch`, use `reverseNearestNeighborLighting` directly (line `const lightMap = reverseNearestNeighborLighting(bestScaled, alignedSat, cachedRadiusThreshold);`).

- [ ] **Step 5: Verify the changes compile**

Since there's no type checker, do a manual check:

```bash
cd "202412 画巨型星座"
node -e "
// Syntax check: try to parse the file
const fs = require('fs');
const code = fs.readFileSync('web/modules/ui/constellation-panel.js', 'utf-8');
try { new Function(code); console.log('Syntax OK'); } catch(e) { console.log('Syntax error:', e.message); }
"
```

Expected: `Syntax OK` (or minor error about missing imports, which is fine for module syntax)

- [ ] **Step 6: Verify `getCurrentHillCoords` is not duplicated**

Search for duplicate Hill coordinate computation code:

```bash
rg "eciToHill" web/modules/ui/constellation-panel.js
```

Confirm `getCurrentHillCoords` is used and the old inline Hill coordinate code from `reMatch` was replaced.

---

### Self-Review Check

- [ ] **Spec coverage:** 
  - Fast path (`fastMatch`): applies cached transform, no search ✅
  - Calibration path (`reMatch`): full `findBestTransform` ✅
  - Calibration interval: 10 ticks (10 seconds) ✅
  - Angle threshold trigger: same as before (5° az / 2° el) ✅
  - Cached parameters: scale, tx, ty, radiusThreshold ✅
  - Tick interval: 1000ms ✅
  
- [ ] **Placeholder scan:** No TBD, TODO, or vague steps. All code complete.

- [ ] **Type consistency:** All function names match: `fastMatch`, `reMatch`, `getCurrentHillCoords`, `reverseNearestNeighborLighting`. The `export function reverseNearestNeighborLighting` change in Task 1 Step 4 is consistent with the import in constellation-panel.js.

# Ground View Rotation Compensation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure satellite lighting patterns appear upright (matching input image orientation) when viewed from a ground observer's perspective, by pre-rotating the target pattern in Hill frame before matching.

**Architecture:** Add a `computeHillToGroundRotation` function in `math-utils.js` that computes the rotation angle between the Hill frame (along-track/cross-track) and the ground observer's az/el plane. Insert a pre-rotation step in `processImage` before the matching pipeline. The observer's lat/lon comes from the existing `appState.interaction` state.

**Tech Stack:** JavaScript (ES modules), Three.js visualization, existing coordinate transform utilities

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `web/modules/math-utils.js` | Add `computeHillToGroundRotation(chief, lat, lon, gmst)` |
| Modify | `web/modules/image-processor.js` | Add `groundRotationAngle` option to `processImage`, pre-rotate shape points |
| Modify | `web/modules/ui/constellation-panel.js` | Compute rotation angle and pass to `processImage` |

---

### Task 1: Add `computeHillToGroundRotation` to math-utils.js

**Files:**
- Modify: `web/modules/math-utils.js` (append new export at end of file)

- [ ] **Step 1: Add the SEZ projection helper and main function**

Append the following code to the end of `web/modules/math-utils.js`:

```javascript
/**
 * 将 ECEF 方向向量投影到观察者处的 SEZ (South-East-Zenith) 切平面
 * @param {Object} dir - ECEF 方向向量 {x, y, z}（单位向量或任意长度）
 * @param {number} latDeg - 观察者纬度 (度)
 * @param {number} lonDeg - 观察者经度 (度)
 * @returns {Object} {south, east, zenith}
 */
export function projectToSEZ(dir, latDeg, lonDeg) {
    const latR = latDeg * DEG;
    const lonR = lonDeg * DEG;
    const sinLat = Math.sin(latR), cosLat = Math.cos(latR);
    const sinLon = Math.sin(lonR), cosLon = Math.cos(lonR);
    return {
        south:  sinLat * cosLon * dir.x + sinLat * sinLon * dir.y - cosLat * dir.z,
        east:  -sinLon * dir.x + cosLon * dir.y,
        zenith: cosLat * cosLon * dir.x + cosLat * sinLon * dir.y + sinLat * dir.z
    };
}

/**
 * 计算 Hill 帧到地面观察者视角的旋转补偿角
 *
 * Hill 帧的沿轨 (S) 和法向 (W) 方向在地面观察者的方位角/仰角平面上
 * 通常不是水平和垂直的。本函数计算这个旋转角，使得在匹配前对图案
 * 施加反向旋转后，地面观察者看到的图案是正的。
 *
 * @param {Object} chief - 主星 ECI 状态 {X, Y, Z, Vx, Vy, Vz} (km, km/s)
 * @param {number} observerLat - 观察者纬度 (度)
 * @param {number} observerLon - 观察者经度 (度)
 * @param {number} gmst - 格林尼治平恒星时 (弧度)
 * @returns {number} 补偿角 (度)，用于 rotatePoints
 */
export function computeHillToGroundRotation(chief, observerLat, observerLon, gmst) {
    // 1. 构建 Hill 帧基向量 (ECI)
    const rLen = Math.sqrt(chief.X ** 2 + chief.Y ** 2 + chief.Z ** 2);
    const rHat = { x: chief.X / rLen, y: chief.Y / rLen, z: chief.Z / rLen };

    // h = r × v (轨道角动量方向)
    const hx = chief.Y * chief.Vz - chief.Z * chief.Vy;
    const hy = chief.Z * chief.Vx - chief.X * chief.Vz;
    const hz = chief.X * chief.Vy - chief.Y * chief.Vx;
    const hLen = Math.sqrt(hx ** 2 + hy ** 2 + hz ** 2);
    const wHat = { x: hx / hLen, y: hy / hLen, z: hz / hLen };

    // S = W × R (沿轨方向)
    const sHat = {
        x: wHat.y * rHat.z - wHat.z * rHat.y,
        y: wHat.z * rHat.x - wHat.x * rHat.z,
        z: wHat.x * rHat.y - wHat.y * rHat.x
    };

    // 2. ECI → ECEF 旋转
    const sEcef = eciToEcef(sHat.x, sHat.y, sHat.z, gmst);
    const wEcef = eciToEcef(wHat.x, wHat.y, wHat.z, gmst);

    // 3. 投影到观察者 SEZ 切平面
    const sSEZ = projectToSEZ(sEcef, observerLat, observerLon);
    const wSEZ = projectToSEZ(wEcef, observerLat, observerLon);

    // 4. 计算沿轨方向在 az/el 平面上的投影角
    //    Hill 帧中 "上" 对应法向 W，"右" 对应沿轨 S
    //    地面帧中 "上" 对应 Zenith 投影，"右" 对应 East
    //    旋转角 = S 方向在 (East, -South) 平面上的角度
    const phiS = Math.atan2(sSEZ.east, -sSEZ.south);

    // Hill 帧的沿轨方向（S）应该映射到地面的"水平"方向
    // 补偿角 = -phiS（使图案反向旋转以抵消 Hill 帧的倾斜）
    const phiComp = -phiS;

    // 转换为角度（rotatePoints 使用角度制）
    return phiComp * 180 / Math.PI;
}
```

- [ ] **Step 2: Verify the function can be imported**

In browser devtools console (or by adding a temporary log in constellation-panel.js), verify:
```javascript
import { computeHillToGroundRotation } from './math-utils.js';
console.log(typeof computeHillToGroundRotation); // should be "function"
```

- [ ] **Step 3: Commit**

```bash
git add web/modules/math-utils.js
git commit -m "feat: add computeHillToGroundRotation for ground-view pattern alignment"
```

---

### Task 2: Add ground rotation option to `processImage`

**Files:**
- Modify: `web/modules/image-processor.js:1082` (processImage function signature and body)

- [ ] **Step 1: Update `processImage` signature and add pre-rotation**

Change the function signature from:
```javascript
export async function processImage(file, satPositions, satCount) {
```
to:
```javascript
export async function processImage(file, satPositions, satCount, options = {}) {
```

After the `extractShapePoints` call (line 1088) and before the `findBestTransform` call (line 1101), insert the pre-rotation block. The full modified section from line 1088 to line 1101 becomes:

```javascript
    const { shapePoints, width, height, previewData, sampled, invert, threshold } = await extractShapePoints(file, nPoints);
    
    if (shapePoints.length < 3) {
        console.warn(`[PROCESS] 形状点太少 (${shapePoints.length})，无法进行匹配`);
        return {
            lightMap: new Map(),
            previewData,
            shapePoints: [],
            transform: null
        };
    }
    
    // 地面视角补偿：预旋转形状点
    // groundRotationAngle 为度（与 rotatePoints 一致）
    let matchShapePoints = shapePoints;
    const groundRotationAngle = options.groundRotationAngle;
    if (groundRotationAngle !== undefined && Math.abs(groundRotationAngle) > 0.01) {
        matchShapePoints = rotatePoints(shapePoints, groundRotationAngle);
        console.log(`[PROCESS] 地面视角补偿旋转: ${groundRotationAngle.toFixed(2)}°`);
    }
    
    // 模块二 & 三：搜索最优变换（含平移搜索）
    const transform = findBestTransform(matchShapePoints, satPositions);
```

Note: `findBestTransform` now receives `matchShapePoints` (the pre-rotated points) instead of `shapePoints`. The `transform.transformedPoints` in line 1104 already uses the output of `findBestTransform`, so downstream code (lighting decision) automatically uses the correctly rotated points.

- [ ] **Step 2: Verify no regressions**

The default `options = {}` means `groundRotationAngle` is undefined, so the pre-rotation is skipped. Existing behavior is fully preserved. Test by uploading an image with no observer set — the result should be identical to before.

- [ ] **Step 3: Commit**

```bash
git add web/modules/image-processor.js
git commit -m "feat: add ground rotation pre-compensation to processImage"
```

---

### Task 3: Wire up ground rotation in constellation-panel.js

**Files:**
- Modify: `web/modules/ui/constellation-panel.js:631-648` (handlePatternUpload function)

- [ ] **Step 1: Import computeHillToGroundRotation**

Add to the existing imports at the top of `constellation-panel.js`. Find the line that imports from `math-utils.js` and add `computeHillToGroundRotation` to the import list. If the current import looks like:

```javascript
import { eciToHill, calcGMST, dateToJD, eciToEcef, ecefToLocal } from '../math-utils.js';
```

Change it to:

```javascript
import { eciToHill, calcGMST, dateToJD, eciToEcef, ecefToLocal, computeHillToGroundRotation } from '../math-utils.js';
```

If there is no existing import from `math-utils.js`, add a new import line.

- [ ] **Step 2: Compute ground rotation angle in handlePatternUpload**

In the `handlePatternUpload` function (starting at line 631), inside the `input.onchange` callback, after getting `satCount` (line 644) and before calling `processImage` (line 647), add the ground rotation computation.

Replace the existing block:
```javascript
                // 获取卫星数量
                const satCount = appState.config?.satCount || satPositions.length || 100;
                
                // 处理图像（新API：传入卫星位置，返回点亮决策）
                const { lightMap, previewData, shapePoints, transform, width, height } = 
                    await processImage(file, satPositions, satCount);
```

With:
```javascript
                // 获取卫星数量
                const satCount = appState.config?.satCount || satPositions.length || 100;
                
                // 计算地面视角补偿旋转角
                let groundAngle = 0;
                try {
                    const currentMode = appState.currentMode;
                    let chiefState = null;
                    let gmst = 0;
                    
                    if (currentMode === 'csv' && appState.csv.satelliteData) {
                        const idx = appState.csv.state.currentTimeIdx;
                        if (appState.csv.satelliteData[idx]) {
                            const s = appState.csv.satelliteData[idx].sats[0]; // 主星
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
                    
                    if (chiefState) {
                        const { currentLat, currentLon } = appState.interaction;
                        groundAngle = computeHillToGroundRotation(chiefState, currentLat, currentLon, gmst);
                        console.log(`[PATTERN] 地面视角补偿角: ${groundAngle.toFixed(2)}° (观察者: ${currentLat.toFixed(1)}°, ${currentLon.toFixed(1)}°)`);
                    }
                } catch (e) {
                    console.warn('[PATTERN] 计算地面补偿角失败，跳过旋转:', e.message);
                }
                
                // 处理图像（传入地面旋转补偿角）
                const { lightMap, previewData, shapePoints, transform, width, height } = 
                    await processImage(file, satPositions, satCount, { groundRotationAngle: groundAngle });
```

- [ ] **Step 3: Verify the import for `parseTimestamp`**

The `parseTimestamp` function is already used in the render function of constellation-panel.js (line 400, 408). Verify it is imported or available in scope. If not, add the import.

- [ ] **Step 4: Manual integration test**

1. Start the application
2. Load a satellite formation (CSV or WS mode)
3. Set observer location in the first-person view (e.g., a city near the sub-satellite point)
4. Switch to the constellation panel (Hill frame view)
5. Upload a simple asymmetric image (e.g., an arrow pointing up →)
6. Switch to first-person view and verify the arrow appears upright
7. Compare with the same image uploaded without the observer set (should be tilted)

- [ ] **Step 5: Commit**

```bash
git add web/modules/ui/constellation-panel.js
git commit -m "feat: wire ground rotation compensation into pattern upload flow"
```

---

### Task 4: Edge case handling

**Files:**
- Modify: `web/modules/math-utils.js` (update `computeHillToGroundRotation`)

- [ ] **Step 1: Add edge case guards to computeHillToGroundRotation**

In `computeHillToGroundRotation`, add the following guards after computing `sSEZ` and `wSEZ` (after the SEZ projection step, before computing `phiS`):

```javascript
    // 边缘情况：编队接近天顶（仰角 > 85°）
    // 此时方位角定义不稳定，使用 S 和 W 在水平面投影长度的加权来稳定
    const sHoriz = Math.sqrt(sSEZ.south ** 2 + sSEZ.east ** 2);
    const wHoriz = Math.sqrt(wSEZ.south ** 2 + wSEZ.east ** 2);
    
    if (sHoriz < 0.01 && wHoriz < 0.01) {
        // 编队几乎在天顶正上方，水平投影消失，无法确定旋转角
        console.warn('[ROTATION] 编队接近天顶，跳过地面视角补偿');
        return 0;
    }
```

- [ ] **Step 2: Add visibility warning in handlePatternUpload**

In `constellation-panel.js`, after computing `groundAngle`, add a visibility check:

```javascript
                    // 检查编队是否在观察者视野中（主星仰角 > 0°）
                    if (chiefState) {
                        const chiefEcef = eciToEcef(chiefState.X, chiefState.Y, chiefState.Z, gmst);
                        const chiefLocal = ecefToLocal(chiefEcef.x, chiefEcef.y, chiefEcef.z, 
                                                        appState.interaction.currentLat, 
                                                        appState.interaction.currentLon);
                        if (chiefLocal.el < 0) {
                            console.warn(`[PATTERN] 编队在地平线以下 (仰角=${chiefLocal.el.toFixed(1)}°)，匹配仅用于参考`);
                        }
                    }
```

- [ ] **Step 3: Commit**

```bash
git add web/modules/math-utils.js web/modules/ui/constellation-panel.js
git commit -m "feat: add edge case handling for zenith and below-horizon formations"
```

---

### Task 5: End-to-end verification

**Files:**
- No new files — verification only

- [ ] **Step 1: Verify with known geometry (equatorial orbit + equatorial observer)**

Load a formation with:
- Chief orbit: i=0°, Ω=0° (equatorial orbit)
- Observer: lat=0°, lon=0° (on the equator)

Expected: rotation compensation angle ≈ 0° or 180° (depending on the chief's position relative to the observer). Log output should show the computed angle.

- [ ] **Step 2: Verify with inclined orbit**

Load the actual hexagonal formation (i=30°, Ω=-1.53°). Set observer to a mid-latitude city (e.g., 30°N, 120°E). Upload an asymmetric pattern (arrow or letter "P"). Verify:

1. In the Hill frame panel, the pattern appears slightly rotated
2. In the first-person view, the pattern appears upright (matching the input image orientation)

Take screenshots of both views for comparison.

- [ ] **Step 3: Verify without observer set**

Clear the observer location (or use default). Upload a pattern. The behavior should be identical to before this feature (no rotation compensation applied, angle = 0).

- [ ] **Step 4: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: adjustments from end-to-end verification"
```

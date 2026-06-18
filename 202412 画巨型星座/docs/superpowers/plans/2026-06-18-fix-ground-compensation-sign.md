# Fix Ground Perspective Compensation Sign Error — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix `correctedAngle` sign in `processImage` and stale `initialPatternMatch` state so that satellite lighting patterns correctly change when the ground observer's azimuth/elevation changes.

**Architecture:** `computeHillToGroundRotation` returns `phiComp = -phiS` (compensation angle that makes S point "up" in the observer's line-of-sight plane). But the compensation needs to rotate satellites BY `phiS` (= `-phiComp`) to align Hill-frame positions with what the observer sees. The code review incorrectly changed `correctedAngle = -groundRotationAngle` to `correctedAngle = groundRotationAngle`, breaking the compensation. Revert this, and provide a state-reset mechanism.

**Tech Stack:** JavaScript (ES modules), Three.js visualization

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `web/modules/image-processor.js:1122` | Revert `correctedAngle` sign from `groundRotationAngle` to `-groundRotationAngle` |
| Modify | `web/modules/ui/constellation-panel.js:715-722` | Invalidate stale `initialPatternMatch` when sign semantics could have changed |
| Verify | (browser console) | Confirm pattern rotates with observer angle |

---

## Background

`computeHillToGroundRotation` at `math-utils.js:179-254`:
1. Builds Hill frame basis vectors (R, S, W) from chief satellite ECI position/velocity
2. Projects S and W to observer's SEZ (South-East-Zenith) frame
3. Builds a line-of-sight (LOS) plane coordinate system from the observer's view direction
4. Projects S onto the LOS plane to get its angle from "up" to "right": `phiS`
5. Returns `phiComp = -phiS` (comments say "补偿角 = -phiS")

**What phiS means:** If the Hill frame's along-track direction (S) appears at angle phiS from "up" in the observer's view, then satellites at Hill position (s, w) appear at that rotated orientation.

**What the compensation must do:** Rotate satellite Hill positions BY `phiS` so that the observer sees them at their canonical (S=right, W=up) orientation. Since `groundRotationAngle = phiComp = -phiS`, we need `correctedAngle = -groundRotationAngle = phiS`.

**What the bug does:** `correctedAngle = groundRotationAngle = phiComp = -phiS` rotates satellites in the wrong direction. The matching still finds some solution but it's the same suboptimal solution regardless of observer angle because the search center `centerAngle` and the actual best angle diverge by `3*ΔphiS`, pushing the true optimum outside the 60° search window.

---

### Task 1: Revert `correctedAngle` sign in image-processor.js

**Files:**
- Modify: `web/modules/image-processor.js:1119-1122` (the `correctedAngle` assignment and comment)
- Modify: `web/modules/image-processor.js:1132` (log message)

- [ ] **Step 1: Change `correctedAngle` from `groundRotationAngle` to `-groundRotationAngle`**

Current (broken) code at `image-processor.js:1119-1122`:
```javascript
        // 旋转角：computeHillToGroundRotation 返回 phiComp = -phiS
        // phiS 是 S(沿轨) 方向在视线平面上从"上"到"右"的角度
        // phiComp 已经是补偿角（让 S 对齐"上"方向），直接使用即可
        const correctedAngle = groundRotationAngle;
```

Replace with:
```javascript
        // 旋转角：computeHillToGroundRotation 返回 phiComp = -phiS
        // phiS = S(沿轨)方向在视线平面上从"上"到"右"的角度
        // 补偿需要旋转卫星 BY phiS，即 correctedAngle = -groundRotationAngle
        const correctedAngle = -groundRotationAngle;
```

- [ ] **Step 2: Fix the console log message**

Current at `image-processor.js:1132`:
```javascript
        console.log(`[PROCESS] 地面视角补偿: 围绕质心(${cx.toFixed(1)},${cy.toFixed(1)})旋转${correctedAngle.toFixed(2)}° + 水平镜像`);
```

This message is fine (it logs the actual value), no change needed. The log already shows the corrected value.

- [ ] **Step 3: Verify the edit**

Read lines 1118-1133 to confirm:
```javascript
        // 旋转角：computeHillToGroundRotation 返回 phiComp = -phiS
        // phiS = S(沿轨)方向在视线平面上从"上"到"右"的角度
        // 补偿需要旋转卫星 BY phiS，即 correctedAngle = -groundRotationAngle
        const correctedAngle = -groundRotationAngle;
```

---

### Task 2: Invalidate stale `initialPatternMatch` state

**Files:**
- Modify: `web/modules/ui/constellation-panel.js:715-722`

**Context:** The `initialPatternMatch` object stores `{bestAngle, groundAngle, timestamp}` from the first upload. This state was saved while the buggy formula was active, so `bestAngle` corresponds to the wrong rotation semantics. Subsequent uploads compute `centerAngle = initialPatternMatch.bestAngle - groundRotation` which is now invalid.

- [ ] **Step 1: Add a version marker to `initialPatternMatch`**

Read around `constellation-panel.js:715-722` to find the exact save code. Add a version field:

```javascript
                    initialPatternMatch = {
                        bestAngle: transform.bestAngle,
                        groundAngle: groundAngle,
                        timestamp: Date.now(),
                        version: 2  // bump when correctedAngle semantics change
                    };
```

- [ ] **Step 2: Add a version check when reading `initialPatternMatch`**

Read around `constellation-panel.js:703-708`. Add a check that discards state from a different version:

```javascript
                let centerAngle = 0;
                if (initialPatternMatch && initialPatternMatch.version === 2) {
                    const groundRotation = groundAngle - initialPatternMatch.groundAngle;
                    centerAngle = initialPatternMatch.bestAngle - groundRotation;
                    console.log(`[PATTERN] 旋转补偿: Δθ(地面)=${groundRotation.toFixed(2)}°, centerAngle=${centerAngle.toFixed(2)}° (初始bestAngle=${initialPatternMatch.bestAngle.toFixed(2)}°, 初始groundAngle=${initialPatternMatch.groundAngle.toFixed(2)}°, 当前groundAngle=${groundAngle.toFixed(2)}°)`);
                }
```

- [ ] **Step 3: Verify the edit**

Read lines 703-722 to confirm the version check is in place.

---

### Task 3: Test the fix

- [ ] **Step 1: Reload the browser**

Force a clean reload (Ctrl+F5 or DevTools → Network → Disable cache) to clear all in-memory state including `initialPatternMatch`.

- [ ] **Step 2: Upload a pattern at one observer position**

1. Set observer to a low azimuth (e.g., 0°) and moderate elevation (e.g., 30°)
2. Upload a "B" or vertical-line pattern image
3. Observe which satellites are lit
4. **Expected:** pattern appears upright (may still have minor offset from mirror/handing issues)

- [ ] **Step 3: Change observer position and re-upload**

1. Change observer azimuth by 90° (or change lat/lon significantly)
2. Upload the same pattern image again
3. Observe which satellites are lit
4. **Expected:** DIFFERENT satellites should be lit (the pattern "moves" to different Hill positions so the ground observer still sees it upright)
5. Check the browser console for:
   - `[PATTERN] 地面视角补偿角: ...° | 方位角: ...°, 仰角: ...°` — the ground angle changes
   - `[PATTERN] 旋转补偿: Δθ(地面)=...°, centerAngle=...°` — centerAngle shifts
   - `[PATTERN] 已存储匹配状态: bestAngle=...°, groundAngle=...°` — version=2

- [ ] **Step 4: Verify the console logs confirm the fix**

Check that:
- `correctedAngle` in the `[PROCESS]` log is non-zero and varies with observer position
- The `lightMap.size` changes (different number of satellites lit, or different positions)

---

### Task 4: Commit

- [ ] **Step 1: Stage the changed files**

```bash
git add "202412 画巨型星座/web/modules/image-processor.js"
git add "202412 画巨型星座/web/modules/ui/constellation-panel.js"
```

- [ ] **Step 2: Review the diff**

```bash
git diff --cached
```

- [ ] **Step 3: Commit**

```bash
git commit -m "fix: revert correctedAngle sign and version-invalidate stale initialPatternMatch

- correctedAngle = groundRotationAngle → correctedAngle = -groundRotationAngle
- computeHillToGroundRotation returns phiComp = -phiS, so the needed
  rotation is correctedAngle = -phiComp = phiS = -groundRotationAngle
- Add version field to initialPatternMatch to discard state saved
  while the buggy formula was active"
```

---

## Self-Review Checklist

### 1. Spec Coverage
- **Revert sign**: Task 1 ✓
- **Stale state fix**: Task 2 ✓
- **Test/verify**: Task 3 ✓
- **Commit**: Task 4 ✓

### 2. Placeholder Scan
- No TBD, TODO, or "implement later" patterns
- All code blocks contain actual code, not descriptions
- All commands are explicit with expected output
- All file paths are exact

### 3. Type Consistency
- `initialPatternMatch.version` is consistently `version: 2` in save and `initialPatternMatch.version === 2` in read
- `correctedAngle = -groundRotationAngle` matches `const correctedAngle = -groundRotationAngle`
- No reference to types/functions not defined

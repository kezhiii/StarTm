# 自适应混合投影方案 — 实施计划

## 问题描述

当卫星编队从地面观察且靠近天顶（仰角接近90°）时，3D视图中编队图案出现严重透视畸变：
- 红框内边长 < 黄框内边长
- 六边形晶格被"压扁"

**根本原因**：`first-person.js` 使用球坐标计算卫星3D位置：

```javascript
x = range * cos(el) * sin(az)    // 当 el→90°, cos(el)→0, x 被压缩
y = range * sin(el)              // 高度不受影响
z = -range * cos(el) * cos(az)   // 当 el→90°, cos(el)→0, z 被压缩
```

## 解决方案

**自适应混合投影**：根据仰角动态混合球坐标和平面投影。

```javascript
elFactor = cos(elR)  // 0°→1.0, 90°→0.0

x = elFactor * 球坐标x + (1-elFactor) * 平面投影x
z = elFactor * 球坐标z + (1-elFactor) * 平面投影z
y = range * sin(elR)  // 高度始终使用球坐标
```

## 修改文件

### 1. `web/modules/views/first-person.js`

**修改点 A：CSV 版本（第 261-267 行）**

当前代码：
```javascript
const displayDist = (local.range * SCENE_SCALE) / FORMATION_SCALE;
const azR = centerAz * DEG + (local.az * DEG - centerAz * DEG) * FORMATION_SCALE;
const elR = centerEl * DEG + (local.el * DEG - centerEl * DEG) * FORMATION_SCALE;
mesh.position.set(
    displayDist * Math.cos(elR) * Math.sin(azR),
    displayDist * Math.sin(elR),
    -displayDist * Math.cos(elR) * Math.cos(azR)
);
```

修改为：
```javascript
const displayDist = (local.range * SCENE_SCALE) / FORMATION_SCALE;
const azR = centerAz * DEG + (local.az * DEG - centerAz * DEG) * FORMATION_SCALE;
const elR = centerEl * DEG + (local.el * DEG - centerEl * DEG) * FORMATION_SCALE;

// 自适应混合投影：低仰角用球坐标，高仰角用平面投影
const elFactor = Math.cos(elR);
const sphericalX = displayDist * Math.cos(elR) * Math.sin(azR);
const sphericalZ = -displayDist * Math.cos(elR) * Math.cos(azR);
const planeX = displayDist * Math.sin(azR);
const planeZ = -displayDist * Math.cos(azR);
mesh.position.set(
    elFactor * sphericalX + (1 - elFactor) * planeX,
    displayDist * Math.sin(elR),
    elFactor * sphericalZ + (1 - elFactor) * planeZ
);
```

**修改点 B：WS 版本（第 508-514 行）**

同样的修改，应用到 `updateSatellitesFirstPersonWs` 函数。

### 2. `web/modules/math-utils.js`

**决策**：保留之前的 M⁻¹ 矩阵混合投影修改（针对 2D 画布渲染），或回退。

**建议**：保留，因为：
- M⁻¹ 矩阵混合投影解决了 2D 画布渲染的天顶问题
- 3D 渲染的修复是独立的
- 两者可以共存

## 备份

- `backups/math-utils_20260626_155612/math-utils.js.bak`（已备份）
- 需要备份 `first-person.js`

## 验证

| 测试场景 | 预期结果 |
|----------|----------|
| 仰角 30° | 与修改前一致（球坐标） |
| 仰角 60° | 与修改前接近（球坐标为主） |
| 仰角 80° | 轻微拉伸（混合投影） |
| 仰角 85° | 明显拉伸（平面投影为主） |
| 仰角 90° | 完全平面投影（无压缩） |

## 风险

- **低仰角**：无影响（elFactor ≈ 1，完全使用球坐标）
- **中仰角**：轻微视觉变化（混合过渡）
- **高仰角**：明显视觉变化（平面投影，无压缩）

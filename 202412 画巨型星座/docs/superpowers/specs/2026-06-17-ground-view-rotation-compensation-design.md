# 地面视角图案朝向补偿设计

## 概述

当前卫星编队的图像匹配在 Hill/LVLH 帧（沿轨 S vs 法向 W）的二维投影中完成。图案在 Hill 帧中是"正的"，但从地面观察者的方位角/仰角视角看，图案可能出现旋转倾斜。

本设计通过在匹配前对目标图案施加一个预旋转补偿角，使得最终点亮的卫星编队从地面观察者视角看是正的（与输入图像朝向一致）。

## 方案选择

采用 **方案 A：Hill 帧预旋转**。

理由：
- 编队规模约 4km，轨道高度约 500km，天球角直径 ~0.46°，az/el 投影在此范围内高度线性
- 改动最小，只需在现有匹配管线中插入一步旋转
- 复用现有的 `rotatePoints` 和 `findBestTransform` 函数
- 精度足够：边缘卫星的位置误差 < 1%

被否决的方案：
- 方案 B（az/el 空间匹配）：改动大，有天顶奇异点，az/el 各向异性
- 方案 C（切平面投影）：引入新投影数学，对当前规模收益有限

## 旋转角计算方法

### 数学推导

Hill 帧基向量在 ECI 坐标中定义：
- R_hat = r_chief / |r_chief|（径向，沿主星位置矢量）
- W_hat = (r × v) / |r × v|（法向，轨道面法线）
- S_hat = W_hat × R_hat（沿轨，在轨道面内垂直于径向）

地面观察者的局部切平面（SEZ 坐标）：
- South：沿经线向南
- East：沿纬线向东
- Zenith：垂直向上（远离地心）

### 计算步骤

函数：`computeHillToGroundRotation(chief, observerLat, observerLon, gmst)`

1. 从主星 ECI 状态 (X, Y, Z, Vx, Vy, Vz) 构建 Hill 帧基向量 S_hat 和 W_hat（ECI 坐标）

2. ECI → ECEF 旋转（使用 GMST 角）：
   - S_hat_ECEF = eciToEcef(S_hat.x, S_hat.y, S_hat.z, gmst)
   - W_hat_ECEF = eciToEcef(W_hat.x, W_hat.y, W_hat.z, gmst)

3. ECEF → SEZ 投影（以观察者位置为原点）：
   - 观察者 ECEF 坐标：(R·cos(lat)·cos(lon), R·cos(lat)·sin(lon), R·sin(lat))
   - 将 S_hat_ECEF 和 W_hat_ECEF 作为方向向量（非位置），投影到观察者的 SEZ 切平面
   - 使用下方 SEZ 投影公式提取 (South, East) 分量

4. 计算旋转角：
   - φ_S = atan2(S_East, -S_South)（S_hat 在 az/el 平面上的方向角）
   - φ_W = atan2(W_East, -W_South)（W_hat 在 az/el 平面上的方向角）
   - Hill 帧到地面帧的旋转角 φ = φ_S（沿轨方向在 az/el 平面上的投影角）

5. 补偿角：φ_comp = -φ

### SEZ 投影细节

对于 ECEF 方向向量 (dx, dy, dz)，在观察者 (lat, lon) 处的 SEZ 分量为：
- S = sin(lat)·cos(lon)·dx + sin(lat)·sin(lon)·dy - cos(lat)·dz
- E = -sin(lon)·dx + cos(lon)·dy
- Z = cos(lat)·cos(lon)·dx + cos(lat)·sin(lon)·dy + sin(lat)·dz

取 (S, E) 分量即为该方向在观察者切平面上的投影。

## 管线集成

### 修改位置

修改文件：`web/modules/image-processor.js`

在 `processImage` 函数中，`extractShapePoints` 之后、`findBestTransform` 之前，插入预旋转步骤：

```javascript
// 现有流程
const { shapePoints, previewData, patternType } = extractShapePoints(file, nPoints);

// 新增：地面视角补偿旋转
if (groundRotationAngle !== undefined && groundRotationAngle !== 0) {
    const rotated = rotatePoints(shapePoints, groundRotationAngle);
    shapePoints = rotated;
}

// 现有流程继续
const transform = findBestTransform(shapePoints, satPositions);
```

### 新增函数

文件：`web/modules/math-utils.js`

```javascript
/**
 * 计算 Hill 帧到地面观察者视角的旋转补偿角
 * @param {Object} chief - 主星 ECI 状态 {X, Y, Z, Vx, Vy, Vz} (km, km/s)
 * @param {number} observerLat - 观察者纬度 (度)
 * @param {number} observerLon - 观察者经度 (度)
 * @param {number} gmst - 格林尼治平恒星时 (弧度)
 * @returns {number} 补偿角 (弧度)，用于 rotatePoints
 */
export function computeHillToGroundRotation(chief, observerLat, observerLon, gmst) { ... }
```

### 参数传递

`constellation-panel.js` 的 `handlePatternUpload` 中，在调用 `processImage` 时传入额外参数：

```javascript
const chief = getCurrentChiefState(); // 从当前帧数据获取主星 ECI 状态
const gmst = calcGMST(currentJD);
const groundAngle = computeHillToGroundRotation(chief, currentLat, currentLon, gmst);

const result = await processImage(file, satPositions, satCount, {
    groundRotationAngle: groundAngle
});
```

## 用户交互流程

1. 用户设置观察地点（经纬度）— 复用第一人称视角的现有 UI
2. 用户上传图片触发匹配
3. 系统自动获取当前时刻主星 ECI 状态和 GMST
4. 计算 φ_comp，对提取的形状点施加预旋转
5. 执行正常的 Hill 帧匹配（findBestTransform + 匈牙利算法）
6. 返回 lightMap，点亮卫星
7. 用户切换到第一人称视角，看到正的图案

## 边界情况处理

### 编队不可见

当编队在地平线以下时（主星仰角 < 0°），匹配仍可正常进行（Hill 帧中），但地面观察者看不到。在 UI 上显示警告提示："当前编队不在观察者视野中，匹配结果仅用于参考"。

### 编队接近天顶

当编队仰角 > 85° 时，方位角定义不稳定（在天顶处奇异）。处理方式：
- 仰角 > 85° 时，使用 85° 处的极限旋转角
- 在 UI 上提示："编队接近天顶，图案朝向可能有轻微偏差"

### 观察者未设置

当用户未设置观察地点时，自动计算编队中心的星下点（sub-satellite point）作为默认观察位置：
- lat = arcsin(Z / |r|)（地心纬度近似）
- lon = atan2(Y, X) - GMST（从 ECI 反推经度）

## 数据流总览

```
用户上传图片
       │
       ▼
extractShapePoints(image)
       │
       ▼ shapePoints (归一化)
       │
       ├── 获取 chief ECI, observerLat/Lon, GMST
       ├── computeHillToGroundRotation(chief, lat, lon, gmst) → φ_comp
       │
       ▼
rotatePoints(shapePoints, φ_comp)    ← 新增步骤
       │
       ▼ rotatedShapePoints
       │
findBestTransform(rotatedShapePoints, satPositions)
       │
       ▼ transform + matches
       │
reverseNearestNeighborLighting(...)
       │
       ▼ lightMap
       │
lightManager.setLight(idx, isOn)
```

## 测试策略

1. **单元测试**：验证 `computeHillToGroundRotation` 在已知几何配置下返回正确的旋转角
   - 赤道轨道 + 赤道观察者 → 旋转角应为 0° 或 180°
   - 极轨 + 赤道观察者 → 旋转角应为 ±90°
   
2. **集成测试**：使用已知的图案（如箭头→）验证地面视角下图案方向
   - 在第一人称视角截图，检查箭头是否指向正确方向

3. **边界测试**：天顶附近、地平线以下的行为验证

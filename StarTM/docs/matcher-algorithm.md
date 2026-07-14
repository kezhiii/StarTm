# 卫星编队图案匹配与朝向保持算法

## 1. 坐标系定义

| 符号 | 名称 | 说明 |
|------|------|------|
| (S, W) | Hill 帧 | S = 沿轨方向, W = 轨道面法向, R = 径向（地心方向） |
| (right, up) | LOS 帧 | 观察者视线平面: right=向右, up=向天顶, 垂直于视线方向 |
| (x, y) | 图像帧 | x=向右, y=向下（Canvas 约定） |

关键约定：
- 图像 y-向下 → LOS up-向上: `LOS_up = -image_y`
- 图像 x-向右 → LOS right-向右: `LOS_right = image_x`

## 2. 算法总览

```
输入: 图像文件 + 卫星 ECI 状态 + 观察者经纬度 + GMST
输出: 每颗卫星的灯光状态 {idx: on/off}

步骤:
  1. 提取形状点集 shape_IMG (图像坐标, 归一到质心)
  2. 计算所有卫星的 Hill 坐标 (S_i, W_i)
  3. 计算投影矩阵 M (Hill→LOS) 及其逆矩阵 M⁻¹ (LOS→Hill)
  4. 预变形: shape_HILL = M⁻¹ × [shape_IMG.x, -shape_IMG.y]^T
  5. 匹配: 在 Hill 空间搜索最优 scale + translation
  6. 点亮: 反向最近邻, 距离阈值内的卫星点亮
```

## 3. 形状提取

```
输入: 图像文件
输出: 形状点集 shape_IMG (归一化到质心)

算法:
  1. 将图像缩放到 256×256 Canvas (黑色背景, 居中绘制)
  2. 灰度化 → Otsu 自动阈值 → 二值化
  3. 自动检测图案类型:
     a) 提取骨架 (距离变换 + NMS)
     b) 提取轮廓 (4-连通边缘)
     c) 计算骨架比例 = 骨架点数 / 前景点数
     d) 计算轮廓比例 = 轮廓点数 / 前景点数
     e) 判断:
        - 骨架比例 > 0.20 且 轮廓比例 > 0.35 → 'line'
        - 轮廓比例 > 0.50 → 'contour'
        - 否则 → 'filled'
  4. 根据类型采样:
     - 'line':   从骨架点 FPS 采样
     - 'contour': 从轮廓点 FPS 采样
     - 'filled':  连通域感知采样 (按面积比例分配点数 + 各域独立 FPS)
  5. 归一化: 所有采样点减去质心 → shape_IMG
```

其中 FPS (Farthest Point Sampling) 保证采样点在空间上均匀分散：

```
FPS(points, N):
  选取距质心最近的点为 seed
  REPEAT 直到选中 N 个点:
    对每个未选中点 p:
      计算 p 到所有已选中点的最小距离 d_min(p)
    选择 d_min(p) 最大的点加入已选中集
```

## 4. Hill 坐标计算

```
输入: 主星 ECI 状态 (X_c, Y_c, Z_c, Vx_c, Vy_c, Vz_c)
      从星 ECI 位置 (X_d, Y_d, Z_d)
输出: 从星在 Hill 帧中的坐标 (S, W)

算法:
  1. 计算主星径向单位向量 r̂ = (X_c, Y_c, Z_c) / |R_c|
  2. 计算轨道角动量方向 ŵ = (r̂ × V_c) / |r̂ × V_c|
  3. 计算沿轨方向 ŝ = ŵ × r̂
  4. 计算相对位置 ΔR = (X_d-X_c, Y_d-Y_c, Z_d-Z_c)
  5. 投影:
      径向 R = ΔR · r̂
      沿轨 S = ΔR · ŝ
      法向 W = ΔR · ŵ
  6. 返回 (S, W) 用于 2D 图案匹配
```

## 5. 投影矩阵 M: Hill → LOS

M 描述了从 Hill 帧 (S,W) 到观察者 LOS 帧 (right,up) 的投影。

### 5.1 基向量投影

```
  1. sHAT, wHAT → ECI → ECEF → SEZ (south-east-zenith)
  2. 计算视线方向 LOS (SEZ 中)
  3. 构建视线平面正交基 (right, up):
     - up = 天顶方向减去 LOS 分量, 归一化
     - right = LOS × up
  4. 投影:
     sR = sSEZ · right   (S 在 right 方向的分量)
     sU = sSEZ · up      (S 在 up 方向的分量)
     wR = wSEZ · right   (W 在 right 方向的分量)
     wU = wSEZ · up      (W 在 up 方向的分量)
```

### 5.2 构建 2×2 矩阵 M

```
M = [ [sR, wR],   ← right = sR * S + wR * W
      [sU, wU] ]  ← up   = sU * S + wU * W
```

M 将 Hill 坐标映射到 LOS 平面:
```
[ right ]   = M · [ S ]
[ up    ]         [ W ]
```

M 不是纯旋转矩阵 —— 当 S 和 W 在 LOS 平面上的投影不正交时, M 包含剪切 (shear)。

### 5.3 逆矩阵 M⁻¹

```
det = sR * wU - sU * wR
M⁻¹ = (1/det) * [ [ wU, -wR ],
                   [ -sU,  sR ] ]
```

M⁻¹ 将 LOS 坐标映射回 Hill 空间, 用于预变形:
```
[ S ]   = M⁻¹ · [ right ]
[ W ]          [ up    ]
```
1
数学上保证: `M(M⁻¹(shape)) = shape`, 即观察者看到的形状等于原始形状。

## 6. 形状预变形 (M⁻¹ 补偿)

这是地面视角补偿的核心步骤。

### 6.1 Y 轴取反

图像采用 Canvas 坐标 (y-向下), LOS 帧使用 up-向上。需要先取反:

```
shape_LOS = [shape_IMG.x, -shape_IMG.y]^T
```

### 6.2 应用 M⁻¹

```
shape_HILL = M⁻¹ · shape_LOS

等价于:
  S_shape = a * shape_x - b * shape_y
  W_shape = c * shape_x - d * shape_y

其中 M⁻¹ = [[a, b], [c, d]]
```

### 6.3 原理

- `shape_HILL` 是需要在 Hill 空间中点亮的卫星位置
- 观察者从地面看每个卫星时, 投影 M 将其映射到 LOS 帧
- `M(M⁻¹(shape_LOS)) = shape_LOS` → 观察者看到正确形状

### 6.4 为什么不用单轴旋转

旧方法只计算 S 轴在 LOS 平面的方向角 φ_S, 然后旋转 shape 抵消:
```
shape_rotated = rotate(shape, -φ_S)
```

但 M 不是纯旋转 —— 当 S 和 W 投影不正交时, 有剪切分量。单轴旋转无法补偿剪切。

M⁻¹ 是完整的 2×2 仿射变换, 同时处理旋转和剪切, 因此更精确。

## 7. 图案匹配

匹配在 Hill 空间进行, 目标是找到最优变换使 shape_HILL 与卫星位置 (S_i, W_i) 对齐。

### 7.1 匹配参数

```
搜索参数: scale (全局缩放), tx/ty (平移)
固定参数: angle = 0° (禁用角度搜索, 否则会抵消 M⁻¹ 补偿)
```

### 7.2 粗搜索 (grid search + 贪心)

```
输入: shape_HILL (N 个点), satellites_HILL (M 个点, M ≥ N)
输出: Top-K 候选解 {scale, tx, ty, cost}

参数:
  gridSize = 3 (平移网格)
  scaleSteps = 5 (缩放步数)

算法:
  1. 计算卫星质心 (cx, cy) 和最大分布半径 maxDist
  2. 计算形状最大半径 shapeMaxDist
  3. 确定缩放范围 [minScale, maxScale] = [0.5, 1.5] * maxDist/shapeMaxDist
  4. FOR each (tx, ty) in 3×3 grid:
       FOR each scale in [minScale .. maxScale]:
         // 贪心匹配 (每个形状点找最近卫星, 允许重复)
         FOR each shape point p:
           找最近卫星 → 累加距离 + 重复惩罚
         cost = 总距离 + 重复惩罚
         加入候选列表
  5. 按 cost 排序, 取 Top-10
```

贪心匹配的距离计算:
```
cost = Σ_i min_j distance(scale * shape_HILL[i], satellite_HILL[j] - (tx,ty))
        + penalty Σ_c (count_sat[c] - 1)² × 3.0
```

### 7.3 精细搜索 (匈牙利算法)

```
输入: Top-5 粗搜索候选
输出: 最优 {angle, scale, tx, ty}

参数:
  fineScaleSteps = 5
  角度固定为 0° (M⁻¹ 补偿模式下)

算法:
  FOR each candidate in Top-5:
    FOR each fineScale in [cand.scale - Δs .. cand.scale + Δs]:
      平移固定 = cand.tx, cand.ty
      angle = 0 (固定)
      
      构建成本矩阵 costMatrix[N×M]:
        costMatrix[i][j] = distance(shape_HILL[i], satellite_HILL[j])
      
      匈牙利算法求最小权匹配 → totalCost
      记录最优 {angle, scale, tx, ty}
```

### 7.4 匈牙利算法 (最小权匹配)

```
输入: N×M 成本矩阵 (N ≤ M)
输出: 形状点 → 卫星索引的映射 matchX[N]

算法:
  1. 初始化标号 lx[i] = min_j(costMatrix[i][j]), ly[j] = 0
  2. 匹配 matchX 和 matchY 初始化为 -1
  3. FOR i = 0..N-1:
       WHILE 未找到增广路径:
         BFS 在相等子图中搜索增广路径
         IF 找到: 更新匹配, BREAK
         ELSE: 更新标号 (lx, ly), 扩大相等子图
  4. 返回 matchX
```

## 8. 灯光决策

### 8.1 变换形状点

```
transformed = scale(rotate(shape_HILL, bestAngle), bestScale)
// bestAngle = 0, 所以 rotate 是无操作
```

### 8.2 对齐卫星位置

```
alignedSat[i] = satellite_HILL[i] - (bestTx, bestTy)
// 平移到形状相同坐标系
```

### 8.3 反向最近邻点亮

```
FOR each satellite i:
  minDist = min_j distance(alignedSat[i], transformed[j])
  IF minDist ≤ radiusThreshold:
    lightMap[i] = ON
  ELSE:
    lightMap[i] = OFF
```

### 8.4 半径阈值

```
1. 采样 50 颗卫星, 计算每颗的中位数最近邻距 medianSatDist
2. radiusThreshold = medianSatDist × 0.7
   (覆盖网格间隙, 但不误点亮远离形状的卫星)
```

## 9. 朝向保持原理

### 9.1 问题

从地面看, Hill 帧的 S 和 W 轴不是水平/垂直的。观察者绕卫星移动时, 投影 M 连续变化。如果不补偿, 同一图案在不同观测角下看起来是旋转/变形的。

### 9.2 方案: M⁻¹ 补偿

```
shape_HILL = M⁻¹ · shape_LOS
观察者看到: M(shape_HILL) = M(M⁻¹(shape_LOS)) = shape_LOS ✓
```

因为 M·M⁻¹ = I (单位矩阵), 观察者看到的正是原始形状。

### 9.3 为什么禁用角度搜索

如果不禁用, 匹配器会找到 angle = θ₀ + φ 使:
```
distance(rotate(shape, θ), rotate(sats, φ)) 最小化
```

这等价于找到 θ = θ₀ + φ, 完全抵消 M⁻¹ 的预旋转效果, 使图案退化为未补偿状态。

禁用角度搜索后, 匹配器只评估 angle=0:
```
distance(shape_HILL, satellites_HILL) 最小化
```

这样 shape 保持正确的 Hill 空间位置, 观察者投影自然还原。

### 9.4 为什么 centerAngle 固定为 0

禁用角度搜索后, centerAngle 决定了观察者看到的最终朝向:
- centerAngle = 0 → 观察者看到形状的原始朝向
- centerAngle ≠ 0 → 观察者看到形状旋转了 centerAngle

M⁻¹ 随观测角自动变化, 不需要 centerAngle 追踪观测角变化。

### 9.5 为什么不用单轴旋转

```
旧方法: shape_rotated = rotate(shape, -φ_S)
  仅补偿 S 轴方向, 忽略 W 轴投影

新方法: shape_corrected = M⁻¹ · shape_LOS
  完整 2×2 仿射变换, 同时补偿旋转和剪切
```

当 M 不是纯旋转时 (存在剪切), 单轴旋转会产生残余误差。M⁻¹ 精确补偿。

## 10. 完整流程伪代码

```
FUNCTION lightPattern(image, satellitesECI, observerLat, observerLon, gmst):
  // 1. 形状提取
  shapeIMG = extractShapePoints(image)  // 归一化到质心

  // 2. Hill 坐标
  chief = satellitesECI[0]
  FOR each sat in satellitesECI:
    (S_i, W_i) = eciToHill(chief, sat)

  // 3. 投影矩阵
  M_inv = computeHillToGroundMatrix(chief, observerLat, observerLon, gmst)
  // M_inv = {a, b, c, d}, 不可见时返回 null

  IF M_inv is null:
    // 编队在地平线以下, 不做补偿
    matched = findBestTransform(shapeIMG, (S_i, W_i))
  ELSE:
    // 4. 预变形 (y 取反 + M⁻¹)
    shapeHILL = shapeIMG.map(p => ({
      x: M_inv.a * p.x - M_inv.b * p.y,
      y: M_inv.c * p.x - M_inv.d * p.y
    }))

    // 5. 匹配 (禁用角度搜索)
    matched = findBestTransform(shapeHILL, (S_i, W_i),
                                centerAngle: 0,
                                disableAngleSearch: true)

  // 6. 反向最近邻点亮
  alignedSats = (S_i, W_i) - (matched.tx, matched.ty)
  threshold = medianSatelliteDistance(alignedSats) * 0.7
  lightMap = reverseNearestNeighbor(
    scale(shape, matched.scale), alignedSats, threshold)

  RETURN lightMap
```

## 11. 数学原理验证

### 单位性验证

```
M(M⁻¹(x)) = x

证明:
M = [[sR, wR], [sU, wU]]
M⁻¹ = (1/det) × [[wU, -wR], [-sU, sR]]
det = sR×wU - sU×wR

M × M⁻¹ = (1/det) × [[sR×wU - wR×sU,  -sR×wR + wR×sR],
                       [sU×wU - wU×sU,  -sU×wR + wU×sR]]
         = (1/det) × [[det, 0], [0, det]]
         = I ✓
```

### 朝向保持验证

```
设 shape_LOS 为原始形状
预变形: shape_HILL = M⁻¹ · shape_LOS
卫星位置: sat_HILL ≈ shape_HILL (匹配后)
观察者看到: M(sat_HILL) ≈ M(M⁻¹(shape_LOS)) = shape_LOS ✓

观察者看到的形状 = 原始形状, 朝向保持 ✓
```

## 12. 关键术语

| 术语 | 说明 |
|------|------|
| Hill 帧 (RSW) | 卫星轨道参考系, R=径向, S=沿轨, W=法向 |
| LOS 帧 | Line-of-Sight 帧, 垂直于观察者→卫星连线 |
| M⁻¹ 补偿 | 用逆投影矩阵预变形形状, 使地面观察者看到正确朝向 |
| 禁用角度搜索 | 匹配期 angle=0 固定, 防止匹配器抵消 M⁻¹ 补偿 |
| 反向最近邻 | 每颗卫星找最近的形状点, 距离 ≤ 阈值则点亮 |
| 匈牙利算法 | 二分图最小权匹配, 保证形状点到卫星的一一对应 |

# 巨型星座 3D 可视化系统 - 零基础入门指南

本文档面向没有任何背景知识的开发者，帮助您快速理解并掌握本项目的开发。

---

## 目录

1. [项目是什么](#1-项目是什么)
2. [核心概念解释](#2-核心概念解释)
3. [环境搭建](#3-环境搭建)
4. [系统架构详解](#4-系统架构详解)
5. [代码结构说明](#5-代码结构说明)
6. [核心功能详解](#6-核心功能详解)
7. [常见任务操作指南](#7-常见任务操作指南)
8. [故障排除](#8-故障排除)

---

## 1. 项目是什么

### 1.1 一句话概括

这是一个**卫星编队灯光秀控制系统**，可以：
- 在电脑上3D显示卫星编队
- 控制每颗卫星的灯光亮灭
- 将图片转换为卫星灯光图案
- 生成不同形状的卫星编队

### 1.2 实际应用场景

想象一下：
- 100颗卫星在太空中排成一个圆形
- 地面的人抬头看，能看到卫星组成的图案
- 这个系统就是用来设计图案、控制灯光的

### 1.3 技术栈速览

| 层级 | 技术 | 作用 |
|------|------|------|
| 前端 | HTML + JavaScript + Three.js | 网页界面 + 3D渲染 |
| 后端 | Python + FastAPI | 服务器 + API |
| 数据库 | MySQL | 存储配置和日志 |
| 通信 | WebSocket | 实时数据传输 |

---

## 2. 核心概念解释

### 2.1 轨道根数（Orbital Elements）

描述卫星轨道的6个参数：

| 参数 | 符号 | 含义 | 单位 |
|------|------|------|------|
| 半长轴 | a | 轨道大小 | km |
| 偏心率 | e | 轨道形状（0=圆） | - |
| 轨道倾角 | i | 轨道平面与赤道的夹角 | 度 |
| 升交点赤经 | Ω | 轨道平面在空间中的方向 | 度 |
| 近地点幅角 | ω | 轨道最近点的方向 | 度 |
| 平近点角 | M | 卫星在轨道上的位置 | 度 |

**通俗理解**：
- a：轨道有多大
- e：轨道是圆还是椭圆
- i：轨道歪不歪
- Ω、ω：轨道朝哪个方向
- M：卫星现在在轨道的哪个位置

### 2.2 LVLH坐标系

卫星的"本地坐标系"：

```
        z (法向，垂直轨道平面)
        ↑
        │
        │
        └──────→ y (沿轨方向，卫星飞行方向)
       /
      /
     x (径向，指向地心)
```

**用途**：描述卫星编队的形状时，用这个坐标系更直观。

### 2.3 Hill坐标系

与LVLH类似，用于描述卫星之间的相对位置：
- x：径向（上下）
- y：沿轨（前后）
- z：法向（左右）

### 2.4 ROE（相对轨道根数）

描述从星相对于主星的轨道参数差异：
- ae：沿轨振幅
- zmax：法向振幅
- β：沿轨相位角
- ψ：法向相位角

### 2.5 轨道递推

根据当前轨道参数，计算未来时刻卫星位置的过程。

本系统使用的物理模型：
- J2摄动：地球不是完美球形
- 大气阻力：低轨卫星受大气影响
- 太阳/月球引力：天体引力摄动

---

## 3. 环境搭建

### 3.1 前置要求

```bash
# Python 3.9+
python --version

# Node.js 16+
node --version

# MySQL 8.0+
mysql --version
```

### 3.2 安装步骤

**步骤1：克隆项目**
```bash
git clone <仓库地址>
cd "StarTM"
```

**步骤2：安装Python依赖**
```bash
pip install -r requirements.txt
```

主要依赖包：
- fastapi：Web框架
- uvicorn：ASGI服务器
- sqlmodel：数据库ORM
- numpy：数值计算
- pydantic：数据验证

**步骤3：安装前端依赖（如需要）**
```bash
npm install
```

**步骤4：配置数据库**

创建MySQL数据库：
```sql
CREATE DATABASE `sky dome` CHARACTER SET utf8mb4;
```

创建 `.env` 文件：
```
DATABASE_URL=mysql+aiomysql://root:密码@localhost:3306/sky dome
```

**步骤5：运行数据库迁移**
```bash
alembic upgrade head
```

**步骤6：启动系统**
```bash
python main_fastapi.py
```

访问 `http://localhost:8000` 即可看到界面。

---

## 4. 系统架构详解

### 4.1 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                        用户浏览器                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  3D场景渲染  │  │  灯光控制UI  │  │  图案匹配   │         │
│  │  (Three.js)  │  │  (HTML/JS)  │  │  (Canvas)   │         │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘         │
│         │                 │                 │                 │
│         └─────────────────┼─────────────────┘                 │
│                           │                                   │
│                    WebSocket / HTTP                            │
└───────────────────────────┼───────────────────────────────────┘
                            │
┌───────────────────────────┼───────────────────────────────────┐
│                     Python后端 (FastAPI)                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  轨道递推    │  │  灯光调度    │  │  数据服务   │         │
│  │  (numpy)    │  │  (Scheduler) │  │  (SQLModel) │         │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘         │
│         │                 │                 │                 │
│         └─────────────────┼─────────────────┘                 │
│                           │                                   │
│                      MySQL数据库                               │
└───────────────────────────┼───────────────────────────────────┘
```

### 4.2 数据流

**实时模式（WebSocket）**：
```
浏览器 ──WebSocket──→ 后端计算轨道 ──推送──→ 浏览器渲染
```

**CSV模式**：
```
CSV文件 ──加载──→ 后端读取 ──HTTP──→ 浏览器渲染
```

**灯光控制**：
```
用户点击 ──→ 前端更新状态 ──WebSocket──→ 后端记录
```

### 4.3 核心模块关系

```
main_fastapi.py (入口)
    │
    ├── FastAPI应用 (HTTP + WebSocket)
    │   ├── 路由: /api/csv, /api/config, /ws/{id}
    │   └── 静态文件: web/
    │
    ├── 轨道递推服务
    │   ├── Constellation (星座)
    │   ├── Satellite (卫星)
    │   └── PerturbedOrbitPropagator (推进器)
    │
    └── 数据库
        ├── 配置表
        ├── 卫星表
        └── 灯光计划表
```

---

## 5. 代码结构说明

### 5.1 后端目录

```
server/
├── config/              # 配置管理
│   └── app_config.py   # Pydantic配置类
│
├── core/                # 核心业务逻辑
│   ├── constellation.py # 星座（卫星集合）
│   ├── satellite.py     # 卫星实体
│   └── orbit_elements.py# 轨道根数
│
├── propagators/         # 轨道递推
│   └── perturbed.py     # 摄动轨道推进器
│
├── services/            # 业务服务
│   ├── propagation_service.py # 递推服务
│   ├── light_scheduler.py     # 灯光调度
│   └── csv_service.py         # CSV数据
│
├── fastapi_app/         # FastAPI应用
│   ├── app.py           # 应用工厂
│   ├── routes/          # HTTP路由
│   └── ws/              # WebSocket路由
│
└── db/                  # 数据库
    ├── models.py        # 表模型
    └── repositories/    # 数据访问层
```

### 5.2 前端目录

```
web/
├── index.html           # 主页面
├── app.js               # 应用入口
│
├── core/                # 核心工具
│   ├── ws-utils.js     # WebSocket工具
│   └── logger.js       # 日志工具
│
├── managers/            # 管理器
│   ├── playback-manager.js  # 播放控制
│   └── input-manager.js     # 输入处理
│
├── modules/             # 功能模块
│   ├── views/          # 视图渲染
│   │   ├── first-person.js   # 地面视角
│   │   ├── third-person.js   # 太空视角
│   │   └── center-person.js  # 主星视角
│   │
│   ├── ui/             # UI组件
│   │   ├── constellation-panel.js  # 星座面板
│   │   └── light-timeline.js       # 灯光时间线
│   │
│   ├── image-processor.js  # 图像处理（图案匹配）
│   ├── math-utils.js       # 数学工具
│   └── light-manager.js    # 灯光管理
│
└── style.css            # 样式
```

### 5.3 编队生成目录

```
gen/
├── gen_orbit.py         # 轨道递推生成器
└── convert_f_to_m.py   # 轨道根数转换

gen_dynamic.py           # 圆形编队生成
gen_hexagonal.py         # 六边形编队生成
gen_rect.py              # 矩形编队生成
```

---

## 6. 核心功能详解

### 6.1 轨道递推

**文件**：`server/propagators/perturbed.py`

**原理**：
```python
# 输入：当前轨道根数 + 时间步长
# 输出：新的轨道根数

def propagate(orbital_elements, dt):
    # 1. 计算J2摄动
    # 2. 计算大气阻力
    # 3. 计算日月引力
    # 4. 更新轨道根数
    return new_orbital_elements
```

**使用方式**：
```python
propagator = PerturbedOrbitPropagator()
new_constellation = propagator.propagate_constellation(
    constellation,  # 当前星座
    dt=1.0,         # 时间步长（秒）
    step=0          # 当前步数
)
```

### 6.2 灯光控制

**手动控制**：
```javascript
// 前端代码
lightManager.setLight(satelliteId, true);  // 开灯
lightManager.setLight(satelliteId, false); // 关灯
```

**自动调度**：
```javascript
// 创建灯光计划
const plan = {
    sat_id: 0,
    trigger_time: 1234567890,  // UTC秒数
    target_state: true,        // 开灯
    duration_seconds: 10       // 持续10秒
};

// 通过API保存到数据库
await fetch('/api/light-schedules', {
    method: 'POST',
    body: JSON.stringify(plan)
});
```

### 6.3 图案匹配

**文件**：`web/modules/image-processor.js`

**算法文档**：`docs/matcher-algorithm.md`（含伪代码、数学证明、完整流程）

#### 整体流程

```
输入图片 → 二值化(Otsu) → 图案类型检测 → 骨架/轮廓/填充采样 → 
M⁻¹ 预变形shape → Hill空间匹配(scale+tx+ty) → 反向最近邻点亮
```

#### 图案类型检测

```javascript
// web/modules/image-processor.js
function detectPatternType(binary, width, height) {
    // 多层判断逻辑
    const skeletonRatio = skeletonPixels / foregroundPixels;
    const contourRatio = contourPixels / foregroundPixels;
    
    if (skeletonRatio > 0.20 && contourRatio > 0.35) return 'line';
    if (contourRatio > 0.50) return 'contour';
    return 'filled';
}
```

#### 核心函数

```javascript
// 1. 检测图案类型
const type = detectPatternType(binary, width, height);
// 返回: 'line' | 'contour' | 'filled'

// 2. 提取形状点（根据类型选择采样策略）
const points = extractShapePoints(file, nPoints);
// 'line': 骨架点FPS, 'contour': 轮廓点FPS, 'filled': 连通域感知采样
// 返回: [{x, y}, ...]

// 3. 计算地面视角投影矩阵 M⁻¹
const matrix = computeHillToGroundMatrix(chiefState, lat, lon, gmst);
// 返回: {a, b, c, d} — 完整 2×2 逆投影矩阵（含剪切）

// 4. 预变形：M⁻¹ × shape_IMG → Hill坐标
const shapeHill = shapeImg.map(p => ({
    x: a * p.x - b * p.y,
    y: c * p.x - d * p.y
}));

// 5. 禁用角度搜索，固定centerAngle=0
const transform = findBestTransform(shapeHill, hillCoords, {
    centerAngle: 0,
    disableAngleSearch: true
});
// 返回: {bestScale, bestTx, bestTy, bestCost}

// 6. 反向最近邻点亮
const lightMap = reverseNearestNeighborLighting(
    transformedShape, alignedSatellites,
    radiusThreshold  // = medianSatDist × 0.65
);
```

#### 搜索参数

| 参数 | 值 | 说明 |
|------|-----|------|
| 缩放范围 | [0.3, 3.0] | 基于卫星间距自适应 |
| 平移网格 | 3×3 | 覆盖卫星包围盒±100% |
| 角度搜索 | 已禁用 | 地面视角补偿时固定θ=0 |
| Top-K候选 | 10 | 粗搜索后取前10 |
| 点亮半径 | 中位间距×0.65 | 动态计算，无需配置 |

### 6.5 地面视角补偿（M⁻¹ 投影矩阵）

**文件**：`web/modules/math-utils.js`（`computeHillToGroundMatrix` 函数）

**问题**：观察者从地面观看编队时，Hill坐标系（沿轨S / 法向W）与观察者视线平面（右/上）之间存在投影偏差，包括缩放、旋转和**剪切**变形。

**解决方案**：完整 2×2 逆投影矩阵 M⁻¹

```
M⁻¹ = [a  b]  其中:
      [c  d]

a = -(W · right_norm)    // W轴在"右"方向的分量
b =  (S · right_norm)    // S轴在"右"方向的分量  
c = -(W · up_norm)       // W轴在"上"方向的分量
d =  (S · up_norm)       // S轴在"上"方向的分量
```

**为什么禁用角度搜索？**

```
dist(rotate(shape, θ), rotate(sats, φ)) 
  = dist(rotate(shape, θ - φ), sats)
```

匹配器会自动找到 θ = θ₀ + φ 来抵消任何预旋转。禁用角度搜索（θ=0）并固定 centerAngle=0 保证图案朝向完全由 M⁻¹ 决定。

**为什么变换 shape 点而非卫星？**

M⁻¹ × shape_SW 将形状点从 LOS 空间映射回 Hill 空间，匹配器在原始 Hill 空间搜索卫星。这样观察到的 shape 始终保持正向，不随编队旋转或视角变化。

### 6.6 自动图案重匹配

**文件**：`web/modules/ui/constellation-panel.js`（`createAutoMatcher` 函数）

**功能**：上传图案后自动周期性重匹配，保持灯光图案跟随编队朝向变化。

**两层级联架构**：

```
tick() → 是否需要全量校准?
  ├─ 是（角度变化 >5°/2° 或 每10s）→ reMatch() → 完整 findBestTransform
  └─ 否 → fastMatch() → 应用缓存变换 → 反向最近邻灯光 (<1ms)
```

- **快速路径**（每 1s tick）：缓存最近一次全量校准的 (scale, tx, ty, radiusThreshold)，直接应用 + 灯光判定，**<1ms**
- **全量校准**（角度超阈值或每 ~10s）：完整 `findBestTransform` 搜索 + 重新计算半径阈值，**~50ms**
- **角度监控**：`getCurrentObsAngle()` 实时计算方位角/仰角（基于当前编队主星 ECI 状态 + 观察者经纬度）

**生命周期**：
- 上传图案 → 自动启动跟踪
- 关闭编队面板 → 跟踪继续（不会停止）
- 重置 → 停止跟踪
- 单击画布状态文字 → 暂停/恢复

**状态指示**：
- `🔄 自动跟踪中` — 正常运行
- `⏸ 已暂停` — 用户暂停
- 无文字 — 未启动或已停止

### 6.4 编队生成

**圆形编队**（gen_dynamic.py）：
```python
# 使用相对轨道根数（ROE）
ROE = [ae, 0, 0, zmax, beta, psi]

# ae: 沿轨振幅
# zmax: 法向振幅
# beta: 沿轨相位
# psi: 法向相位（= beta + π/2）
```

**六边形编队**（gen_hexagonal.py）：
```python
# 使用轴向坐标生成六边形晶格
for q in range(-k, k+1):
    for r in range(-k, k+1):
        s = -q - r
        if max(|q|, |r|, |s|) == k:
            y = spacing * (q + r/2)
            z = spacing * (r * √3/2)
```

---

## 7. 常见任务操作指南

### 7.1 添加新的卫星编队

**步骤1**：创建生成脚本
```python
# gen_my_formation.py
import numpy as np

def generate_my_formation():
    # 定义主星轨道
    center_oe = [6878.132, 0, 30, 0, 0, 0]
    
    # 定义从星相对位置
    deputies = []
    for i in range(10):
        # 计算轨道根数偏差
        dOE = calculate_doe(center_oe, i)
        deputies.append(center_oe + dOE)
    
    return center_oe, deputies
```

**步骤2**：保存到Input目录
```python
save_formation(center, deputy, "my_formation")
```

**步骤3**：在配置中使用
编辑 `config/default.yaml`：
```yaml
input:
  centerOE_path: "Input/my_formation_centerOEmat.txt"
  deputyOE_path: "Input/my_formation_deputyOEmat.txt"
```

### 7.2 修改图案匹配算法

**场景**：让Nike标志更容易被识别

**步骤1**：找到检测函数
```javascript
// web/modules/image-processor.js
function detectPatternType(binary, width, height) {
    // 当前逻辑
    if (fillRatio > 0.20 && contourRatio > 0.35) {
        return 'line';
    } else if (contourRatio > 0.50) {
        return 'contour';
    } else {
        return 'filled';
    }
}
```

**步骤2**：调整阈值
```javascript
// 修改阈值，让更多图案被识别为轮廓型
if (contourRatio > 0.30) {  // 从0.50改为0.30
    return 'contour';
}
```

### 7.3 添加新的灯光效果

**步骤1**：在前端添加效果函数
```javascript
// web/modules/light-effects.js
export function blinkEffect(satelliteId, duration) {
    // 闪烁效果实现
}
```

**步骤2**：在播放循环中调用
```javascript
// web/managers/playback-manager.js
if (shouldBlink) {
    blinkEffect(satId, 1000);
}
```

### 7.4 修改轨道递推参数

**文件**：`config.py`
```python
# 修改J2摄动常数
J2 = 1.08263e-3  # 地球扁率系数

# 修改大气密度模型参数
def atmosphere(altitude):
    # 根据高度计算大气密度
    pass
```

### 7.5 使用自动图案跟踪

**场景**：上传一个图案后，希望灯光自动跟随编队旋转保持图案正向

**步骤1**：进入编队面板
- 点击界面上的"编队"按钮打开编队面板
- 选择 CSV 或 WebSocket 模式

**步骤2**：上传图案
- 在编队面板底部点击"上传图片"
- 选择带有清晰图案的图片（白底黑图或黑底白图）

**步骤3**：观察自动跟踪
- 匹配成功后，画布上显示 `🔄 自动跟踪中` 状态
- 推进时间 → 编队旋转 → 灯光自动更新
- 控制台可见 `[AUTO] 校准完成`（大约每10s）和 `[AUTO] 快速路径` 日志

**步骤4**：控制跟踪
- **单击状态文字**：暂停/恢复自动跟踪
- **关闭编队面板**：跟踪继续（不会停止）
- **重置**：停止跟踪

---

## 8. 故障排除

### 8.1 启动失败

**问题**：`ModuleNotFoundError: No module named 'xxx'`

**解决**：
```bash
pip install -r requirements.txt
```

### 8.2 数据库连接失败

**问题**：`Can't connect to MySQL server`

**解决**：
1. 检查MySQL服务是否启动
2. 检查 `.env` 文件中的数据库URL
3. 确认数据库 `sky dome` 已创建

### 8.3 WebSocket连接失败

**问题**：浏览器控制台显示连接错误

**解决**：
1. 确认后端已启动
2. 检查端口8000是否被占用
3. 查看后端日志是否有错误

### 8.4 3D场景不显示

**问题**：页面打开但看不到卫星

**解决**：
1. 按F12打开开发者工具
2. 查看Console是否有错误
3. 检查是否选择了正确的视角
4. 确认CSV文件或WebSocket数据正常

### 8.5 图案匹配效果差

**问题**：上传图片后卫星分布不理想

**解决**：
1. 检查图案类型识别：打开控制台查看 `[PROCESS] 图案类型: line/contour/filled`，确认分类正确
2. 调整点亮半径阈值：默认 `medianSatDist × 0.65`，可在 `image-processor.js:1192` 调整系数
3. 检查图片质量：白底黑图或黑底白图，线条清晰，分辨率适中（256×256 缩放处理）
4. 确认采样点数足够：控制台查看 `[PROCESS] 形状点数: N`，N 应至少为卫星数的 1/3

### 8.6 自动跟踪不工作

**问题**：上传图案后灯光不随编队旋转更新

**解决**：
1. 确认画布上有 `🔄 自动跟踪中` 状态文字
2. 检查控制台是否有 `[AUTO]` 开头日志
3. 点击状态文字可暂停/恢复（`⏸ 已暂停` 表示暂停状态）
4. 确认处于 CSV 或 WebSocket 模式下且已推进时间
5. 关闭编队面板不会停止跟踪（这是设计行为）

### 8.7 地面视角下图案倾斜

**问题**：切换地面视角后图案变形或倾斜

**解决**：
1. 确认 `constellation-panel.js` 中匹配器使用 Hill 坐标 `{x: sat.s, y: sat.w}` 而非屏幕坐标
2. 确认 `processImage` 传递原始 shape 点（M⁻¹ 变换前），面板函数内做 M⁻¹ 变换
3. 控制台查看 `computeHillToGroundMatrix` 输出的矩阵系数
4. 确认 `disableAngleSearch: true` 且 `centerAngle: 0`

---

## 附录

### A. 关键API端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/csv/data` | GET | 获取CSV数据 |
| `/api/config` | GET/PUT | 获取/更新配置 |
| `/api/light-schedules` | GET/POST | 灯光计划管理 |
| `/ws/{client_id}` | WebSocket | 实时数据 |

### B. 配置文件说明

**config/default.yaml**：
```yaml
server:
  http_port: 8000        # HTTP端口
  
propagation:
  buffer_capacity: 3600  # 缓冲区容量（秒）
  
csv:
  default_path: "Output/test_1.csv"  # 默认CSV路径
```

### C. 常用命令

```bash
# 启动系统
python main_fastapi.py

# 运行测试
pytest

# 数据库迁移
alembic upgrade head

# 生成编队
python gen_dynamic.py
python gen_hexagonal.py

# 轨道递推生成
python gen/gen_orbit.py
```

### D. 学习资源

- **Three.js文档**：https://threejs.org/docs/
- **FastAPI文档**：https://fastapi.tiangolo.com/
- **轨道力学基础**：搜索"卫星轨道力学入门"
- **SQLModel文档**：https://sqlmodel.tiangolo.com/

---

**最后更新**：2026-06-18  
**维护者**：项目开发团队

# 巨型星座 3D 可视化系统

基于卫星编队的太空显示系统，支持灯光控制、图案匹配、编队生成等功能。

## 功能特性

### 核心功能
- **灯光调度系统**：前端自主执行、手动覆盖、时间线UI
- **编队显示**：Hill坐标系显示、全屏支持、自适应缩放
- **图案匹配**：连通域感知采样、骨架/轮廓/填充分类、匈牙利算法、分层搜索
- **地面视角补偿**：完整 2×2 Hill→LOS 投影矩阵（含剪切），图案在观察者眼中保持正向
- **自动图案重匹配**：基于角度变化阈值触发的周期性重匹配，两层级联优化（快速路径<1ms + 全量校准）
- **编队生成**：圆形编队（ROE方法）、矩形编队（Hill坐标）、正六边形晶格编队

### 图案匹配算法
- **图像处理**：Otsu二值化、距离变换、骨架提取、轮廓提取
- **图案分类**：线条型（骨架比例>0.20且轮廓比例>0.35）、轮廓型（轮廓比例>0.50）、填充型自适应识别
- **特征提取**：最远点采样（FPS）、连通域感知采样
- **最优匹配**：匈牙利算法（最小权匹配）、粗搜索网格（3×3平移 × 5缩放 × 1角度）+ Top-K候选精细搜索
- **地面视角补偿**：禁用角度搜索（disableAngleSearch: true），固定 centerAngle=0，预变形 shape 点而非旋转卫星
- **反向最近邻点亮**：距离阈值 = 卫星中位间距 × 0.65

### 自动跟踪（两层级联）
- **快速路径**（每1s tick）：应用缓存变换 + 反向最近邻灯光判定，无搜索，<1ms
- **全量校准**（角度超阈值 5°/2° 或每10s）：完整 findBestTransform 搜索，~50ms
- **生命周期**：上传图案自动启动 → 关闭面板不停止 → 重置停止 → 单击状态文字暂停/恢复

### 编队生成方法
- **gen_dynamic.py**：动态层级卫星编队生成器（圆形编队）
- **gen_hexagonal.py**：正六边形晶格卫星编队生成器
- **gen_rect.py**：矩形编队生成器

## 技术架构

### 后端
- **框架**：FastAPI + WebSocket
- **轨道递推**：PerturbedOrbitPropagator（J2 + 大气阻力 + 太阳引力 + 月球引力）
- **数据库**：MySQL + SQLModel
- **灯光控制**：计划调度、手动覆盖、时间同步

### 前端
- **3D渲染**：Three.js
- **图案匹配**：图像处理 + 匈牙利算法 + 完整投影矩阵补偿
- **UI组件**：编队控制面板（含自动跟踪状态）、时间线、灯光控制

## 快速开始

### 安装依赖
```bash
pip install -r requirements.txt
npm install
```

### 启动系统
```bash
python main_fastapi.py
```

### 生成编队
```bash
# 生成圆形编队
python gen_dynamic.py

# 生成正六边形晶格编队
python gen_hexagonal.py

# 生成矩形编队
python gen_rect.py
```

## 文件结构

```
├── config/                    # 配置文件
├── gen/                       # 轨道生成脚本
├── Input/                     # 输入文件（轨道根数）
├── Output/                    # 输出文件（CSV数据）
├── server/                    # 后端服务
│   ├── core/                 # 核心模块
│   ├── services/             # 业务服务
│   └── propagators/          # 轨道推进器
├── web/                       # 前端代码
│   ├── modules/
│   │   ├── image-processor.js # 图像处理 + 图案匹配核心算法
│   │   ├── math-utils.js     # 数学工具（含 Hill→LOS 投影矩阵）
│   │   ├── ui/
│   │   │   └── constellation-panel.js # 编队面板 + 自动跟踪器
│   │   └── light-manager.js  # 灯光管理器
│   ├── managers/             # 播放控制、输入处理
│   └── views/                # 3D视角（地面/太空/主星）
├── docs/
│   └── matcher-algorithm.md  # 完整算法文档（伪代码 + 数学证明）
└── gen_dynamic.py / gen_hexagonal.py / gen_rect.py
```

## 开发指南

### 地面视角补偿（关键设计决策）

图案在卫星编队上的朝向由以下设计保证：

1. **完整 2×2 投影矩阵 M⁻¹**：`computeHillToGroundMatrix()` 返回包含 S 轴和 W 轴的完整逆投影矩阵（含剪切），而非单轴旋转角度 φ_S
2. **M⁻¹ 变换 Shape 点**：`shape_HILL = M⁻¹ × shape_SW`，卫星位置保持在原始 Hill 空间不变
3. **禁用角度搜索**：匹配器 `dist(rotate(shape,θ), rotate(sats,φ))` 必然找到 θ=θ₀+φ，完全抵消任何预旋转；设置 `disableAngleSearch: true` 只评估 θ=0
4. **固定 centerAngle=0**：角度搜索禁用后，centerAngle 决定观察者看到的形状朝向，必须固定为 0
5. **匹配器使用 Hill 坐标 (S, W)** 而非屏幕坐标（避免 Y 轴翻转不匹配）
6. **图像 Y 轴取反**：Canvas y-向下 ↔ LOS up-向上

### 添加新的编队类型
1. 在根目录创建新的生成脚本
2. 实现 `generate_formation()` 函数
3. 保存到 `Input/` 目录

### 修改图案匹配算法
1. 编辑 `web/modules/image-processor.js`
2. 调整 `detectPatternType()` 函数
3. 修改 `extractShapePoints()` 采样策略
4. 调整 `findBestTransform()` 搜索参数

## 关键设计文档

- `docs/matcher-algorithm.md`：完整图案匹配算法（含坐标系定义、矩阵推导、伪代码、数学证明）

## 许可证

MIT License

# 巨型星座 3D 可视化系统

基于卫星编队的太空显示系统，支持灯光控制、图案匹配、编队生成等功能。

## 功能特性

### 核心功能
- **灯光调度系统**：前端自主执行、手动覆盖、时间线UI
- **编队显示**：Hill坐标系显示、全屏支持、自适应缩放
- **图案匹配**：连通域感知采样、骨架提取、匈牙利算法、分层搜索
- **编队生成**：圆形编队（ROE方法）、矩形编队（Hill坐标）、正六边形晶格编队

### 图案匹配算法
- **图像处理**：Otsu二值化、距离变换、骨架提取、轮廓提取
- **图案分类**：线条型、轮廓型、填充型自适应识别
- **特征提取**：最远点采样（FPS）、连通域感知采样
- **最优匹配**：匈牙利算法（最小权匹配）、分层搜索策略

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
- **图案匹配**：图像处理 + 匈牙利算法
- **UI组件**：编队控制面板、时间线、灯光控制

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
│   ├── gen_orbit.py          # 轨道递推生成器
│   └── convert_f_to_m.py    # 轨道根数转换
├── Input/                     # 输入文件（轨道根数）
├── Output/                    # 输出文件（CSV数据）
├── server/                    # 后端服务
│   ├── core/                 # 核心模块
│   ├── services/             # 业务服务
│   └── propagators/          # 轨道推进器
├── web/                       # 前端代码
│   ├── modules/              # 功能模块
│   │   ├── image-processor.js # 图像处理
│   │   └── math-utils.js     # 数学工具
│   └── managers/             # 管理器
└── docs/                      # 文档
```

## 配置说明

### 主星轨道参数
- 半长轴：6878.132 km
- 偏心率：0
- 轨道倾角：30°

### 编队参数
- 相邻卫星间距：1000 m
- 点亮半径系数：1.0
- 最大采样点数：100

## 开发指南

### 添加新的编队类型
1. 在 `gen/` 目录创建新的生成脚本
2. 实现 `generate_formation()` 函数
3. 保存到 `Input/` 目录

### 修改图案匹配算法
1. 编辑 `web/modules/image-processor.js`
2. 调整 `detectPatternType()` 函数
3. 修改 `extractShapePoints()` 采样策略

## 许可证

MIT License

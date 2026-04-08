# 卫星编队可视化项目 - 重构与开发总结

> 生成日期：2026年4月8日
> 项目路径：`e:\project_code\serproject\202412 画巨型星座\`

---

## 📁 一、项目结构

### 1.1 整体目录结构
```
202412 画巨型星座/
├── start.py                      # 项目启动脚本（同时启动 HTTP 和 WS 服务器）
├── server.py                     # HTTP 服务器（端口 8000）
├── server_ws.py                  # WebSocket 服务器（端口 8765）
├── propagate_stream.py           # 流式轨道递推引擎（JIT 加速，环形缓冲区）
├── config.py                     # Python 配置参数
├── perturbedOrbit.py             # 摄动轨道计算
├── M_To_ff.py / f_To_MM.py       # 轨道根数转换工具
├── orbitElementsToInertiastate.py# 轨道根数转惯性系状态
├── Input/                        # 初始轨道根数输入
│   ├── centerOEmat.txt           # 主星轨道根数
│   └── deputyOEmat.txt           # 伴随卫星轨道根数
└── web/                          # 前端可视化项目
    ├── index.html                # 主页面
    ├── style.css                 # UI 样式
    ├── app.js                    # 主入口（约 1272 行）
    └── modules/                  # 模块化代码
        ├── config.js             # 常量、共享资源、纹理 URL
        ├── math-utils.js         # 数学/坐标工具函数
        ├── state.js              # 全局状态管理
        ├── view-switcher.js      # 视角切换接口（占位符）
        ├── playback-controller.js# 统一播放控制器
        ├── earth-rotation.js     # 地球自转系统
        ├── views/
        │   ├── index.js          # 视角模块统一导出
        │   ├── third-person.js   # 第三视角（地球全局）
        │   ├── first-person.js   # 第一视角（地面站观测）
        │   └── center-person.js  # 主星视角（跟随编队主星）
        └── ui/
            ├── index.js          # UI 模块统一导出
            ├── tooltip-system.js # Tooltip 悬浮提示
            ├── stats-panel.js    # 统计面板
            ├── time-controls.js  # 时间控制
            └── location-controls.js # 位置输入控制
```

### 1.2 数据流
```
Input (centerOEmat.txt, deputyOEmat.txt)
    ↓
propagate_stream.py (流式轨道递推，JIT 加速)
    ↓ WebSocket (ws://localhost:8765)
server_ws.py (数据推送，每 10 秒推送 10 步计算结果)
    ↓ JSON 数据流
web/app.js (Three.js 3D 渲染)
    ↓
浏览器 (http://localhost:8000/web/index.html)
```

---

## 🔧 二、已完成的重构工作

### 2.1 代码清理（预处理）
| 操作 | 内容 | 减少行数 |
|------|------|---------|
| 删除未使用的 VVLH 坐标系函数 | `eciToVVLH`, `eciToVVLH_omg`, `eciToVVLH_stable` | ~64 行 |
| 删除未使用的常量/函数 | `INTERP_FPS`, `animateTransition`, `CENTER_PERSON_CAMERA_TARGET`, `updateSatellitesFromWs` | ~19 行 |

### 2.2 第一阶段：核心模块提取
| 模块文件 | 提取内容 | 状态 |
|----------|---------|------|
| `modules/config.js` | 物理常量、共享几何体/材质、相机位置常量 | ✅ 完成 |
| `modules/math-utils.js` | 坐标转换、天文计算、时间解析、向量运算 | ✅ 完成 |
| `modules/state.js` | 全局状态管理（场景对象、CSV/WS 状态、交互状态、缓存） | ✅ 完成 |

### 2.3 第二阶段：视角模块提取
| 模块文件 | 提取内容 | 状态 |
|----------|---------|------|
| `modules/views/third-person.js` | 第三视角场景初始化、轨道环生成、卫星更新 | ✅ 完成 |
| `modules/views/first-person.js` | 第一视角场景初始化、鼠标拖拽相机、卫星可见性计算 | ✅ 完成 |
| `modules/views/center-person.js` | 主星视角场景初始化、相机跟随逻辑、相对位置计算 | ✅ 完成 |
| `modules/view-switcher.js` | 视角切换器接口（占位符） | ✅ 完成 |

### 2.4 第三阶段：数据模式模块提取
| 模块文件 | 提取内容 | 状态 |
|----------|---------|------|
| `modules/modes/csv-mode.js` | CSV 数据加载、播放控制、更新逻辑 | ✅ 完成 |
| `modules/modes/ws-mode.js` | WebSocket 连接管理、实时播放、状态同步 | ✅ 完成 |
| `modules/playback-controller.js` | 统一播放/停止/模式切换控制器 | ✅ 完成 |

### 2.5 第四阶段：UI 与辅助模块提取
| 模块文件 | 提取内容 | 状态 |
|----------|---------|------|
| `modules/ui/tooltip-system.js` | Tooltip 初始化、射线检测、数据展示 | ✅ 完成 |
| `modules/ui/stats-panel.js` | 可见性窗口计算、统计信息展示 | ✅ 完成 |
| `modules/ui/time-controls.js` | 时间滑块、播放/停止、速度选择器 | ✅ 完成 |
| `modules/ui/location-controls.js` | 地面站经纬度设置 | ✅ 完成 |
| `modules/earth-rotation.js` | 地球自转连续插值、地面站跟随 | ✅ 完成 |

### 2.6 第五阶段：代码瘦身与修复
| 操作 | 内容 |
|------|------|
| 消除同步补丁 | 移除 `animate` 循环中的手动状态同步代码 |
| 清理无用变量 | 删除 `tooltip`, `raycaster`, `mouse`, `lastTooltipKey`, `visibilityCache` 等已迁移的变量 |
| 修复引用断裂 | 修复 `loadCSV`, `startCsvPlayback` 中使用 `appState.csv.satelliteData` 而非过期局部变量 |

### 2.7 第六阶段：视角切换与渲染优化
| 修复项 | 内容 | 状态 |
|--------|------|------|
| 极点跳转 | 在 `animateTransitionFrom` 中禁用 OrbitControls，防止动画过程中控制器干扰相机 | ✅ 完成 |
| 光照异常 | 切换视角时自动调整太阳位置（主星视角 10000，其他 100） | ✅ 完成 |
| UI 高亮卡住 | 使用 `className = 'active' : ''` 强制重置按钮状态 | ✅ 完成 |
| 主星黄点闪烁 | `startInterpolation` 使用 `currentInterpData` 作为下一帧起点，保证视觉连续性 | ✅ 完成 |
| 蓝屏保护 | WS 切回 CSV 模式时检查数据有效性，无数据时自动切回第三视角 | ✅ 完成 |
| 矩阵更新延迟 | `centerSatMarker` 更新位置后调用 `updateMatrix()` 和 `updateWorldMatrix()` | ✅ 完成 |

---

## ⚠️ 三、当前已知问题（未完全解决）

### 3.1 视角切换问题
| 问题描述 | 表现 | 优先级 |
|----------|------|--------|
| **CSV 第一视角卡顿** | 从其他视角切回第一视角后，需要拖动鼠标才能看到内容，初始卡在 (0,0,0) | 高 |
| **CSV 主星视角未渲染** | 切换到主星视角后显示蓝色背景，需要点击播放才能看到内容 | 高 |

### 3.2 主星视角跟随问题
| 问题描述 | 可能原因 |
|----------|---------|
| 相机未紧密跟随主星运动 | `updateCenterPersonCamera` 中读取 `centerSatMarker` 世界坐标时可能存在一帧延迟 |

### 3.3 代码长度问题
| 当前状态 | 目标 |
|----------|------|
| `app.js` 约 **1272 行** | 目标精简至 400 行以内（作为纯入口文件） |

---

## 🛠️ 四、修复技巧与经验总结

### 4.1 状态同步
- **问题根源**：在模块化重构时，`app.js` 中保留的局部变量（如 `satelliteData`, `timeIndices`）与 `appState` 中的状态不同步，导致模块读到过期数据。
- **修复方案**：所有数据访问统一改为 `appState.csv.satelliteData` 等形式。

### 4.2 渲染循环竞争
- **问题根源**：`startCsvPlayback` 的 `setInterval` 调用 `updateCurrentView()` 更新卫星位置，同时 `startInterpolation` 的 `requestAnimationFrame` 也在更新卫星位置。两者同时执行导致闪烁。
- **修复方案**：在播放循环中删除 `updateCurrentView()` 调用，让插值动画全权负责渲染。

### 4.3 视角切换相机控制
- **问题根源**：`OrbitControls` 在相机大幅移动时会计算球形坐标，如果起点在原点，会吸附到极点。
- **修复方案**：在 `animateTransitionFrom` 动画期间强制禁用控制器，结束后恢复。

### 4.4 主星视角蓝屏保护
- **问题根源**：切换到 CSV 模式时，如果 `satelliteData` 为空，主星标记在原点，相机进入地球内部（半径 6378 的球体）。
- **修复方案**：切换时检查数据有效性，无数据时自动切换到第三视角。

---

## 🚀 五、后续开发建议

### 5.1 优先级 P0（必须修复）
1. **修复 CSV 第一视角卡顿**
   - 在 `switchView` 切换到第一视角时，确保调用 `updateCurrentView()` 立即渲染
   - 检查 `initFirstPersonSceneMod` 是否正确初始化了场景对象
   - 建议：跳过过渡动画，直接设置相机位置

2. **修复 CSV 主星视角未渲染**
   - 在 `switchView` 切换到主星视角时，确保调用 `updateCurrentView()` 立即渲染
   - 检查 `initCenterPersonSceneMod` 是否正确创建了地球和主星标记

### 5.2 优先级 P1（优化体验）
3. **优化主星视角跟随**
   - 尝试使用 `Matrix4` 直接计算主星标记的世界坐标，避免一帧延迟
   - 考虑在主星标记更新后立即调用 `scene.updateMatrixWorld(true)`

4. **精简 `app.js` 行数**
   - 提取播放逻辑到 `playback-controller.js`
   - 提取事件绑定到单独的初始化模块
   - 目标：`app.js` 只保留 `init()`, `animate()`, `switchView()` 和全局状态声明

### 5.3 优先级 P2（功能增强）
5. **添加加载状态指示器**
   - 显示纹理加载进度
   - 显示 WebSocket 连接状态

6. **添加错误边界处理**
   - 捕获 Three.js 渲染错误
   - 处理 CSV 解析失败的优雅降级

---

## 📝 六、开启新会话的提示词

> "我正在开发一个卫星编队 3D 可视化项目（Three.js + WebSocket）。项目已完成大部分模块化重构，目前存在以下问题需要修复：
> 
> 1. **CSV 模式下切换第一视角卡顿**：需要鼠标拖动才能看到内容。
> 2. **CSV 模式下切换主星视角未渲染**：显示蓝色背景，需要点击播放。
> 3. **app.js 依然有 1272 行**，希望进一步精简。
> 
> 项目结构在 `e:\project_code\serproject\202412 画巨型星座\web\`，模块代码在 `modules/` 子目录下。
> 
> 请参考 `PROJECT_SUMMARY.md` 中的详细总结进行修复。"

---

## 📊 七、代码统计

| 文件/模块 | 行数 | 状态 |
|-----------|------|------|
| `web/app.js` | ~1272 | 主入口（待精简） |
| `modules/config.js` | ~50 | ✅ 完成 |
| `modules/math-utils.js` | ~100 | ✅ 完成 |
| `modules/state.js` | ~100 | ✅ 完成 |
| `modules/views/*.js` | ~570 | ✅ 完成 |
| `modules/ui/*.js` | ~370 | ✅ 完成 |
| `modules/modes/*.js` | ~430 | ✅ 完成 |
| **其他模块** | ~300 | ✅ 完成 |
| **总计提取代码** | **~1920 行** | |

---

*文档结束。祝下一个会话开发顺利！*

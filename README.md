# 巨型星座 3D 可视化系统

## 项目概述

本项目是一个基于 Web 的巨型星座（卫星编队）3D 可视化系统，支持 CSV 历史数据回放和 WebSocket 实时数据流两种模式。采用模块化架构，支持多客户端并发连接，每个客户端拥有独立的计算会话。

## 系统架构

### 后端架构（Python）

```
server/
├── api/                    # API 接口层
│   ├── csv_api.py         # CSV 数据 API
│   └── ws_handler.py      # WebSocket 处理器
├── config/                 # 配置管理
│   ├── app_config.py      # 应用主配置
│   └── constellation_setup.py  # 星座配置
├── core/                   # 核心领域模型
│   ├── constellation.py     # 星座实体
│   ├── satellite.py       # 卫星实体
│   ├── frame_data.py      # 帧数据
│   ├── propagation_state.py  # 传播状态机
│   └── exceptions.py      # 自定义异常
├── infrastructure/         # 基础设施
│   └── buffer.py          # 环形缓冲区
├── propagators/            # 轨道递推引擎
│   ├── base.py           # 推进器基类
│   └── perturbed.py      # 摄动轨道推进器（JIT加速）
└── services/             # 业务服务层
    ├── ws_service.py      # WebSocket 服务（多客户端）
    ├── client_session.py  # 客户端会话管理
    ├── propagation_service.py  # 递推服务
    └── csv_service.py     # CSV 数据服务
```

### 前端架构（JavaScript）

```
web/
├── app.js                 # 应用主入口
├── index.html            # 主页面
├── core/                 # 核心工具
│   ├── logger.js        # 日志工具
│   └── ws-utils.js      # WebSocket 工具
├── managers/             # 管理器
│   ├── playback-manager.js   # 播放控制
│   ├── input-manager.js      # 输入处理
│   └── mode-manager.js       # 模式切换
├── modules/              # 功能模块
│   ├── views/           # 视图渲染
│   │   ├── first-person.js   # 第一人称（地面视角）
│   │   ├── third-person.js  # 第三人称（太空视角）
│   │   └── center-person.js # 主星视角
│   ├── ui/              # UI 组件
│   │   ├── location-controls.js  # 位置控制
│   │   ├── constellation-panel.js # 星座面板
│   │   └── stats-panel.js       # 统计面板
│   ├── config.js        # 前端配置
│   ├── state.js         # 全局状态
│   ├── math-utils.js    # 数学工具
│   ├── interpolation.js # 插值算法
│   └── moon-orbit.js    # 月球轨道
└── style.css            # 样式文件
```

## 启动方式

### 方式1：完整启动（推荐）

```bash
python main.py
```

启动所有服务：
- HTTP 服务器（端口 8000）：提供静态资源和 CSV API
- WebSocket 服务器（端口 8765）：实时轨道递推
- 自动打开浏览器访问 `http://localhost:8000/web/index.html`

### 方式2：仅 WebSocket 服务

```bash
python server_main.py
```

仅启动 WebSocket 服务，适用于多客户端测试：
- 支持最多 10 个并发客户端
- 每个客户端拥有独立的计算会话
- 独立的 PropagationService 实例

## 使用指南

### 基本操作

1. **切换数据源模式**
   - CSV 模式：回放历史轨道数据
   - WS 模式：接收实时计算数据

2. **切换视角**
   - 第三人称：太空视角，查看整个星座
   - 第一人称：地面站视角，查看卫星过境
   - 主星视角：跟随主星运动

3. **控制播放**
   - 播放/暂停：控制数据流
   - 速度调节：1x、2x、5x、10x 倍速
   - 进度条：拖动跳转

4. **交互操作**
   - 鼠标拖拽：旋转视角（第三人称）或改变朝向（第一人称）
   - 滚轮缩放：调整视距
   - 左键点击：选中卫星查看详情

### 第一人称（地面视角）特有功能

1. **设置地面站位置**
   - 在左侧面板输入纬度和经度
   - 或使用"使用当前位置"自动获取

2. **查看方位角和仰角**
   - 右下角显示当前视角的方位角（Azimuth）和仰角（Elevation）
   - 显示可见卫星数量和当前时间

3. **控制卫星灯光**
   - 在星座面板中点击卫星行，切换灯光开关
   - 灯光状态会同步到 3D 场景

## 关键文件说明

### 后端核心文件

| 文件 | 作用 | 关键类/函数 |
|------|------|------------|
| `main.py` | 统一启动入口 | `Application` 类 |
| `server_main.py` | WebSocket 独立启动 | `create_propagation_service()` |
| `server/services/ws_service.py` | WebSocket 服务 | `WsService` - 多客户端管理 |
| `server/services/client_session.py` | 客户端会话 | `ClientSession` - 独立计算会话 |
| `server/services/propagation_service.py` | 递推服务 | `PropagationService` - 轨道计算 |
| `server/propagators/perturbed.py` | 轨道递推引擎 | `PerturbedOrbitPropagator` - JIT加速 |
| `server/core/constellation.py` | 星座实体 | `Constellation` - 22颗卫星管理 |
| `server/infrastructure/buffer.py` | 环形缓冲区 | `RingBuffer` - 数据缓冲 |

### 前端核心文件

| 文件 | 作用 | 关键函数 |
|------|------|---------|
| `web/app.js` | 应用主入口 | `initApp()`, `switchView()` |
| `web/managers/playback-manager.js` | 播放控制 | `runWsPlayback()`, `runCsvPlayback()` |
| `web/managers/input-manager.js` | 输入处理 | `initFirstPersonControls()`, `initCenterPersonMouse()` |
| `web/modules/state.js` | 全局状态 | `appState` 对象 |
| `web/modules/interpolation.js` | 插值算法 | `interpolateSatellites()` |
| `web/modules/views/first-person.js` | 地面视角渲染 | `updateSatellitesFirstPerson()`, `updateFirstPersonCamera()` |
| `web/modules/math-utils.js` | 坐标转换 | `ecefToLocal()`, `eciToEcef()` |

## 多客户端支持

### 架构特点

1. **独立计算会话**
   - 每个 WebSocket 客户端拥有独立的 `PropagationService`
   - 独立的 `Constellation` 对象
   - 独立的计算状态和缓冲区

2. **资源隔离**
   - 客户端A的 step 计数不影响客户端B
   - 客户端断开时自动清理资源

3. **并发限制**
   - 最大支持 10 个并发客户端
   - 超出限制时新连接被拒绝

### 实现机制

```python
# server/services/ws_service.py
class WsService:
    MAX_CLIENTS = 10
    
    async def _handle_client(self, websocket, path):
        # 为每个客户端创建独立会话
        session = ClientSession(
            client_id=client_id,
            websocket=websocket,
            propagation_service_factory=self._service_factory,
        )
        # ...

# server/services/client_session.py
class ClientSession:
    def __init__(self, ...):
        # 每个会话独立的服务实例
        self.service = propagation_service_factory()
```

## 后台行为

### 后台暂停机制

1. **延迟暂停**：页面进入后台 10 秒后自动发送 `pause` 命令
2. **立即恢复**：页面回到前台立即发送 `resume` 命令
3. **连接保持**：后台期间保持 WebSocket 连接，不断开

### 实现代码

```javascript
// web/managers/playback-manager.js
let backgroundPauseTimer = null;
const BACKGROUND_PAUSE_DELAY = 10000; // 10秒

document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        backgroundPauseTimer = setTimeout(() => {
            sendWsCmd(wsState.connection, 'pause');
        }, BACKGROUND_PAUSE_DELAY);
    } else {
        if (backgroundPauseTimer) {
            clearTimeout(backgroundPauseTimer);
        }
        sendWsCmd(wsState.connection, 'resume');
    }
});
```

## 轨道递推算法

### 物理模型

采用**摄动轨道模型**，考虑以下因素：
- **J2 摄动**：地球扁率影响
- **大气阻力**：根据高度计算大气密度
- **太阳引力**：太阳对卫星的引力作用
- **月球引力**：月球对卫星的引力作用

### 计算流程

```
1. 读取轨道根数（a, e, i, Ω, ω, f）
2. 真近点角 f → 平近点角 M
3. 计算摄动加速度（J2 + 阻力 + 日月引力）
4. 积分求解新的轨道根数
5. 平近点角 M → 真近点角 f
6. 计算惯性系位置/速度
```

### JIT 加速

使用 numba 的 `@jit` 装饰器编译核心计算函数：
- `M_To_f()` - 平近点角转真近点角
- `f_To_M()` - 真近点角转平近点角
- `_perturbed_orbit_step()` - 单步递推
- `_propagate_constellation_batch()` - 批量递推

首次运行时自动预热（JIT 编译），后续计算速度提升 10-100 倍。

## 坐标系统

### 坐标转换链

```
ECI (地心惯性坐标系)
  ↓ GMST (格林尼治平恒星时)
ECEF (地心地固坐标系)
  ↓ 纬度/经度
Local (本地地平坐标系: 方位角/仰角/距离)
```

### 关键公式

**ECI → ECEF**：
```python
def eciToEcef(X, Y, Z, gmst):
    c = cos(gmst), s = sin(gmst)
    return {
        x: X * c + Y * s,
        y: -X * s + Y * c,
        z: Z
    }
```

**ECEF → Local**：
```python
def ecefToLocal(x, y, z, lat, lon):
    # 计算相对于地面站的方位角、仰角、距离
    # lat/lon: 地面站纬度/经度
    # 返回: {az: 方位角, el: 仰角, range: 距离}
```

## 常见问题

### Q: 为什么后台时 FPS 会下降？

**A**: 这是浏览器的正常行为。后台标签页会被浏览器节流以降低资源消耗。本项目已实现后台 10 秒后自动暂停，回到前台后自动恢复，保证前后端同步。

### Q: 如何添加更多卫星？

**A**: 
1. 修改 `Input/centerOEmat.txt`（主星轨道根数）
2. 修改 `Input/deputyOEmat.txt`（从星轨道根数）
3. 重启服务加载新配置

### Q: WebSocket 连接失败怎么办？

**A**: 
1. 检查端口 8765 是否被占用
2. 确保 `websockets` 包已安装：`pip install websockets`
3. 检查防火墙设置

### Q: 如何调整缓冲区大小？

**A**: 在 `config/config.yaml` 中修改：
```yaml
propagation:
  buffer_capacity: 3600  # 默认缓存 1 小时数据（3600 秒）
```

## 开发规范

### 代码风格

- Python：遵循 PEP 8，使用类型注解
- JavaScript：ES6+ 语法，模块化导入

### 提交规范

```
feat: 新功能
fix: 修复bug
docs: 文档更新
refactor: 重构
test: 测试代码
```

## 技术栈

### 后端
- Python 3.10+
- asyncio（异步IO）
- websockets（WebSocket 服务）
- numba（JIT 编译加速）
- numpy（数值计算）
- pandas（CSV 处理）

### 前端
- Vanilla JavaScript（ES6+）
- Three.js（3D 渲染）
- WebSocket API
- Canvas API（动态纹理）

## 许可证

MIT License

## 联系方式

如有问题或建议，欢迎提交 Issue。

---

**最后更新**: 2026-04-16  
**版本**: v2.0（多客户端架构）

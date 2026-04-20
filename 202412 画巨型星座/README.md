# 巨型星座 3D 可视化系统

## 项目概述

本项目是一个基于 Web 的巨型星座（卫星编队）3D 可视化系统，支持 CSV 历史数据回放和 WebSocket 实时数据流两种模式。采用模块化架构，支持多客户端并发连接，每个客户端拥有独立的计算会话。

新增功能：基于通信协议的卫星编队灯光控制，支持 LDPC 编码传输、CRC 内层校验、协议日志记录。

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
│   ├── constellation.py   # 星座实体（含 apply_light_control 批量灯光控制）
│   ├── satellite.py       # 卫星实体（含 light_state 属性）
│   ├── frame_data.py      # 帧数据
│   ├── propagation_state.py  # 传播状态机
│   └── exceptions.py      # 自定义异常
├── infrastructure/         # 基础设施
│   └── buffer.py          # 环形缓冲区
├── propagators/            # 轨道递推引擎
│   ├── base.py           # 推进器基类
│   └── perturbed.py      # 摄动轨道推进器（JIT加速）
├── protocol/               # 通信协议模块
│   ├── __init__.py        # 模块导出
│   ├── constants.py       # 协议常量枚举（PacketType, MsgType, LightCommand）
│   ├── transfer_frame.py  # 传输帧编解码（TransferFrame, SubMessage）
│   └── ldpc_codec.py      # LDPC编解码器（基于 pyldpc 库，seed=42）
└── services/             # 业务服务层
    ├── ws_service.py      # WebSocket 服务（多客户端）
    ├── client_session.py  # 客户端会话管理（含协议帧处理）
    ├── propagation_service.py  # 递推服务
    ├── csv_service.py     # CSV 数据服务
    ├── protocol_handler.py     # 协议消息处理器（含 build_light_control_frames）
    ├── protocol_logger.py      # 协议日志记录器（含 log_per_satellite_frames）
    ├── verify_service.py        # 互校验服务（Phase 2）
    ├── neighbor_finder.py      # 邻居发现服务（基于轨道根数计算）
    └── light_control.py        # 灯光控制服务
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
│   ├── playback-manager.js   # 播放控制（含 protocol_response 处理）
│   ├── input-manager.js      # 输入处理
│   └── mode-manager.js       # 模式切换
├── modules/              # 功能模块
│   ├── views/           # 视图渲染
│   │   ├── first-person.js   # 第一人称（地面视角）
│   │   ├── third-person.js  # 第三人称（太空视角）
│   │   └── center-person.js # 主星视角
│   ├── ui/              # UI 组件
│   │   ├── location-controls.js    # 位置控制
│   │   ├── constellation-panel.js  # 星座面板（含待发送指令管理）
│   │   ├── protocol-confirm-bar.js # 确认按钮栏（新增）
│   │   └── stats-panel.js          # 统计面板
│   ├── modes/           # 数据模式
│   │   └── ws-mode.js   # WebSocket 模式（含 protocol_response 处理）
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

### 卫星编队灯光控制（新增）

1. **打开编队面板**
   - 点击左侧面板的"编队"按钮，打开卫星编队可视化面板

2. **选择待控制卫星**
   - 点击面板中的卫星圆圈，选中/取消选中
   - 未开灯卫星点击后变为**黄色**（待开灯）
   - 已开灯卫星点击后变为**绿色**（待关灯）
   - 已选中的卫星显示**白色虚线边框**

3. **确认发送**
   - 底部右侧显示已选卫星数量：`[已选: N颗]`
   - 点击**确认发送**按钮，将批量灯光控制指令发送到后端
   - 点击**清空选择**按钮，清除所有待发送指令

4. **状态同步**
   - 后端执行后推送响应，前端自动更新3D场景中的灯光状态
   - 日志保存在 `log/test_yyyymmddhhmmss.log`

### 第一人称（地面视角）特有功能

1. **设置地面站位置**
   - 在左侧面板输入纬度和经度
   - 或使用"使用当前位置"自动获取

2. **查看方位角和仰角**
   - 右下角显示当前视角的方位角（Azimuth）和仰角（Elevation）
   - 显示可见卫星数量和当前时间

## 通信协议

### 传输帧结构（每颗卫星一帧）

```
| Sync(4B) | Version+VCID(1B) | SCID(2B) | Frame_Count(2B) |
| Packet_Type(1B) | Dest_ID(2B) | Packet_ID(2B) | Packet_Length(2B) |
| Payload | CRC(4B) |
```

**关键设计**：
- **每颗卫星独立一帧**：`Dest_ID` 为目标卫星 ID（不使用 0xFFFF 广播）
- **每帧包含 3 条子消息**：
  - SubMsg[0]：自身指令（被点亮时有数据，未点亮时为空）
  - SubMsg[1]：邻星1的指令数据（用于互校验，若邻星未点亮则为空）
  - SubMsg[2]：邻星2的指令数据（同上）
- **邻星帧携带被点亮星数据**：如卫星1的点亮帧中包含卫星0的数据，供卫星1与卫星0互校验

**LDPC 外层封装**：
```
| LDPC_Preamble(2B) | Length(2B) | LDPC Encoded Bits (variable) |
```

### 子消息结构

```
| Msg_ID(2B) | Dest_ID(2B) | Data_Length(2B) | Data(可变) | CRC_msg(4B) |
```

### 灯光控制消息

**Msg_ID**: `0x0101`

**Data 格式**：
```
| Command_Type(1B) | Light_State(1B) |
```

| Command_Type | 含义 |
|-------------|------|
| 0x01 | 开灯 |
| 0x02 | 关灯 |

### 协议日志

每次启动后端服务时自动创建新的日志文件 `log/test_yyyymmddhhmmss.log`，记录：

1. 发送的原始 Base64 数据
2. LDPC 解码后的帧内容（Sync, Version, SCID, Packet_Type 等）
3. CRC 校验结果
4. **按卫星分组的消息队列**（每颗卫星一帧，每帧3条子消息）
5. 执行结果（每颗卫星的灯光状态）

**日志格式示例**：
```
[6] LDPC解码后完整消息队列（按卫星分组）:
  ── 帧 Dest_ID=0x0000 (卫星0) ──
    SubMsg[0]: Msg_ID=0000, Dest_ID=0000, Data=0101  [自身指令]
    SubMsg[1]: Msg_ID=0001, Dest_ID=0002, Data=0101  [邻星验证(卫星2)]
    SubMsg[2]: Msg_ID=0002, Dest_ID=0001, Data=0101  [邻星验证(卫星1)]
  ── 帧 Dest_ID=0x0001 (卫星1) ──
    SubMsg[0]: Msg_ID=0000, Dest_ID=0001, Data=0101  [自身指令]
    SubMsg[1]: Msg_ID=0001, Dest_ID=0000, Data=0101  [邻星验证(卫星0)]
    SubMsg[2]: Msg_ID=0002, Dest_ID=0005, Data=(空)  [邻星验证(卫星5)]
```

## 关键文件说明

### 后端核心文件

| 文件 | 作用 | 关键类/函数 |
|------|------|------------|
| `main.py` | 统一启动入口 | `Application` 类 |
| `server_main.py` | WebSocket 独立启动 | `create_propagation_service()` |
| `server/services/ws_service.py` | WebSocket 服务 | `WsService` - 多客户端管理 |
| `server/services/client_session.py` | 客户端会话 | `ClientSession` - 含 `_handle_light_batch_command` |
| `server/services/propagation_service.py` | 递推服务 | `PropagationService` - 轨道计算 |
| `server/services/neighbor_finder.py` | 邻居发现 | `NeighborFinder` - 基于轨道根数计算 |
| `server/services/verify_service.py` | 互校验服务 | `VerifyService` - Phase 2 互校验 |
| `server/propagators/perturbed.py` | 轨道递推引擎 | `PerturbedOrbitPropagator` - JIT加速 |
| `server/core/constellation.py` | 星座实体 | `Constellation` - 含 `apply_light_control` |
| `server/protocol/ldpc_codec.py` | LDPC编解码 | `LDPCCodec` - 基于 pyldpc (seed=42) |
| `server/protocol/transfer_frame.py` | 传输帧编解码 | `TransferFrame`, `SubMessage` |
| `server/services/protocol_handler.py` | 协议处理器 | `ProtocolHandler` - 含 `build_light_control_frames` |
| `server/services/protocol_logger.py` | 协议日志 | `ProtocolLogger` - 含 `log_per_satellite_frames` |
| `server/services/light_control.py` | 灯光控制 | `LightControlService` - 22颗卫星灯光管理 |

### 前端核心文件

| 文件 | 作用 | 关键函数 |
|------|------|---------|
| `web/app.js` | 应用主入口 | `initApp()`, `switchView()` |
| `web/managers/playback-manager.js` | 播放控制 | 含 `protocol_response` 处理 |
| `web/managers/input-manager.js` | 输入处理 | `initFirstPersonControls()` |
| `web/modules/state.js` | 全局状态 | `appState` 对象 |
| `web/modules/ui/constellation-panel.js` | 星座面板 | 含待发送指令管理、`handleLightResponse` |
| `web/modules/ui/protocol-confirm-bar.js` | 确认按钮栏 | `createProtocolConfirmBar` |
| `web/modules/modes/ws-mode.js` | WS模式 | 含 `protocol_response` 处理 |
| `web/modules/interpolation.js` | 插值算法 | `interpolateSatellites()` |
| `web/modules/views/first-person.js` | 地面视角渲染 | `updateSatellitesFirstPerson()` |
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

## 后台行为

### 后台暂停机制

1. **延迟暂停**：页面进入后台 10 秒后自动发送 `pause` 命令
2. **立即恢复**：页面回到前台立即发送 `resume` 命令
3. **连接保持**：后台期间保持 WebSocket 连接，不断开

## 轨道递推算法

### 物理模型

采用**摄动轨道模型**，考虑以下因素：
- **J2 摄动**：地球扁率影响
- **大气阻力**：根据高度计算大气密度
- **太阳引力**：太阳对卫星的引力作用
- **月球引力**：月球对卫星的引力作用

### JIT 加速

使用 numba 的 `@jit` 装饰器编译核心计算函数，首次运行时自动预热（JIT 编译），后续计算速度提升 10-100 倍。

## 坐标系统

### 坐标转换链

```
ECI (地心惯性坐标系)
  ↓ GMST (格林尼治平恒星时)
ECEF (地心地固坐标系)
  ↓ 纬度/经度
Local (本地地平坐标系: 方位角/仰角/距离)
```

## 常见问题

### Q: 为什么后台时 FPS 会下降？

**A**: 这是浏览器的正常行为。后台标签页会被浏览器节流以降低资源消耗。本项目已实现后台 10 秒后自动暂停，回到前台后自动恢复。

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

### Q: 协议日志在哪里？

**A**: 每次启动后端服务时，在 `log/` 目录下创建新的 `test_yyyymmddhhmmss.log` 文件。

### Q: pyldpc 未安装怎么办？

**A**: LDPC 编解码器会自动降级为 CRC32 校验模式，功能不受影响。安装 pyldpc：`pip install pyldpc`

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
- pyldpc（LDPC 编码/解码）

### 前端
- Vanilla JavaScript（ES6+）
- Three.js（3D 渲染）
- WebSocket API
- Canvas API（动态纹理）

## 待完善功能

| 模块 | 待完善项 | 优先级 |
|------|---------|--------|
| **互校验** | 实际互校验模拟流程（CRC失败→VerifyRequest→VerifyResponse→恢复） | 高 |
| **LDPC** | 自适应 SNR 调整、错误纠正能力测试 | 中 |
| **协议** | 遥测数据处理（PacketType.TELEMETRY） | 低 |
| **协议** | 状态报告处理（PacketType.STATUS_REPORT） | 低 |
| **前端** | 协议日志查看 UI | 低 |
| **测试** | LDPC 真实错误纠正集成测试 | 中 |
| **文档** | 协议帧格式详细规范 | 中 |
| **架构** | 多地面站冲突处理 | 低 |

## 许可证

MIT License

## 联系方式

如有问题或建议，欢迎提交 Issue。

---

**最后更新**: 2026-04-20  
**版本**: v3.1（每卫星独立帧 + 邻居验证数据 + 互校验服务）

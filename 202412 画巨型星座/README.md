# 巨型星座 3D 可视化系统

## 项目概述

本项目是一个基于 Web 的巨型星座（卫星编队）3D 可视化系统，支持 CSV 历史数据回放和 WebSocket 实时数据流两种模式。采用 FastAPI 统一架构，单进程单端口提供 HTTP + WebSocket 服务，支持多客户端并发连接，每个客户端拥有独立的计算会话。

数据库采用 MySQL + SQLModel + Alembic 方案，实现配置管理、协议日志存储、星座数据持久化，支持运行时双向同步。

---

## 系统架构

### 后端架构（FastAPI + SQLModel + MySQL）

```
server/
├── config/                     # 配置管理
│   ├── app_config.py          # Pydantic BaseModel 配置（ServerConfig, PropagationConfig 等 8 个子配置）
│   └── constellation_setup.py # 星座生成配置
├── core/                       # 核心领域模型
│   ├── constellation.py       # 星座实体（含 apply_light_control, save_to_db, sync_light_state_to_db）
│   ├── satellite.py           # 卫星实体（含 light_state 属性）
│   ├── orbit_elements.py      # 轨道根数值对象
│   ├── inertial_state.py      # 惯性状态值对象
│   ├── physical_props.py      # 物理属性值对象
│   ├── frame_data.py          # 帧数据值对象
│   ├── propagation_state.py   # 传播状态机
│   └── exceptions.py          # 自定义异常
├── db/                         # 数据库层（SQLModel + Alembic）
│   ├── models.py              # SQLModel 表模型（Config, ProtocolLog, Satellite, SatelliteNeighbor）
│   ├── session.py             # 异步引擎 + 会话工厂
│   ├── repositories/          # 数据访问层
│   │   ├── config_repo.py     # 配置 CRUD
│   │   ├── log_repo.py        # 日志 CRUD + 分页
│   │   ├── satellite_repo.py  # 卫星 CRUD + 批量操作
│   │   └── neighbor_repo.py   # 邻星关系 CRUD + 批量 upsert
│   └── migrations/            # Alembic 迁移
│       ├── env.py
│       └── versions/
│           ├── 001_initial.py     # configurations + protocol_logs
│           └── 002_constellation.py # satellites + satellite_neighbors
├── fastapi_app/                # FastAPI 应用层
│   ├── app.py                 # 应用工厂（create_app）
│   ├── lifespan.py            # 生命周期管理（DB 初始化 + 星座种子化）
│   ├── dependencies.py        # 依赖注入
│   ├── schemas.py             # Pydantic 响应模型
│   ├── routes/                # HTTP 路由
│   │   ├── csv.py             # CSV 数据 API
│   │   ├── config.py          # 配置 CRUD API
│   │   ├── logs.py            # 协议日志 API
│   │   ├── constellation.py   # 卫星查询 + 灯光控制 API
│   │   └── schedules.py       # 灯光调度计划 API（时间基灯光控制）
│   └── ws/                    # WebSocket 路由
│       ├── manager.py         # ConnectionManager（多客户端管理）
│       └── router.py          # WebSocket 端点（/ws/{client_id}）
├── propagators/                # 轨道递推引擎
│   ├── base.py               # 推进器基类
│   └── perturbed.py          # 摄动轨道推进器（纯 numpy，无 JIT）
├── protocol/                   # 通信协议模块
│   ├── constants.py          # 协议常量枚举
│   ├── transfer_frame.py     # 传输帧编解码
│   └── ldpc_codec.py         # LDPC 编解码器
└── services/                   # 业务服务层
    ├── client_session.py      # 客户端会话（含协议帧处理 + DB 同步）
    ├── propagation_service.py # 递推服务
    ├── csv_service.py         # CSV 数据服务
    ├── protocol_handler.py    # 协议消息处理器
    ├── protocol_logger.py     # 协议日志记录器（文件 + DB 双写）
    ├── verify_service.py      # 互校验服务
    ├── neighbor_finder.py     # 邻居发现服务
    ├── light_control.py       # 灯光控制服务
    └── light_scheduler.py     # 灯光调度计划服务（数据持久化 + 状态查询）
```

### 前端架构（JavaScript）

```
web/
├── app.js                      # 应用主入口
├── index.html                  # 主页面
├── core/                       # 核心工具
│   ├── logger.js              # 日志工具
│   └── ws-utils.js            # WebSocket 工具
├── managers/                   # 管理器
│   ├── playback-manager.js    # 播放控制（含 WebSocket 连接，端口 8000）
│   ├── input-manager.js       # 输入处理
│   └── mode-manager.js        # 模式切换
├── modules/                    # 功能模块
│   ├── views/                 # 视图渲染
│   │   ├── first-person.js    # 第一人称（地面视角）
│   │   ├── third-person.js    # 第三人称（太空视角）
│   │   └── center-person.js   # 主星视角
│   ├── ui/                    # UI 组件
│   │   ├── location-controls.js
│   │   ├── constellation-panel.js  # 星座面板（含待发送指令管理）
│   │   ├── sat-light-controls.js   # 卫星灯光手动控制（含30秒覆盖机制）
│   │   ├── protocol-confirm-bar.js
│   │   └── stats-panel.js
│   ├── light-schedule-manager.js   # 灯光计划管理器（前端自主执行引擎）
│   ├── light-timeline.js           # 灯光时间线 UI（批量选择 + 持续时间）
│   ├── light-manager.js            # 灯光状态管理器
│   └── modes/                 # 数据模式
│       └── ws-mode.js         # WebSocket 模式（端口 8000）
└── style.css                   # 样式文件
```

---

## 启动方式

### FastAPI 模式（推荐）

```bash
python main_fastapi.py
```

统一服务，单端口：
- **HTTP**: `http://0.0.0.0:8000` — 静态资源、CSV API、配置 API、日志 API
- **WebSocket**: `ws://0.0.0.0:8000/ws/{client_id}` — 实时轨道递推
- **数据库**: MySQL `sky dome` — 配置、日志、星座数据

### 旧模式（兼容）

```bash
python main.py          # HTTP (8000) + WebSocket (8765) 双端口
python server_main.py   # 仅 WebSocket (8765)
```

---

## 数据库架构

### 表结构

| 表名 | 说明 | 关键字段 |
|------|------|----------|
| `configurations` | 应用配置 | key, value, section, updated_at |
| `protocol_logs` | 协议日志 | timestamp, log_type, frame_data, messages |
| `satellites` | 卫星数据 | sat_id, 轨道根数(a/e/i/Ω/ω/f), 物理属性, light_state |
| `satellite_neighbors` | 邻星关系 | sat_id, neighbor_id, distance_km, calculated_at |
| `light_schedules` | 灯光调度计划 | sat_id, schedule_type, trigger_time/trigger_at, command, duration_seconds, executed |
| `alembic_version` | 迁移版本 | version_num |

### 数据流

```
启动时:
  YAML 配置 → AppConfig → DB 种子化（首次）
  CSV 星座 → Constellation → DB 种子化（首次）

运行时:
  灯光控制（手动）→ 前端 setLight → 3D 场景更新
  灯光计划（自动）→ 前端播放循环 checkAndExecute → 3D 场景更新
  计划持久化 → REST API → DB light_schedules
  邻居计算 → NeighborFinder → DB upsert_many（含距离）

查询时:
  REST API → Repository → DB → JSON 响应
```

### 连接配置

```
数据库: MySQL 8.0+
URL: mysql+aiomysql://root:7777777zZ.@localhost:3306/sky dome
引擎: SQLAlchemy async + aiomysql
迁移: Alembic (mysql+pymysql 驱动)
```

---

## 使用指南

### 基本操作

1. **切换数据源模式**
   - CSV 模式：回放历史轨道数据
   - WS 模式：接收实时计算数据

2. **切换视角**
   - 第三人称：太空视角
   - 第一人称：地面站视角
   - 主星视角：跟随主星运动

3. **控制播放**
   - 播放/暂停/速度调节/进度条

### 卫星编队灯光控制

#### 即时手动控制
1. 打开编队面板 → 选择卫星 → 确认发送
2. 前端直接更新 3D 场景灯光状态
3. **手动控制自动设置 30 秒覆盖期**，期间该卫星的自动计划被跳过

#### 时间基灯光调度（时间线）
1. 打开灯光时间线面板 → 选择模式 → 批量选择卫星 → 设置时间 → 添加计划
2. **三种时间模式**：
   - **相对时间**：基于当前播放帧的时间戳，延迟 N 秒后触发
   - **仿真绝对时间**：指定仿真时间戳（如 `20210817053301`）触发
   - **真实时间（Wall-clock）**：基于系统时钟的 UTC 时间触发
3. **持续时间支持**：开灯时可设置持续时长，系统自动创建对应的关灯计划
4. **前端帧级精确执行**：计划在播放循环（`playback-manager.js` / `ws-mode.js`）中基于当前帧时间戳匹配，确保与可视化同步
5. **手动覆盖优先级**：手动控制后 30 秒内，该卫星的自动调度计划被跳过

#### 架构要点
- **前端自主控制**：后端仅负责计划持久化（`light_schedules` 表），不修改 `light_state`
- **轮询同步**：前端每 15 秒从 `/api/light-schedules` 轮询计划
- **本地即时生效**：创建计划后立即添加到前端本地列表，无需等待轮询

---

## 通信协议

### 传输帧结构

```
| Sync(4B) | Version+VCID(1B) | SCID(2B) | Frame_Count(2B) |
| Packet_Type(1B) | Dest_ID(2B) | Packet_ID(2B) | Packet_Length(2B) |
| Payload | CRC(4B) |
```

**关键设计**：
- 每颗卫星独立一帧，`Dest_ID` 为目标卫星 ID
- 每帧包含 3 条子消息：自身指令 + 邻星1验证 + 邻星2验证
- LDPC 外层封装

### 灯光控制消息

| Command_Type | 含义 |
|-------------|------|
| 0x01 | 开灯 |
| 0x02 | 关灯 |

---

## 多客户端支持

### 架构特点

1. **独立计算会话** — 每个 WebSocket 客户端拥有独立的 `PropagationService` + `Constellation`
2. **资源隔离** — 客户端间互不影响
3. **并发限制** — 最大 10 个并发客户端
4. **统一事件循环** — 所有客户端在 FastAPI/uvicorn 单事件循环中运行

### WebSocket 端点

```
ws://host:8000/ws/{client_id}
```

客户端 ID 格式：`web_{timestamp}_{random}`

---

## 轨道递推算法

### 物理模型

摄动轨道模型，考虑：
- **J2 摄动**：地球扁率影响
- **大气阻力**：根据高度计算大气密度
- **太阳引力**：太阳对卫星的引力作用
- **月球引力**：月球对卫星的引力作用

### 计算引擎

使用纯 numpy 进行批量计算（后续将引入 OREKit 替代）。

---

## 坐标系统

```
ECI (地心惯性坐标系)
  ↓ GMST (格林尼治平恒星时)
ECEF (地心地固坐标系)
  ↓ 纬度/经度
Local (本地地平坐标系: 方位角/仰角/距离)
```

---

## 后台行为

1. **延迟暂停**：页面进入后台 10 秒后自动发送 `pause`
2. **立即恢复**：页面回到前台立即发送 `resume`
3. **连接保持**：后台期间保持 WebSocket 连接

---

## 技术栈

### 后端
| 组件 | 技术 | 说明 |
|------|------|------|
| Web 框架 | FastAPI + uvicorn | HTTP + WebSocket 统一服务 |
| 数据库 ORM | SQLModel + SQLAlchemy async | 类型安全的数据库操作 |
| 数据库驱动 | aiomysql / pymysql | 异步 / 同步 MySQL 驱动 |
| 数据库迁移 | Alembic | 版本化表结构管理 |
| 数据库 | MySQL 8.0+ | 关系型数据库 |
| 配置验证 | Pydantic BaseModel | 自动类型验证和转换 |
| 数值计算 | numpy | 轨道递推批量计算 |
| 编码/解码 | pyldpc | LDPC 编码/解码 |
| 异步运行时 | asyncio | 异步 IO |

### 前端
- Vanilla JavaScript (ES6+)
- Three.js (3D 渲染)
- WebSocket API
- Canvas API (动态纹理)

---

## 关键文件说明

### 后端核心文件

| 文件 | 作用 | 关键类/函数 |
|------|------|------------|
| `main_fastapi.py` | FastAPI 统一启动入口 | `FastAPIApplication` 类 |
| `server/fastapi_app/app.py` | 应用工厂 | `create_app()` |
| `server/fastapi_app/lifespan.py` | 生命周期管理 | DB 初始化 + 星座种子化 |
| `server/fastapi_app/ws/manager.py` | WebSocket 连接管理 | `ConnectionManager` |
| `server/fastapi_app/ws/router.py` | WebSocket 路由 | `/ws/{client_id}` 端点 |
| `server/services/client_session.py` | 客户端会话 | `ClientSession` (含 DB 同步) |
| `server/propagators/perturbed.py` | 轨道递推引擎 | `PerturbedOrbitPropagator` (纯 numpy) |
| `server/config/app_config.py` | 配置管理 | Pydantic BaseModel 配置类 |
| `server/db/models.py` | 数据库表模型 | Config, ProtocolLog, Satellite, SatelliteNeighbor, LightSchedule |
| `server/core/constellation.py` | 星座实体 | `Constellation` (含 save_to_db, sync_light_state_to_db) |
| `server/services/light_scheduler.py` | 灯光调度服务 | `LightScheduler` (数据持久化 + 状态查询) |
| `server/fastapi_app/routes/schedules.py` | 灯光计划 API | 批量创建 / 查询 / 删除调度计划 |
| `server/protocol/ldpc_codec.py` | LDPC 编解码 | `LDPCCodec` |
| `server/protocol/transfer_frame.py` | 传输帧编解码 | `TransferFrame`, `SubMessage` |
| `server/services/protocol_handler.py` | 协议处理器 | `ProtocolHandler` |
| `server/services/protocol_logger.py` | 协议日志 | `ProtocolLogger` (文件 + DB 双写) |

### 前端核心文件

| 文件 | 作用 |
|------|------|
| `web/app.js` | 应用主入口 |
| `web/managers/playback-manager.js` | 播放控制 + WebSocket 连接（含计划执行检查） |
| `web/modules/light-schedule-manager.js` | 灯光计划管理器（轮询 + 帧级执行 + 手动覆盖） |
| `web/modules/light-timeline.js` | 灯光时间线 UI（批量选择 + 三种时间模式 + 持续时间） |
| `web/modules/light-manager.js` | 灯光状态管理器（setLight / getAllStates） |
| `web/modules/ui/sat-light-controls.js` | 卫星灯光手动控制（30秒覆盖机制） |
| `web/modules/ui/constellation-panel.js` | 星座面板 + 灯光控制 |
| `web/modules/modes/ws-mode.js` | WS 模式（含计划执行检查） |
| `web/modules/interpolation.js` | 插值算法 |
| `web/modules/views/first-person.js` | 地面视角渲染 |

---

## 常见问题

### Q: WebSocket 连接地址是什么？

**A**: `ws://127.0.0.1:8000/ws/{任意client_id}`。HTTP 和 WebSocket 共用 8000 端口。

### Q: 数据库连接失败怎么办？

**A**: 系统会自动回退到 YAML 配置文件。确保 MySQL 服务运行且 `.env` 中 `DATABASE_URL` 正确。

### Q: 如何查看数据库中的表？

**A**: 连接 MySQL 后执行 `SHOW TABLES;`，应看到 `configurations`, `protocol_logs`, `satellites`, `satellite_neighbors`, `light_schedules`, `alembic_version`。

### Q: 如何执行数据库迁移？

**A**: 
```bash
# 查看当前版本
alembic current

# 升级到最新版本
alembic upgrade head

# 生成新迁移
alembic revision --autogenerate -m "描述"
```

### Q: 协议日志在哪里？

**A**: `log/test_yyyymmddhhmmss.log`（文件）+ `protocol_logs` 表（数据库）。

---

## 开发规范

### 代码风格
- Python：PEP 8，类型注解
- JavaScript：ES6+，模块化

### 提交规范
```
feat: 新功能
fix: 修复bug
docs: 文档更新
refactor: 重构
test: 测试代码
```

---

## 架构演进历史

| 阶段 | 内容 | 状态 |
|------|------|------|
| **Phase 1** | HTTP → FastAPI（CSV API + 静态文件） | ✅ 完成 |
| **Phase 2** | MySQL 入库（配置 + 协议日志 + 星座数据） | ✅ 完成 |
| **Phase 3** | WebSocket 整合到 FastAPI（单端口统一服务） | ✅ 完成 |
| **Phase 4** | 配置系统迁移到 Pydantic BaseModel | ✅ 完成 |
| **Phase 5** | 时间基灯光调度系统（前端帧级执行 + 手动覆盖） | ✅ 完成 |

---

## 待完善功能

| 模块 | 待完善项 | 优先级 |
|------|---------|--------|
| **轨道计算** | 引入 OREKit 替代 numpy 推进器 | 高 |
| **互校验** | 实际互校验模拟流程 | 高 |
| **LDPC** | 自适应 SNR 调整、错误纠正测试 | 中 |
| **协议** | 遥测数据处理 | 低 |
| **前端** | 协议日志查看 UI | 低 |
| **测试** | FastAPI 集成测试 | 中 |

---

## 许可证

MIT License

---

**最后更新**: 2026-04-21  
**版本**: v3.2（FastAPI 统一架构 + SQLModel + MySQL + Pydantic 配置 + 时间基灯光调度）

# 后端面向对象重构计划

> 巨型星座 3D 可视化系统 - 后端重构
> 创建时间: 2026-04-15
> 状态: 执行中

---

## 一、卫星类设计

### 1.1 `Satellite` 类

```python
class Satellite:
    """单颗卫星的状态和行为封装"""
    
    # 属性
    sat_id: int                    # 卫星编号
    orbit_elements: OrbitElements  # 轨道根数 (a, e, i, Ω, ω, M)
    inertial_state: InertialState  # 惯性状态 (X, Y, Z, Vx, Vy, Vz)
    physical_props: PhysicalProps  # 物理属性 (质量, 横截面积, 阻力系数)
    light_state: bool              # 灯光状态
    
    # 方法
    propagate(dt: float)           # 递推一步
    get_position() -> Vector3D     # 获取位置
    get_velocity() -> Vector3D     # 获取速度
    to_dict() -> dict              # 序列化为前端格式
```

### 1.2 `Constellation` 类

```python
class Constellation:
    """星座管理：多颗卫星的集合"""
    
    # 属性
    name: str                      # 星座名称
    satellites: List[Satellite]    # 卫星列表
    config: ConstellationConfig    # 星座配置
    
    # 方法
    add_satellite(sat: Satellite)
    remove_satellite(sat_id: int)
    propagate_all(dt: float)       # 所有卫星递推一步
    get_snapshot() -> FrameData    # 获取当前帧快照
    get_satellite(sat_id: int) -> Satellite
```

### 1.3 值对象类

```python
@dataclass
class OrbitElements:
    """轨道根数 (开普勒六要素)"""
    a: float    # 半长轴 (m)
    e: float    # 偏心率
    i: float    # 倾角 (rad)
    OMG: float  # 升交点赤经 (rad)
    omg: float  # 近地点幅角 (rad)
    f: float    # 真近点角 (rad)

@dataclass
class InertialState:
    """惯性状态 (ECI 坐标系)"""
    x: float    # 位置 X (m)
    y: float    # 位置 Y (m)
    z: float    # 位置 Z (m)
    vx: float   # 速度 Vx (m/s)
    vy: float   # 速度 Vy (m/s)
    vz: float   # 速度 Vz (m/s)

@dataclass
class PhysicalProps:
    """卫星物理属性"""
    mass: float = 300.0          # 质量 (kg)
    cross_section: float = 0.785 # 横截面积 (m²)
    drag_coefficient: float = 2.2 # 阻力系数

@dataclass
class FrameData:
    """一帧数据：所有卫星在某一时刻的状态"""
    timestamp: str
    satellites: List[SatelliteSnapshot]

@dataclass
class SatelliteSnapshot:
    """单颗卫星的快照数据（用于前端传输）"""
    sat_id: int
    orbit_elements: list  # [a, e, i, OMG, omg, f]
    position: list        # [X, Y, Z]
    velocity: list        # [Vx, Vy, Vz]
```

---

## 二、整体架构设计

### 2.1 目录结构

```
202412 画巨型星座/
├── server/                          # 后端代码（新建）
│   ├── __init__.py
│   ├── core/                        # 核心领域模型
│   │   ├── satellite.py             # Satellite 类
│   │   ├── constellation.py         # Constellation 类
│   │   ├── orbit_elements.py        # OrbitElements 值对象
│   │   ├── inertial_state.py        # InertialState 值对象
│   │   └── frame_data.py            # FrameData 值对象
│   │
│   ├── propagators/                 # 轨道递推引擎
│   │   ├── __init__.py
│   │   ├── base.py                  # OrbitPropagator 抽象基类
│   │   ├── perturbed.py             # PerturbedOrbitPropagator (J2+大气)
│   │   └── sgp4.py                  # SGP4Propagator (未来扩展)
│   │
│   ├── services/                    # 业务服务层
│   │   ├── __init__.py
│   │   ├── propagation_service.py   # 轨道递推服务
│   │   ├── csv_service.py           # CSV 数据服务
│   │   └── ws_service.py            # WebSocket 推送服务
│   │
│   ├── infrastructure/              # 基础设施层
│   │   ├── __init__.py
│   │   ├── buffer.py                # RingBuffer
│   │   ├── config.py                # 集中配置管理
│   │   ├── csv_parser.py            # CSV 解析器
│   │   └── ws_server.py             # WebSocket 服务器
│   │
│   └── api/                         # API 层
│       ├── __init__.py
│       ├── csv_api.py               # CSV HTTP API
│       └── ws_handler.py            # WebSocket 连接处理器
│
├── config/                          # 配置文件（新建）
│   ├── default.yaml                 # 默认配置
│   └── production.yaml              # 生产配置
│
├── Input/                           # 输入数据（保持不变）
├── Output/                          # 输出数据（保持不变）
├── web/                             # 前端代码（保持不变）
│
├── main.py                          # 统一启动入口（替代 start.py）
└── requirements.txt
```

---

## 三、详细重构计划

### Phase 1: 核心领域模型（最高优先级）

| 步骤 | 文件 | 内容 | 依赖 |
|------|------|------|------|
| 1.1 | `server/core/orbit_elements.py` | `OrbitElements` 值对象 + 单位转换方法 | 无 |
| 1.2 | `server/core/inertial_state.py` | `InertialState` 值对象 + 坐标转换方法 | 无 |
| 1.3 | `server/core/physical_props.py` | `PhysicalProps` 值对象 | 无 |
| 1.4 | `server/core/satellite.py` | `Satellite` 类：封装轨道根数、惯性状态、物理属性 | 1.1-1.3 |
| 1.5 | `server/core/frame_data.py` | `FrameData`、`SatelliteSnapshot` 值对象 | 1.4 |
| 1.6 | `server/core/constellation.py` | `Constellation` 类：卫星集合管理 | 1.4-1.5 |

### Phase 2: 轨道递推引擎重构

| 步骤 | 文件 | 内容 | 依赖 |
|------|------|------|------|
| 2.1 | `server/propagators/base.py` | `OrbitPropagator` 抽象基类 | Phase 1 |
| 2.2 | `server/propagators/perturbed.py` | `PerturbedOrbitPropagator` | 2.1 |
| 2.3 | `server/infrastructure/buffer.py` | `RingBuffer` 重构 | Phase 1 |
| 2.4 | `server/services/propagation_service.py` | `PropagationService` | 2.1-2.3 |

### Phase 3: 配置管理

| 步骤 | 文件 | 内容 | 依赖 |
|------|------|------|------|
| 3.1 | `config/default.yaml` | YAML 配置文件 | 无 |
| 3.2 | `server/infrastructure/config.py` | `ServerConfig` 类 | 3.1 |
| 3.3 | `server/core/constellation_config.py` | `ConstellationConfig` 类 | 3.2 |

### Phase 4: 服务层重构

| 步骤 | 文件 | 内容 | 依赖 |
|------|------|------|------|
| 4.1 | `server/services/csv_service.py` | `CsvService` 类 | Phase 1, 3 |
| 4.2 | `server/services/ws_service.py` | `WsService` 类 | Phase 2, 3 |
| 4.3 | `server/api/csv_api.py` | `CsvApiHandler` 重构 | 4.1 |
| 4.4 | `server/api/ws_handler.py` | `WsConnectionHandler` 类 | 4.2 |

### Phase 5: 状态管理

| 步骤 | 文件 | 内容 | 依赖 |
|------|------|------|------|
| 5.1 | `server/core/propagation_state.py` | `PropagationState` 枚举 | Phase 1 |
| 5.2 | `server/services/propagation_service.py` | 添加状态转换验证 | 5.1 |

### Phase 6: 错误处理

| 步骤 | 文件 | 内容 | 依赖 |
|------|------|------|------|
| 6.1 | `server/core/exceptions.py` | 自定义异常体系 | 无 |
| 6.2 | 各服务类 | 结构化异常处理 | 6.1 |

### Phase 7: 统一启动入口

| 步骤 | 文件 | 内容 | 依赖 |
|------|------|------|------|
| 7.1 | `main.py` | 替代 `start.py` | Phase 4 |
| 7.2 | `main.py` | 优雅关闭：信号处理、资源清理 | 7.1 |

---

## 四、依赖注入设计

```python
# main.py 伪代码
def create_app(config_path: str = "config/default.yaml") -> Application:
    # 1. 加载配置
    config = ServerConfig.load(config_path)
    
    # 2. 创建物理属性
    physical_props = PhysicalProps(
        mass=config.physics.satellite_mass,
        drag_coefficient=config.physics.drag_coefficient
    )
    
    # 3. 创建星座
    constellation = Constellation.from_input_files(
        center_oe_path="Input/centerOEmat.txt",
        deputy_oe_path="Input/deputyOEmat.txt",
        physical_props=physical_props
    )
    
    # 4. 创建推进器
    propagator = PerturbedOrbitPropagator(config.physics)
    
    # 5. 创建递推服务
    propagation_service = PropagationService(
        constellation=constellation,
        propagator=propagator,
        buffer=RingBuffer(capacity=config.propagation.buffer_capacity),
        config=config.propagation
    )
    
    # 6. 创建数据服务
    csv_service = CsvService(config=config.csv)
    
    # 7. 创建 WebSocket 服务
    ws_service = WsService(
        propagation_service=propagation_service,
        config=config.ws
    )
    
    # 8. 创建应用
    return Application(
        http_server=HttpServer(port=config.server.http_port),
        csv_api=CsvApi(service=csv_service, port=config.server.csv_api_port),
        ws_server=WsServer(service=ws_service, port=config.server.ws_port)
    )
```

---

## 五、重构收益

| 维度 | 重构前 | 重构后 |
|------|--------|--------|
| **可测试性** | 全局状态污染，难以单元测试 | 依赖注入，每个类可独立测试 |
| **可扩展性** | 添加新轨道模型需修改核心代码 | 实现 `OrbitPropagator` 接口即可 |
| **可维护性** | 职责混乱，修改一处影响多处 | 单一职责，修改隔离 |
| **多实例** | 无法同时服务多个星座 | 创建多个 `Constellation` 实例 |
| **配置管理** | 分散在多个文件中 | 集中 YAML 配置 |
| **错误处理** | 裸 except，返回 dict | 结构化异常体系 |
| **状态管理** | 布尔标志组合 | 明确状态机 |

---

## 六、风险和缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 重构期间功能中断 | 高 | 分阶段重构，每阶段保留向后兼容 |
| JIT 编译性能下降 | 中 | 保持 numba `@jit` 装饰器在热路径 |
| 内存占用增加 | 低 | 值对象使用 `__slots__` 优化 |
| 重构周期过长 | 中 | 按 Phase 顺序执行，每 Phase 可独立验证 |

---

## 七、执行顺序

```
Phase 1 (核心模型) → Phase 2 (递推引擎) → Phase 3 (配置) → Phase 4 (服务层)
                                                              ↓
Phase 7 (统一启动) ← Phase 6 (异常处理) ← Phase 5 (状态管理)
```

**原则：** 每个 Phase 完成后运行一次完整的功能测试，确保前端可视化正常工作后再进入下一 Phase。

---

## 八、执行记录

| Phase | 状态 | 完成时间 | 备注 |
|-------|------|----------|------|
| Phase 1: 核心领域模型 | ✅ 已完成 | 2026-04-15 | 所有测试通过：OrbitElements, InertialState, PhysicalProps, Satellite, FrameData, Constellation |
| Phase 2: 轨道递推引擎 | ✅ 已完成 | 2026-04-15 | 所有测试通过，新旧代码结果完全一致（误差=0），JIT 预热 6.7s，批量递推 22 星 <0.1ms |
| Phase 3: 配置管理 | ✅ 已完成 | 2026-04-15 | 所有测试通过：AppConfig 加载/验证 YAML 配置，ConstellationSetup 生成星座矩阵，科学计数法类型转换，JD0 计算与旧代码一致 |
| Phase 4: 服务层重构 | ✅ 已完成 | 2026-04-15 | 所有测试通过：CsvService 解析/缓存/范围查询/压缩（36%压缩率），WsService 推送服务，CsvApiHandler HTTP API，WsConnectionHandler WebSocket 处理器 |
| Phase 5: 状态管理 | ✅ 已完成 | 2026-04-15 | 所有测试通过：PropagationState 枚举（6状态+转换规则），PropagationService 状态机验证，非法转换抛出 StateTransitionError |
| Phase 6: 错误处理 | ✅ 已完成 | 2026-04-15 | 所有测试通过：15 个自定义异常类（SatelliteError/PropagationError/ConfigError/CsvError/WsError 层次结构），CsvService 使用 CsvFileNotFoundError/CsvNotLoadedError，PropagationService 使用 StateTransitionError |
| Phase 7: 统一启动入口 | ✅ 已完成 | 2026-04-15 | 所有测试通过：Application 类统一管理配置/服务/服务器，优雅关闭（信号处理+资源清理），main() 函数替代 start.py |
| Bug Fix: 双重 f→M 转换 | ✅ 已修复 | 2026-04-15 | perturbed.py 中 propagate_constellation 和 _propagate_constellation_batch 双重 f→M 转换导致误差累积，修复后 1200 步最大位置误差 < 1 微米 |

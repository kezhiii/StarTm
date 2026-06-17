# 代码审查 - 待改进问题清单

> 审查日期: 2026-06-09
> 项目版本: v3.1（迁移完成）
> 测试状态: 69/69 全部通过

---

## 问题列表

### 1. 物理参数硬编码

**文件**: `server/propagators/perturbed.py` (第 119-121 行)

**现状**: 大气阻力计算中的物理参数直接写死在代码中，未使用 `PhysicsConfig` 配置。

```python
CD = 2.2          # 阻力系数
mass = 300.0      # 卫星质量 (kg)
A = np.pi / 4.0 * (1.0**2)  # 横截面积
```

**风险**: 修改参数需要改源码，无法通过配置文件或数据库动态调整，与 `config/default.yaml` 中的 `physics` 配置脱节。

**建议**: 将这些参数从 `AppConfig.physics` 注入到 `PerturbedOrbitPropagator`，或至少引用已有的 `PhysicsConfig` 字段。

---

### 2. 旧模块动态加载

**文件**: `server/propagators/perturbed.py` (第 16-25 行)

**现状**: 通过 `importlib.util` 动态加载项目根目录下的旧 `config.py` 文件获取物理常量。

```python
_config_path = os.path.join(_project_root, "config.py")
_spec = importlib.util.spec_from_file_location("old_config", _config_path)
_old_config = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_old_config)
```

**风险**: 
- 动态加载路径依赖项目根目录，部署环境变化时容易出错
- 旧 `config.py` 与新的 `AppConfig` 体系并存，维护两套配置源
- IDE 无法对动态加载的模块进行类型推断和静态分析

**建议**: 将 `config.py` 中的常量迁移到 `server/config/app_config.py` 的 `PhysicsConfig`，删除旧文件依赖。

---

### 3. CORS 全开

**文件**: `server/fastapi_app/app.py` (第 63-69 行)

**现状**: CORS 中间件配置 `allow_origins=["*"]`，允许任意来源跨域访问。

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

**风险**: 生产环境下任意网站均可调用后端 API，存在 CSRF 和数据泄露风险。

**建议**: 生产环境应限制 `allow_origins` 为前端实际部署的域名列表，开发环境可保留 `["*"]` 但通过环境变量区分。

---

### 4. 废弃代码未清理

**文件**:
- `server_main.py` - 旧的 WebSocket 独立入口
- `server.py` - 旧的 HTTP 服务器（已标记 DeprecationWarning）
- `server/api/csv_api.py` - 旧的 CSV API（已标记废弃）
- `server/api/ws_handler.py` - 旧的 WS 处理器

**现状**: Phase 1-3 迁移完成后，旧入口文件仍保留在项目中，部分仅添加了 `DeprecationWarning` 注释。

**风险**: 
- 增加代码库体积和理解成本
- 新开发者可能误用旧入口
- 旧代码可能包含未修复的安全问题

**建议**: 确认不再需要旧模式后，删除废弃文件，保留 `main_fastapi.py` 作为唯一入口。

---

### 5. 缺少依赖管理文件

**文件**: 项目根目录

**现状**: 项目中没有 `requirements.txt`、`pyproject.toml` 或 `Pipfile`，Python 依赖仅能通过代码导入语句推断。

**已知依赖**:
- `fastapi`
- `uvicorn`
- `sqlmodel`
- `aiomysql`
- `alembic`
- `pydantic`
- `numpy`
- `pyyaml`
- `websockets`（旧，已废弃）
- `sqlalchemy`（通过 sqlmodel 间接依赖）
- `pytest`（测试）

**风险**: 
- 无法一键复现开发环境
- 版本不锁定，不同环境安装可能得到不同版本导致兼容性问题
- 部署时缺少依赖清单

**建议**: 创建 `requirements.txt` 或 `pyproject.toml`，锁定所有依赖版本。

---

### 6. 中文目录名

**目录**: `202412 画巨型星座/`

**现状**: 项目主目录使用中文名称。

**风险**: 
- 部分 CI/CD 系统、Docker、终端环境可能出现编码问题
- URL 编码和路径转义增加复杂度
- 跨平台协作时可能遇到兼容性问题

**建议**: 如条件允许，重命名为英文目录名（如 `mega-constellation`）。若改动成本过大，可暂不处理但需注意部署脚本中的路径编码。

---

### 7. PropagationService 类型提示不完整

**文件**: `server/services/propagation_service.py` (第 41 行)

**现状**: `light_scheduler` 参数使用 `Optional[Any]` 类型标注。

```python
light_scheduler: Optional[Any] = None,
```

**风险**: 丢失类型检查能力，IDE 无法提供自动补全，降低代码可维护性。

**建议**: 将类型改为 `Optional["LightScheduler"]`，并使用 `TYPE_CHECKING` 避免循环导入。

---

### 8. 前端 JS 无工程化工具

**目录**: `web/`

**现状**: 前端使用原生 ES Modules，没有构建工具（Webpack/Vite/esbuild）、代码压缩、lint 或类型检查。

**大文件**:
- `managers/playback-manager.js` - 48.7 KB
- `modules/image-processor.js` - 32.4 KB
- `modules/ui/constellation-panel.js` - 25.8 KB

**风险**: 
- 无打包压缩，生产环境加载慢
- 无 lint/类型检查，运行时才能发现错误
- 大文件难以维护和测试
- 无 tree-shaking，可能包含死代码

**建议**: 引入轻量构建工具（如 Vite 或 esbuild），添加 ESLint 进行代码检查。如短期不引入构建，至少对超大文件进行合理拆分。

---

### 9. 协议日志异步双写的数据安全

**文件**: `server/services/protocol_logger.py`

**现状**: 协议日志采用异步队列写入数据库，500ms 批量提交。

**风险**: 
- 服务在批量提交前崩溃时，队列中未提交的日志数据会丢失
- 队列大小无上限保护，极端高并发下可能内存溢出

**建议**: 
- 添加队列大小上限（如 10000 条），超出时丢弃最旧数据或阻塞写入
- 对关键日志考虑同步写入或 WAL 机制
- 评估日志丢失的可接受程度，按需调整

---

### 10. 前端 `allow_origins` 与 credentials 注释

**文件**: `server/fastapi_app/app.py` (第 66 行)

**现状**: 注释正确指出 `allow_credentials` 不能与 `allow_origins=["*"]` 同时为 True。

```python
allow_credentials=False,  # 不能与 allow_origins=["*"] 同时使用 True
```

**状态**: 当前配置在技术上正确，不会报错。但如果未来需要支持 credentials（如 Cookie 认证），必须同步修改 `allow_origins`，否则会导致运行时错误。

**建议**: 在注释中补充修改指引，或通过配置项统一管理。

---

## 优先级建议

| 优先级 | 问题编号 | 说明 |
|--------|----------|------|
| **高** | #5 | 缺少依赖管理文件影响部署和环境复现 |
| **高** | #1, #2 | 物理参数硬编码和旧模块依赖影响计算正确性和可维护性 |
| **中** | #3, #4 | 安全隐患和代码整洁度 |
| **中** | #9 | 数据安全风险 |
| **低** | #6, #7, #8, #10 | 工程规范和长期维护 |

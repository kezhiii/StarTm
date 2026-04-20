# 后端迁移 Todo：FastAPI + SQLModel + MySQL

> 迁移策略：渐进式迁移，先 HTTP 层，再数据库，最后 WebSocket 整合
> 数据库范围：仅配置和协议日志入库，轨道递推数据保持内存

---

## Phase 1: HTTP → FastAPI（替换 HTTP 层）

### 1.1 项目结构搭建
- [x] 创建 `server/fastapi_app/` 目录
- [x] 创建 `server/fastapi_app/__init__.py`
- [x] 创建 `server/fastapi_app/app.py`（FastAPI 应用工厂）
- [x] 创建 `server/fastapi_app/routes/__init__.py`
- [x] 创建 `main_fastapi.py`（新入口点）

### 1.2 静态文件服务
- [x] 使用 `StaticFiles` 替代 `server.py` 的 `SimpleHTTPRequestHandler`
- [x] 配置前端资源路径（`web/` 目录）
- [x] 设置 Cache-Control 头（StaticFiles 默认行为，可通过 middleware 自定义）

### 1.3 CSV API 迁移
- [x] 创建 `server/fastapi_app/routes/csv.py`
- [x] 迁移 `GET /api/csv-data`（含 `?format=compact|object`）
- [x] 迁移 `GET /api/csv-info`
- [x] 迁移 `GET /api/csv-range?start=N&end=M`
- [x] 复用 `CsvService`，通过 `Depends()` 注入
- [x] 添加 gzip 压缩响应
- [x] 添加 CORS 中间件

### 1.4 依赖注入
- [x] 创建 `server/fastapi_app/dependencies.py`
- [x] `get_csv_service()` 工厂
- [x] `get_config()` 工厂

### 1.5 响应模型
- [x] 创建 `server/fastapi_app/schemas.py`
- [x] `CsvDataResponse`、`CsvInfoResponse`、`CsvRangeResponse`

### 1.6 旧代码标记
- [x] 标记 `server.py` 为废弃（添加 DeprecationWarning）
- [x] 标记 `server/api/csv_api.py` 为废弃（添加文档注释）

### 1.7 测试验证
- [x] FastAPI 路由单元测试（TestClient 验证 503 响应）
- [x] 新旧 API 响应一致性对比（csv-info/csv-data/csv-range 全部通过）
- [x] 前端正常加载验证（StaticFiles 挂载成功，根路径 200）

---

## Phase 2: MySQL 入库（配置 + 协议日志）

### 2.1 数据库基础设施
- [x] 安装 `sqlmodel`, `aiomysql`, `alembic`（alembic 已存在）
- [x] 创建 `server/db/__init__.py`
- [x] 创建 `server/db/session.py`（异步引擎）
- [x] 创建 `server/db/models.py`（SQLModel 模型）
- [x] 创建 `.env.example` 模板
- [x] 创建 `.env` 文件（MySQL: sky dome, root/7777777zZ.）
- [x] 创建 `alembic.ini`
- [x] 初始化 `server/db/migrations/`（含 001_initial 迁移脚本）

### 2.2 数据库模型
- [x] `Config` 模型（key-value + section）
- [x] `ProtocolLog` 模型（JSON 列存储帧详情）

### 2.3 仓库层
- [x] `server/db/repositories/config_repo.py`
- [x] `server/db/repositories/log_repo.py`

### 2.4 配置迁移
- [x] `app_config.py` 添加 `load_from_db()` + `seed_config_to_db()`
- [x] 启动时 DB → YAML 回退
- [x] YAML → DB 种子脚本（`seed_config_to_db()` 函数）

### 2.5 协议日志双写
- [x] `protocol_logger.py` 添加 `_queue_db_log()` + `_db_worker()` 异步队列
- [x] 保留文件日志备份
- [x] 异步队列写入（不阻塞 WS，500ms 批量提交）

### 2.6 API 端点
- [x] `GET /api/config`、`GET /api/config/{section}`、`GET /api/config/key/{key}`、`PUT /api/config/{key}`、`DELETE /api/config/{key}`
- [x] `GET /api/protocol-logs`（分页）、`GET /api/protocol-logs/{log_id}`

### 2.7 生命周期
- [x] `lifespan.py` DB 初始化 + 连接池清理
- [x] 集成到 `create_app()` 的 `lifespan` 参数

### 2.8 测试
- [x] 模型/仓库测试（9 个测试，SQLite in-memory）
- [x] MySQL 宕机回退测试（已验证连接 + 回退机制）
- [x] 日志写入性能测试（已通过集成测试验证）

---

## Phase 4: 配置 → Pydantic BaseSettings

### 4.1 配置类重构
- [ ] 创建 `server/config/settings.py`
- [ ] `ServerSettings`、`PropagationSettings`、`AppSettings` 等

### 4.2 环境变量
- [ ] `env_prefix` 按 section 分组
- [ ] 优先级：env > DB > YAML > 默认值

### 4.3 验证器
- [ ] Pydantic `Field()` 替代手动校验
- [ ] `compute_jd0()` → `@property`

### 4.4 向后兼容
- [ ] 保留 YAML fallback
- [ ] 更新所有 `AppConfig` 导入

### 4.5 测试
- [ ] 配置组合/校验/优先级测试

---

## Phase 3: WebSocket 整合（最后）

### 3.1 路由整合
- [ ] `server/fastapi_app/ws/router.py`（`@app.websocket("/ws")`）
- [ ] `server/fastapi_app/ws/manager.py`

### 3.2 适配器
- [ ] 适配 `WsService` 到 FastAPI WebSocket
- [ ] 替换 `websockets` 为 Starlette WebSocket

### 3.3 单进程
- [ ] 移除独立 WS 线程
- [ ] 端口统一 8000

### 3.4 测试
- [ ] WS 单元/多客户端/断开/协议帧/性能测试

---

## 执行顺序

```
Phase 1 → Phase 2 → Phase 4 → Phase 3
```

## 当前状态

- **进行中**: Phase 2 全部完成 ✅
- **已完成**: Phase 1（全部完成 ✅）、Phase 2（全部完成 ✅，61/61 测试通过，MySQL 集成验证通过）
- **阻塞项**: 无

## Phase 2 已创建文件清单

### 新增文件
| 文件 | 说明 |
|------|------|
| `server/db/__init__.py` | 数据库模块初始化 |
| `server/db/session.py` | 异步引擎 + 会话工厂（支持 env/.env/默认值） |
| `server/db/models.py` | SQLModel 模型（Config + ProtocolLog） |
| `server/db/repositories/__init__.py` | 仓库模块初始化 |
| `server/db/repositories/config_repo.py` | 配置 CRUD + 按 section 分组加载 |
| `server/db/repositories/log_repo.py` | 日志 CRUD + 分页查询 |
| `.env.example` | 数据库连接字符串模板 |

## 创建的文件清单

### 新增文件
| 文件 | 说明 |
|------|------|
| `server/fastapi_app/__init__.py` | 模块初始化 |
| `server/fastapi_app/app.py` | FastAPI 应用工厂（StaticFiles + CORS + 路由注册） |
| `server/fastapi_app/dependencies.py` | 依赖注入（get_csv_service, get_config） |
| `server/fastapi_app/schemas.py` | Pydantic 响应模型 |
| `server/fastapi_app/routes/__init__.py` | 路由模块初始化 |
| `server/fastapi_app/routes/csv.py` | CSV API 路由（3 个端点） |
| `main_fastapi.py` | FastAPI 入口点（替代 main.py） |

### 修改文件
| 文件 | 变更 |
|------|------|
| `server.py` | 添加 DeprecationWarning |
| `server/api/csv_api.py` | 添加废弃文档注释 |
| `server/fastapi_app/app.py` | 添加 `/Output` 目录静态文件挂载 |
| `web/managers/csv-manager.js` | CSV_API_URL 从 `http://127.0.0.1:8080` 改为相对路径 `/api/csv-data` |

---

## Phase 1 补充修复（已完成）

### 1.8 前端 URL 适配
- [x] 挂载 `/Output` 目录（CSV 数据文件访问）
- [x] 修复 `csv-manager.js` 硬编码 8080 端口 → 相对路径

---

*最后更新: 2026-04-20*
*版本: v3.1 迁移规划*

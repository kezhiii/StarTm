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

### 1.8 前端 URL 适配
- [x] 挂载 `/Output` 目录（CSV 数据文件访问）
- [x] 修复 `csv-manager.js` 硬编码 8080 端口 → 相对路径

---

## Phase 2: MySQL 入库（配置 + 协议日志 + 星座数据）

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
- [x] `Satellite` 模型（轨道根数 + 物理属性 + 灯光状态）
- [x] `SatelliteNeighbor` 模型（邻星关系 + 距离）

### 2.3 仓库层
- [x] `server/db/repositories/config_repo.py`
- [x] `server/db/repositories/log_repo.py`
- [x] `server/db/repositories/satellite_repo.py`
- [x] `server/db/repositories/neighbor_repo.py`

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
- [x] `GET /api/satellites`、`GET /api/satellites/{sat_id}`、`PUT /api/satellites/{sat_id}/light`
- [x] `GET /api/satellites/plane/{plane_index}`、`GET /api/satellites/{sat_id}/neighbors`

### 2.7 生命周期
- [x] `lifespan.py` DB 初始化 + 连接池清理
- [x] 集成到 `create_app()` 的 `lifespan` 参数
- [x] 启动时星座数据种子化到数据库

### 2.8 测试
- [x] 模型/仓库测试（9 个测试，SQLite in-memory）
- [x] MySQL 宕机回退测试（已验证连接 + 回退机制）
- [x] 日志写入性能测试（已通过集成测试验证）

---

## Phase 4: 配置 → Pydantic BaseModel

### 4.1 配置类重构
- [x] 创建 `server/config/settings.py`（已合并到 app_config.py）
- [x] `ServerConfig`、`PropagationConfig`、`ConstellationConfig` 等全部转为 Pydantic BaseModel

### 4.2 验证器
- [x] Pydantic `Field()` 替代手动校验（`gt=0`、`ge=1`、`le=65535` 等）
- [x] `compute_jd0()` 保持为方法

### 4.3 向后兼容
- [x] 保留 YAML fallback（`AppConfig.load()` 不变）
- [x] 更新所有 `AppConfig` 导入
- [x] `load_from_db()` + `seed_config_to_db()` 适配 `model_dump()` / `model_validate()`

### 4.4 测试
- [x] 所有现有测试通过（69/69）

---

## Phase 3: WebSocket 整合（最后）

### 3.1 路由整合
- [x] `server/fastapi_app/ws/__init__.py`
- [x] `server/fastapi_app/ws/router.py`（`@router.websocket("/ws/{client_id}")`）
- [x] `server/fastapi_app/ws/manager.py`（ConnectionManager，替代 WsService）

### 3.2 适配器
- [x] 适配 `ClientSession` 接受预创建的 `PropagationService`
- [x] `ConnectionManager` 管理多客户端连接（最大 10 个）
- [x] FastAPI 原生 WebSocket，替代 `websockets` 库

### 3.3 单进程
- [x] 移除独立 WS 线程（`_start_ws_server()` 已删除）
- [x] 端口统一 8000（HTTP + WebSocket 共用）
- [x] `main_fastapi.py` 简化为纯 uvicorn 启动

### 3.4 测试
- [x] 所有现有测试通过（69/69）

---

## 执行顺序

```
Phase 1 → Phase 2 → Phase 4 → Phase 3 ✅ 全部完成
```

## 当前状态

- **已完成**: Phase 1 ✅、Phase 2 ✅、Phase 3 ✅、Phase 4 ✅
- **阻塞项**: 无
- **测试状态**: 69/69 全部通过

## 架构变更总结

### Phase 3 新增文件
| 文件 | 说明 |
|------|------|
| `server/fastapi_app/ws/__init__.py` | WebSocket 模块初始化 |
| `server/fastapi_app/ws/manager.py` | ConnectionManager（替代 WsService） |
| `server/fastapi_app/ws/router.py` | WebSocket 路由（`/ws/{client_id}` + `/ws/stats`） |

### Phase 3 修改文件
| 文件 | 变更 |
|------|------|
| `server/fastapi_app/app.py` | 新增 `propagation_service_factory` 参数，注册 WS 路由器和 ConnectionManager |
| `server/services/client_session.py` | 构造函数支持传入预创建的 `service` 或 `propagation_service_factory` |
| `main_fastapi.py` | 删除独立 WS 线程、`_ws_service`、`_ws_loop`、`_ws_thread`、`_shutdown_event`，简化为纯 uvicorn |

---

*最后更新: 2026-04-20*
*版本: v3.1 迁移完成*

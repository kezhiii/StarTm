# AGENTS.md — 巨型星座 3D 可视化系统

## Project structure

The real project root is `StarTM/`. The `serproject/` parent is a workspace wrapper — always work inside the subdirectory.

```
StarTM/
├── main_fastapi.py       # Entry point (uvicorn, port 8000)
├── server/               # Python backend
│   ├── config/           # Pydantic config (AppConfig, YAML fallback)
│   ├── core/             # Constellation, Satellite, OrbitElements, etc.
│   ├── db/               # SQLModel models, repos, Alembic migrations
│   ├── fastapi_app/      # FastAPI routes, WS manager, lifespan
│   ├── propagators/      # PerturbedOrbitPropagator (J2+drag+solar+lunar)
│   ├── protocol/         # Transfer Frame / SubMessage protocol
│   └── services/         # CSV, propagation, light control, protocol logger
├── web/                  # Vanilla JS frontend (Three.js ES modules)
├── config/default.yaml   # App config
├── gen_dynamic.py        # Formation generators (also gen_hexagonal, gen_rect)
├── tests/
└── docs/
```

## Commands

| Action | Command |
|--------|---------|
| Start server | `python main_fastapi.py` (port 8000, HTTP+WS) |
| Run all tests | `python -m pytest tests/ -v` |
| Run single test | `python -m pytest tests/test_foo.py::TestClass::test_method -v` |
| DB migration | `alembic upgrade head` (see `alembic.ini`) |
| Generate formations | `python gen_dynamic.py` / `gen_hexagonal.py` / `gen_rect.py` |

## Key architecture facts

- **FastAPI** app factory in `server/fastapi_app/app.py:create_app()`. HTTP + WebSocket on single port.
- **No JS build step** — raw ES modules loaded via importmap. Three.js from CDN (`unpkg.com@0.160.0`).
- **DB optional** — FastAPI app works without MySQL (`db_enabled=False`). Configuration falls back to YAML.
- **Tests use SQLite in-memory** — no MySQL needed for test suite.
- **Alembic** migrations in `server/db/migrations/`. Connection string in `alembic.ini` (MySQL).
- **Pydantic config** — all config models inherit `BaseModel` with `Field()` validators. YAML loaded via `AppConfig.load()`.
- **Old server.py** is deprecated (Phase 1 migration complete). Do not edit.
- **Protocol layer** in `server/protocol/` — custom Transfer Frame binary protocol with CRC32, LDPC encoding.
- **Pattern matching** (frontend) — image processor + Hungarian algorithm for mapping patterns onto satellite formations with ground-view compensation (Hill→LOS projection matrix). Docs in `docs/matcher-algorithm.md`.

## Test conventions

- `conftest.py` adds project root to `sys.path` — no need for `PYTHONPATH` or pip install -e.
- Async DB tests use `pytest-asyncio` + `SQLite+aiosqlite` in-memory.
- Protocol tests test binary encoding/decoding, CRC, LDPC.
- Frontend has ad-hoc JS test files (`test-image-processor.js`, `test-performance.js`) runnable in browser.

## Gotchas

- Project root directory is `StarTM/`. No special quoting needed.
- No `requirements.txt` — dependencies must be installed individually (fastapi, uvicorn, sqlmodel, aiomysql, aiosqlite, pydantic, pyyaml, numpy, pytest-asyncio, etc.).
- No lint/typecheck config found; none expected.
- GitHub remote is `git@github.com:kezhiii/StarTm.git`.

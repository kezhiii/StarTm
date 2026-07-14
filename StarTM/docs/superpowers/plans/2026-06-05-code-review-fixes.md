# Code Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all P1/P2/P3 issues from code review

**Architecture:** Minimal targeted fixes preserving existing functionality

**Tech Stack:** Python (FastAPI), JavaScript (Vanilla ES6+)

---

## File Structure

| File | Action | Issue |
|------|--------|-------|
| `server/fastapi_app/routes/constellation.py` | Modify | P1: Route order |
| `web/modules/modes/ws-mode.js` | Modify | P1: WebSocket URL |
| `web/managers/playback-manager.js` | Modify | P1: WebSocket URL |
| `server/fastapi_app/app.py` | Modify | P1: CORS |
| `server_main.py` | Modify | P2: Config path |
| `server/services/light_scheduler.py` | Modify | P2: Import + comments |
| `config/default.yaml` | Modify | P3: Unused fields |

---

### Task 1: Fix Route Order (P1)

**Files:**
- Modify: `server/fastapi_app/routes/constellation.py`

**Problem:** `/neighbors/all` is registered AFTER `/{sat_id}`. FastAPI matches routes in order, so `/api/satellites/neighbors/all` hits `/{sat_id}` and returns 422.

- [ ] **Step 1: Move `/neighbors/all` before `/{sat_id}`**

Move lines 175-186 to before line 65. The route order should be:

```python
@router.get("")                    # GET /api/satellites
@router.get("/neighbors/all")      # GET /api/satellites/neighbors/all  <-- BEFORE /{sat_id}
@router.get("/{sat_id}")           # GET /api/satellites/{sat_id}
@router.get("/plane/{plane_index}") # GET /api/satellites/plane/{plane_index}
@router.put("/{sat_id}/light")     # PUT /api/satellites/{sat_id}/light
@router.get("/{sat_id}/neighbors") # GET /api/satellites/{sat_id}/neighbors
```

- [ ] **Step 2: Verify**

```bash
curl http://localhost:8000/api/satellites/neighbors/all
# Should return JSON with neighbor_map, not 422
```

- [ ] **Step 3: Commit**

```bash
git add server/fastapi_app/routes/constellation.py
git commit -m "fix: reorder routes so /neighbors/all matches before /{sat_id}"
```

---

### Task 2: Fix WebSocket Hardcoded URL (P1)

**Files:**
- Modify: `web/modules/modes/ws-mode.js:26`
- Modify: `web/managers/playback-manager.js`

**Problem:** WebSocket URL is hardcoded to `ws://127.0.0.1:8000`, ignoring config and breaking non-localhost deployments.

- [ ] **Step 1: Update ws-mode.js**

Replace line 26:
```javascript
ws.connection = new WebSocket(`ws://127.0.0.1:8000/ws/${clientId}`);
```

With:
```javascript
const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const wsUrl = `${wsProtocol}//${window.location.host}/ws/${clientId}`;
ws.connection = new WebSocket(wsUrl);
```

- [ ] **Step 2: Update playback-manager.js**

Find any hardcoded WebSocket URL and apply same fix.

- [ ] **Step 3: Test**

Open browser devtools, verify WebSocket connects to current host.

- [ ] **Step 4: Commit**

```bash
git add web/modules/modes/ws-mode.js web/managers/playback-manager.js
git commit -m "fix: construct WebSocket URL from window.location instead of hardcoding"
```

---

### Task 3: Fix CORS Configuration (P1)

**Files:**
- Modify: `server/fastapi_app/app.py:63-69`

**Problem:** `allow_origins=["*"]` + `allow_credentials=True` violates CORS spec. Browsers reject this.

- [ ] **Step 1: Fix CORS middleware**

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,  # Changed: cannot use * with credentials
    allow_methods=["*"],
    allow_headers=["*"],
)
```

- [ ] **Step 2: Commit**

```bash
git add server/fastapi_app/app.py
git commit -m "fix: set allow_credentials=False to comply with CORS spec"
```

---

### Task 4: Fix server_main.py Config Path (P2)

**Files:**
- Modify: `server_main.py:38`

**Problem:** `AppConfig.load()` called without required `config_path` argument.

- [ ] **Step 1: Add default path**

Replace line 38:
```python
config = AppConfig.load()
```

With:
```python
config = AppConfig.load(os.path.join(DIR, 'config', 'default.yaml'))
```

- [ ] **Step 2: Commit**

```bash
git add server_main.py
git commit -m "fix: pass default config path to AppConfig.load()"
```

---

### Task 5: Fix light_scheduler.py Import (P2)

**Files:**
- Modify: `server/services/light_scheduler.py:1-12`

**Problem:** `select` is imported locally at line 107 but not at module level. Will cause NameError if execution path differs.

- [ ] **Step 1: Add missing import**

Add to imports at top of file:
```python
from sqlalchemy import select, update as sql_update
```

Remove the local import at line 107:
```python
# from sqlmodel import select  # Remove this line
```

- [ ] **Step 2: Commit**

```bash
git add server/services/light_scheduler.py
git commit -m "fix: add missing sqlalchemy select import at module level"
```

---

### Task 6: Update light_scheduler.py Comments (P2)

**Files:**
- Modify: `server/services/light_scheduler.py:1-5, 14-21`

**Problem:** Comments say "front-end only" but code updates both DB and memory constellation.

- [ ] **Step 1: Update module docstring**

```python
"""
灯光调度服务

提供灯光调度计划的数据库操作和状态查询。
后端负责：计划持久化、执行状态更新、内存星座同步。
前端负责：基于播放帧时间戳的计划触发检查。
"""
```

- [ ] **Step 2: Update class docstring**

```python
"""
灯光调度器。

职责：
- 提供计划的数据库查询和状态更新
- 执行到期计划（更新 DB + 内存星座状态）
- 供 API 层和 WebSocket 会话调用
"""
```

- [ ] **Step 3: Commit**

```bash
git add server/services/light_scheduler.py
git commit -m "docs: update light_scheduler comments to match actual behavior"
```

---

### Task 7: Clean Up Config Fields (P3)

**Files:**
- Modify: `config/default.yaml`

**Problem:** `ws_port` and `csv.api_port` are unused in FastAPI mode but present in config.

- [ ] **Step 1: Remove unused fields**

Remove from `server:` section:
```yaml
  ws_port: 8765      # Remove
  ws_host: "0.0.0.0" # Remove
```

Remove from `csv:` section:
```yaml
  api_port: 8080     # Remove
```

- [ ] **Step 2: Commit**

```bash
git add config/default.yaml
git commit -m "chore: remove unused ws_port and csv.api_port from config"
```

---

### Task 8: Fix Test Import Paths (P3)

**Files:**
- Create: `conftest.py` (if not exists)

**Problem:** Tests use `from server.xxx` which requires running from project root.

- [ ] **Step 1: Create/update conftest.py**

```python
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent))
```

- [ ] **Step 2: Verify tests pass**

```bash
pytest tests/ -v
```

- [ ] **Step 3: Commit**

```bash
git add conftest.py
git commit -m "fix: add conftest.py to ensure consistent test imports"
```

---

## Verification Checklist

After all fixes:

- [ ] `pytest tests/` passes
- [ ] `python main_fastapi.py` starts without errors
- [ ] WebSocket connects (check browser devtools)
- [ ] `/api/satellites/neighbors/all` returns 200 (not 422)
- [ ] CORS requests work in browser
- [ ] Satellite light control works

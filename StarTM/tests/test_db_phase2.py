"""
Phase 2 数据库测试

使用 SQLite in-memory 测试数据库模型和仓库层，无需 MySQL。
"""

import pytest
import pytest_asyncio
import asyncio
from datetime import datetime
from sqlmodel import SQLModel
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from server.db.models import Config, ProtocolLog
from server.db.repositories.config_repo import ConfigRepository
from server.db.repositories.log_repo import LogRepository


@pytest_asyncio.fixture
async def db_session():
    """创建 SQLite in-memory 数据库会话"""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
    
    session_factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
    
    async with session_factory() as session:
        yield session
    
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.drop_all)
    await engine.dispose()


class TestConfigRepository:
    """配置仓库测试"""

    @pytest.mark.asyncio
    async def test_set_and_get_config(self, db_session):
        """测试设置和获取配置"""
        repo = ConfigRepository(db_session)
        
        config = await repo.set_config(
            key="server.http_port",
            value=8000,
            section="server",
            description="HTTP 端口",
        )
        
        assert config.key == "server.http_port"
        assert config.section == "server"
        
        fetched = await repo.get_by_key("server.http_port")
        assert fetched is not None
        import json
        assert json.loads(fetched.value) == 8000

    @pytest.mark.asyncio
    async def test_get_by_section(self, db_session):
        """测试按 section 查询"""
        repo = ConfigRepository(db_session)
        
        await repo.set_config(key="server.http_port", value=8000, section="server")
        await repo.set_config(key="server.ws_port", value=8765, section="server")
        await repo.set_config(key="propagation.dt", value=1.0, section="propagation")
        
        server_configs = await repo.get_by_section("server")
        assert len(server_configs) == 2

    @pytest.mark.asyncio
    async def test_update_existing_config(self, db_session):
        """测试更新已有配置"""
        repo = ConfigRepository(db_session)
        
        await repo.set_config(key="server.http_port", value=8000, section="server")
        await repo.set_config(key="server.http_port", value=9000, section="server")
        
        configs = await repo.get_by_section("server")
        assert len(configs) == 1  # 不应重复
        import json
        assert json.loads(configs[0].value) == 9000

    @pytest.mark.asyncio
    async def test_delete_config(self, db_session):
        """测试删除配置"""
        repo = ConfigRepository(db_session)
        
        await repo.set_config(key="server.http_port", value=8000, section="server")
        deleted = await repo.delete_by_key("server.http_port")
        assert deleted is True
        
        fetched = await repo.get_by_key("server.http_port")
        assert fetched is None

    @pytest.mark.asyncio
    async def test_load_all_to_dict(self, db_session):
        """测试加载所有配置为嵌套字典"""
        repo = ConfigRepository(db_session)
        
        await repo.set_config(key="server.http_port", value=8000, section="server")
        await repo.set_config(key="server.ws_port", value=8765, section="server")
        await repo.set_config(key="propagation.dt", value=1.0, section="propagation")
        
        result = await repo.load_all_to_dict()
        
        assert "server" in result
        assert result["server"]["http_port"] == 8000
        assert result["server"]["ws_port"] == 8765
        assert result["propagation"]["dt"] == 1.0


class TestLogRepository:
    """协议日志仓库测试"""

    @pytest.mark.asyncio
    async def test_create_and_get_log(self, db_session):
        """测试创建和获取日志"""
        repo = LogRepository(db_session)
        
        log = await repo.create_log(
            timestamp=datetime.utcnow(),
            client_addr="127.0.0.1:54321",
            log_type="ldpc_decoded",
            frame_details={"sync": "AABBCCDD", "version": 1},
        )
        
        assert log.id is not None
        assert log.log_type == "ldpc_decoded"
        
        fetched = await repo.get_by_id(log.id)
        assert fetched is not None
        assert fetched.frame_details["sync"] == "AABBCCDD"

    @pytest.mark.asyncio
    async def test_paginated_query(self, db_session):
        """测试分页查询"""
        repo = LogRepository(db_session)
        
        for i in range(10):
            await repo.create_log(
                timestamp=datetime.utcnow(),
                client_addr="127.0.0.1:54321",
                log_type="result",
                result_success=True,
            )
        
        logs, total = await repo.get_paginated(page=1, page_size=5)
        assert total == 10
        assert len(logs) == 5
        
        logs2, total2 = await repo.get_paginated(page=2, page_size=5)
        assert total2 == 10
        assert len(logs2) == 5

    @pytest.mark.asyncio
    async def test_filter_by_log_type(self, db_session):
        """测试按日志类型过滤"""
        repo = LogRepository(db_session)
        
        await repo.create_log(timestamp=datetime.utcnow(), client_addr="127.0.0.1", log_type="sent")
        await repo.create_log(timestamp=datetime.utcnow(), client_addr="127.0.0.1", log_type="result")
        await repo.create_log(timestamp=datetime.utcnow(), client_addr="127.0.0.1", log_type="sent")
        
        logs, total = await repo.get_paginated(log_type="sent")
        assert total == 2

    @pytest.mark.asyncio
    async def test_delete_old_logs(self, db_session):
        """测试删除旧日志"""
        repo = LogRepository(db_session)
        
        old_time = datetime(2020, 1, 1)
        new_time = datetime.utcnow()
        
        await repo.create_log(timestamp=old_time, client_addr="127.0.0.1", log_type="sent")
        await repo.create_log(timestamp=new_time, client_addr="127.0.0.1", log_type="sent")
        
        deleted = await repo.delete_old_logs(datetime(2021, 1, 1))
        assert deleted == 1

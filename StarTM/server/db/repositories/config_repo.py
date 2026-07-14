"""
配置仓库

提供配置的 CRUD 操作。
"""

from __future__ import annotations
from typing import Optional, Dict, Any, List
from datetime import datetime
from sqlmodel import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import Config


class ConfigRepository:
    """配置数据访问层"""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_key(self, key: str) -> Optional[Config]:
        """根据 key 获取配置"""
        result = await self.session.execute(select(Config).where(Config.key == key))
        return result.scalars().first()

    async def get_by_section(self, section: str) -> List[Config]:
        """获取指定 section 的所有配置"""
        result = await self.session.execute(
            select(Config).where(Config.section == section).order_by(Config.key)
        )
        return result.scalars().all()

    async def get_all(self) -> List[Config]:
        """获取所有配置"""
        result = await self.session.execute(select(Config).order_by(Config.section, Config.key))
        return result.scalars().all()

    async def set_config(
        self,
        key: str,
        value: Any,
        section: str,
        description: Optional[str] = None,
        updated_by: Optional[str] = "system",
    ) -> Config:
        """
        设置配置（存在则更新，不存在则创建）
        """
        import json

        existing = await self.get_by_key(key)
        if existing:
            existing.value = json.dumps(value, ensure_ascii=False)
            existing.section = section
            existing.description = description or existing.description
            existing.updated_at = datetime.utcnow()
            existing.updated_by = updated_by
            await self.session.merge(existing)
            await self.session.commit()
            await self.session.refresh(existing)
            return existing
        else:
            config = Config(
                key=key,
                value=json.dumps(value, ensure_ascii=False),
                section=section,
                description=description,
                updated_by=updated_by,
            )
            self.session.add(config)
            await self.session.commit()
            await self.session.refresh(config)
            return config

    async def delete_by_key(self, key: str) -> bool:
        """删除指定 key 的配置"""
        config = await self.get_by_key(key)
        if config:
            await self.session.delete(config)
            await self.session.commit()
            return True
        return False

    async def load_all_to_dict(self) -> Dict[str, Any]:
        """
        加载所有配置为嵌套字典。

        返回格式:
        {
            "server": {"http_port": 8000, "ws_port": 8765, ...},
            "propagation": {"buffer_capacity": 3600, ...},
            ...
        }
        """
        import json

        configs = await self.get_all()
        result: Dict[str, Dict[str, Any]] = {}

        for cfg in configs:
            if cfg.section not in result:
                result[cfg.section] = {}
            # Strip section prefix from key (e.g., "server.http_port" -> "http_port")
            short_key = cfg.key
            if cfg.key.startswith(f"{cfg.section}."):
                short_key = cfg.key[len(cfg.section) + 1:]
            try:
                result[cfg.section][short_key] = json.loads(cfg.value)
            except (json.JSONDecodeError, TypeError):
                result[cfg.section][short_key] = cfg.value

        return result

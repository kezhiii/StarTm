"""
配置管理 API 路由

提供配置的查询和更新端点。
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from server.db.session import get_session
from server.db.repositories.config_repo import ConfigRepository

router = APIRouter(prefix="/api/config", tags=["config"])


@router.get("")
async def get_all_configs(session: AsyncSession = Depends(get_session)):
    """获取所有配置（按 section 分组）"""
    repo = ConfigRepository(session)
    configs = await repo.load_all_to_dict()
    return {"configs": configs}


@router.get("/{section}")
async def get_section_configs(section: str, session: AsyncSession = Depends(get_session)):
    """获取指定 section 的所有配置"""
    repo = ConfigRepository(session)
    configs = await repo.get_by_section(section)
    if not configs:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Section '{section}' not found"
        )
    
    result = {}
    for cfg in configs:
        import json
        try:
            result[cfg.key] = json.loads(cfg.value)
        except (json.JSONDecodeError, TypeError):
            result[cfg.key] = cfg.value
    
    return {"section": section, "configs": result}


@router.get("/key/{key}")
async def get_config_by_key(key: str, session: AsyncSession = Depends(get_session)):
    """获取单个配置项"""
    repo = ConfigRepository(session)
    config = await repo.get_by_key(key)
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Config key '{key}' not found"
        )
    
    import json
    try:
        value = json.loads(config.value)
    except (json.JSONDecodeError, TypeError):
        value = config.value
    
    return {
        "key": config.key,
        "value": value,
        "section": config.section,
        "description": config.description,
        "updated_at": config.updated_at.isoformat(),
        "updated_by": config.updated_by,
    }


@router.put("/{key}")
async def update_config(
    key: str,
    value: dict,
    section: Optional[str] = None,
    description: Optional[str] = None,
    session: AsyncSession = Depends(get_session),
):
    """
    更新或创建配置项。
    
    请求体示例:
    {
        "value": 8000,
        "section": "server",
        "description": "HTTP 端口"
    }
    """
    repo = ConfigRepository(session)
    
    # 如果配置已存在，使用现有 section
    existing = await repo.get_by_key(key)
    if existing and section is None:
        section = existing.section
    
    if section is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Section is required for new config keys"
        )
    
    config = await repo.set_config(
        key=key,
        value=value,
        section=section,
        description=description,
    )
    
    return {
        "key": config.key,
        "section": config.section,
        "updated_at": config.updated_at.isoformat(),
        "message": "Config updated successfully",
    }


@router.delete("/{key}")
async def delete_config(key: str, session: AsyncSession = Depends(get_session)):
    """删除配置项"""
    repo = ConfigRepository(session)
    deleted = await repo.delete_by_key(key)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Config key '{key}' not found"
        )
    return {"message": f"Config '{key}' deleted successfully"}

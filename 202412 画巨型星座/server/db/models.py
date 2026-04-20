"""
数据库模型定义

使用 SQLModel 定义数据库表结构。
"""

from __future__ import annotations
from datetime import datetime
from typing import Optional, Any
from sqlmodel import SQLModel, Field, Column
from sqlalchemy import Text, JSON


class Config(SQLModel, table=True):
    """
    配置表

    存储应用程序配置项，支持按 section 分组。
    替代原有的 YAML 配置文件。
    """
    __tablename__ = "configurations"

    id: Optional[int] = Field(default=None, primary_key=True)
    key: str = Field(unique=True, index=True, max_length=128, description="配置键，如 'server.http_port'")
    value: str = Field(sa_column=Column(Text), description="配置值（JSON 编码）")
    section: str = Field(index=True, max_length=64, description="配置分组，如 'server', 'propagation'")
    description: Optional[str] = Field(default=None, max_length=256, description="配置描述")
    updated_at: datetime = Field(default_factory=datetime.utcnow, description="最后更新时间")
    updated_by: Optional[str] = Field(default=None, max_length=64, description="更新者（system/user）")


class ProtocolLog(SQLModel, table=True):
    """
    协议日志表

    存储通信协议帧的处理日志。
    替代原有的文件日志（log/test_yyyymmddhhmmss.log）。
    """
    __tablename__ = "protocol_logs"

    id: Optional[int] = Field(default=None, primary_key=True)
    timestamp: datetime = Field(index=True, description="日志时间戳")
    client_addr: str = Field(index=True, max_length=64, description="客户端地址")
    log_type: str = Field(index=True, max_length=32, description="日志类型")
    # sent, ldpc_before, ldpc_after, ldpc_decoded, crc_verified, message_queue, result, error

    frame_data: Optional[str] = Field(default=None, sa_column=Column(Text), description="原始帧数据（Base64/hex）")
    frame_details: Optional[dict] = Field(default=None, sa_column=Column(JSON), description="帧详情（sync, version, scid 等）")
    messages: Optional[list] = Field(default=None, sa_column=Column(JSON), description="子消息列表")

    crc_value: Optional[int] = Field(default=None, description="CRC 值")
    crc_passed: Optional[bool] = Field(default=None, description="CRC 校验是否通过")

    result_success: Optional[bool] = Field(default=None, description="执行结果是否成功")
    result_details: Optional[dict] = Field(default=None, sa_column=Column(JSON), description="执行结果详情")

    session_id: Optional[str] = Field(default=None, index=True, max_length=128, description="会话 ID")

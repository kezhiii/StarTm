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


class Satellite(SQLModel, table=True):
    """
    卫星基本信息表

    存储卫星的轨道根数、物理属性和运行时状态。
    数据库作为太空卫星的数据源，启动时加载到内存，运行时双向同步。
    """
    __tablename__ = "satellites"

    id: Optional[int] = Field(default=None, primary_key=True)
    sat_id: int = Field(unique=True, index=True, description="卫星编号（0-based）")

    # 轨道根数 (Keplerian elements)
    semi_major_axis: float = Field(description="半长轴 a (m)")
    eccentricity: float = Field(description="偏心率 e")
    inclination: float = Field(description="倾角 i (rad)")
    raan: float = Field(description="升交点赤经 Ω (rad)")
    argument_of_perigee: float = Field(description="近地点幅角 ω (rad)")
    true_anomaly: float = Field(description="真近点角 f (rad)")

    # 物理属性
    mass: float = Field(default=300.0, description="质量 (kg)")
    cross_section: float = Field(default=0.785, description="横截面积 (m²)")
    drag_coefficient: float = Field(default=2.2, description="阻力系数")

    # 星座位置
    plane_index: int = Field(description="轨道面编号")
    slot_index: int = Field(description="轨道面内槽位编号")

    # 运行时状态
    light_state: bool = Field(default=False, description="灯光状态（True=开灯, False=关灯）")

    created_at: datetime = Field(default_factory=datetime.utcnow, description="创建时间")
    updated_at: datetime = Field(default_factory=datetime.utcnow, description="更新时间")


class SatelliteNeighbor(SQLModel, table=True):
    """
    卫星邻星关系表

    存储卫星间的邻星关系，支持不对称关系（A的邻居是B不代表B的邻居是A）。
    距离基于实时轨道根数计算，定期更新。
    """
    __tablename__ = "satellite_neighbors"

    sat_id: int = Field(primary_key=True, foreign_key="satellites.sat_id", description="卫星编号")
    neighbor_id: int = Field(primary_key=True, foreign_key="satellites.sat_id", description="邻星编号")
    distance_km: float = Field(description="计算时的距离 (km)")
    calculated_at: datetime = Field(default_factory=datetime.utcnow, description="计算时间")


class LightSchedule(SQLModel, table=True):
    """
    灯光调度计划表

    存储卫星灯光的定时控制计划，支持绝对时间和相对时间两种调度模式。
    """
    __tablename__ = "light_schedules"

    id: Optional[int] = Field(default=None, primary_key=True)
    sat_id: int = Field(index=True, description="卫星编号")
    schedule_type: str = Field(max_length=16, description="调度类型：absolute=仿真绝对时间, relative=相对仿真步, wallclock=真实时间")
    trigger_time: Optional[str] = Field(default=None, max_length=32, description="仿真绝对触发时间戳，如 '20210817053301'")
    trigger_step: Optional[int] = Field(default=None, description="相对触发步（仿真步计数器）")
    trigger_at: Optional[datetime] = Field(default=None, description="真实触发时间（UTC），用于 wallclock 模式")
    command: str = Field(max_length=8, description="灯光命令：on 或 off")
    duration_seconds: Optional[int] = Field(default=None, description="灯光持续时长（秒），None表示永久")
    executed: bool = Field(default=False, description="是否已执行")
    created_at: datetime = Field(default_factory=datetime.utcnow, description="创建时间")

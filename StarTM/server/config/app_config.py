"""
应用程序配置管理

使用 Pydantic BaseModel 提供类型化配置访问、自动验证和类型转换。
"""

from __future__ import annotations
import os
import json
import asyncio
from datetime import datetime
from typing import Optional, Dict, Any

import yaml
from pydantic import BaseModel, Field, field_validator, model_validator


class ServerConfig(BaseModel):
    """服务器配置"""
    http_port: int = Field(default=8000, ge=1, le=65535)
    csv_api_port: int = Field(default=8080, ge=1, le=65535, description="仅旧模式使用，FastAPI 模式已统一为 http_port")
    ws_port: int = Field(default=8765, ge=1, le=65535, description="仅旧模式使用，FastAPI 模式已统一为 http_port")
    ws_host: str = Field(default="0.0.0.0")


class PropagationConfig(BaseModel):
    """轨道递推配置"""
    initial_push_seconds: int = Field(default=5, gt=0)
    compute_interval: int = Field(default=10, gt=0)
    push_interval: int = Field(default=10, gt=0)
    buffer_capacity: int = Field(default=3600, gt=0)
    dt: float = Field(default=1.0, gt=0)


class ConstellationConfig(BaseModel):
    """星座基础配置"""
    name: str = Field(default="Constellation")
    start_year: int = Field(default=2021, ge=1900, le=2100)
    start_month: int = Field(default=8, ge=1, le=12)
    start_day: int = Field(default=17, ge=1, le=31)
    center_oe_file: str = Field(default="Input/200sats_centerOEmat.txt")
    deputy_oe_file: str = Field(default="Input/200sats_deputyOEmat.txt")
    # center_oe_file: str = Field(default="Input/centerOEmat.txt")
    # deputy_oe_file: str = Field(default="Input/deputyOEmat.txt")


class ConstellationParamsConfig(BaseModel):
    """星座参数配置（用于生成星座）"""
    orbit_height: float = Field(default=400000.0, gt=0)
    inclination_deg: float = Field(default=55.0, ge=0, le=180)
    phase_factor: int = Field(default=0)
    plane_count: int = Field(default=20, gt=0)
    satellites_per_plane: int = Field(default=15, gt=0)

    @property
    def total_satellites(self) -> int:
        """总卫星数"""
        return self.plane_count * self.satellites_per_plane


class PhysicsConfig(BaseModel):
    """物理常量配置"""
    mu: float = Field(default=3.986004418e14, gt=0)
    mu_moon: float = Field(default=4.903e12, gt=0)
    mu_sun: float = Field(default=1.32712440018e20, gt=0)
    RE: float = Field(default=6.378137e6, gt=0)
    J2: float = Field(default=1.082626683e-3, gt=0)
    wE: float = Field(default=7.2921159e-5, gt=0)


class UnitsConfig(BaseModel):
    """单位转换配置"""
    deg_to_rad: float = Field(default=0.017453292519943295)


class CsvConfig(BaseModel):
    """CSV 配置"""
    default_path: str = Field(default="Output/test_1.csv")
    api_port: int = Field(default=8080, ge=1, le=65535)
    compress: bool = Field(default=True)


class LoggingConfig(BaseModel):
    """日志配置"""
    level: str = Field(default="INFO")
    format: str = Field(default="[%(name)s] %(message)s")


class AppConfig:
    """
    应用程序配置主类。

    使用 Pydantic BaseModel 作为子配置容器，提供：
    - 自动类型验证和转换
    - YAML 文件加载
    - 数据库加载/种子化
    """

    def __init__(self):
        self.server = ServerConfig()
        self.propagation = PropagationConfig()
        self.constellation = ConstellationConfig()
        self.constellation_params = ConstellationParamsConfig()
        self.physics = PhysicsConfig()
        self.units = UnitsConfig()
        self.csv = CsvConfig()
        self.logging = LoggingConfig()

    @classmethod
    def load(cls, config_path: str) -> 'AppConfig':
        """
        从 YAML 文件加载配置。

        Args:
            config_path: YAML 配置文件路径

        Returns:
            AppConfig 实例

        Raises:
            FileNotFoundError: 配置文件不存在
            yaml.YAMLError: YAML 解析错误
            ValueError: 配置验证失败
        """
        if not os.path.exists(config_path):
            raise FileNotFoundError(f"配置文件不存在: {config_path}")

        with open(config_path, 'r', encoding='utf-8') as f:
            raw = yaml.safe_load(f)

        if not isinstance(raw, dict):
            raise ValueError(f"配置文件格式错误: 期望字典类型，得到 {type(raw)}")

        config = cls()
        config._apply_raw(raw)
        return config

    @classmethod
    def load_default(cls, base_dir: Optional[str] = None) -> 'AppConfig':
        """
        加载默认配置文件。

        Args:
            base_dir: 项目根目录（可选）

        Returns:
            AppConfig 实例
        """
        if base_dir is None:
            base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

        config_path = os.path.join(base_dir, "config", "default.yaml")
        return cls.load(config_path)

    def compute_jd0(self) -> float:
        """
        计算起始儒略日。

        Returns:
            起始儒略日 (JD0)
        """
        Y = self.constellation.start_year
        M = self.constellation.start_month
        D = self.constellation.start_day

        jd0 = (D - 32075
               + 1461 * (Y + 4800 + (M - 14) // 12) // 4
               + 367 * (M - 2 - (M - 14) // 12 * 12) // 12
               - 3 * ((Y + 4900 + (M - 14) // 12) // 100) // 4)

        return float(jd0)

    def get_input_path(self, filename: str) -> str:
        """
        获取输入文件的绝对路径。

        Args:
            filename: 相对于 Input/ 的文件名

        Returns:
            绝对路径
        """
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        return os.path.join(base_dir, "Input", filename)

    def get_center_oe_path(self) -> str:
        """获取主星轨道根数文件路径"""
        return self.get_input_path(
            os.path.basename(self.constellation.center_oe_file)
        )

    def get_deputy_oe_path(self) -> str:
        """获取从星轨道根数文件路径"""
        return self.get_input_path(
            os.path.basename(self.constellation.deputy_oe_file)
        )

    def _apply_raw(self, raw: dict) -> None:
        """
        将原始字典应用到配置对象。
        Pydantic 自动处理类型转换和验证。

        Args:
            raw: 原始 YAML 字典
        """
        if 'server' in raw:
            self.server = ServerConfig.model_validate(raw['server'])

        if 'propagation' in raw:
            self.propagation = PropagationConfig.model_validate(raw['propagation'])

        if 'constellation' in raw:
            self.constellation = ConstellationConfig.model_validate(raw['constellation'])

        if 'constellation_params' in raw:
            self.constellation_params = ConstellationParamsConfig.model_validate(raw['constellation_params'])

        if 'physics' in raw:
            self.physics = PhysicsConfig.model_validate(raw['physics'])

        if 'units' in raw:
            self.units = UnitsConfig.model_validate(raw['units'])

        if 'csv' in raw:
            self.csv = CsvConfig.model_validate(raw['csv'])

        if 'logging' in raw:
            self.logging = LoggingConfig.model_validate(raw['logging'])

    def __repr__(self) -> str:
        return (
            f"AppConfig(server={self.server.ws_host}:{self.server.ws_port}, "
            f"constellation='{self.constellation.name}', "
            f"satellites={self.constellation_params.total_satellites})"
        )

    @classmethod
    async def load_from_db(cls, db_url: str = None) -> 'AppConfig':
        """
        从数据库加载配置。

        优先级：DB > YAML 默认值
        如果数据库连接失败，自动回退到 YAML。

        Args:
            db_url: 数据库连接字符串（如为 None 则从环境变量获取）

        Returns:
            AppConfig 实例
        """
        from ..db.session import init_engine, get_session_factory
        from ..db.repositories.config_repo import ConfigRepository

        # 先加载默认 YAML 配置作为基础
        try:
            base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            config_path = os.path.join(base_dir, "config", "default.yaml")
            config = cls.load(config_path)
        except FileNotFoundError:
            config = cls()

        # 尝试从数据库覆盖配置
        if db_url is None:
            from ..db.session import get_database_url
            db_url = get_database_url()

        try:
            init_engine(db_url)
            session_factory = get_session_factory()

            async with session_factory() as session:
                repo = ConfigRepository(session)
                db_configs = await repo.load_all_to_dict()

            if db_configs:
                for section_name, values in db_configs.items():
                    section_map = {
                        'server': ServerConfig,
                        'propagation': PropagationConfig,
                        'constellation': ConstellationConfig,
                        'constellation_params': ConstellationParamsConfig,
                        'physics': PhysicsConfig,
                        'units': UnitsConfig,
                        'csv': CsvConfig,
                        'logging': LoggingConfig,
                    }
                    if section_name in section_map:
                        current = getattr(config, section_name)
                        current_dict = current.model_dump()
                        current_dict.update(values)
                        setattr(config, section_name, section_map[section_name].model_validate(current_dict))
                print("[AppConfig] 已从数据库加载配置")
            else:
                print("[AppConfig] 数据库无配置，使用 YAML 默认值")

        except Exception as e:
            print(f"[AppConfig] 数据库加载失败（回退到 YAML）: {e}")

        return config


def seed_config_to_db(config: 'AppConfig', db_url: str = None) -> None:
    """
    将当前 AppConfig 写入数据库。

    用于首次迁移：将 YAML 配置种子化到数据库。

    Args:
        config: AppConfig 实例
        db_url: 数据库连接字符串
    """
    from ..db.session import init_engine, get_session_factory
    from ..db.repositories.config_repo import ConfigRepository

    if db_url is None:
        from ..db.session import get_database_url
        db_url = get_database_url()

    init_engine(db_url)
    session_factory = get_session_factory()

    sections = [
        ('server', config.server),
        ('propagation', config.propagation),
        ('constellation', config.constellation),
        ('constellation_params', config.constellation_params),
        ('physics', config.physics),
        ('units', config.units),
        ('csv', config.csv),
        ('logging', config.logging),
    ]

    async def _seed():
        async with session_factory() as session:
            repo = ConfigRepository(session)
            count = 0
            for section_name, section_obj in sections:
                for field_name, field_value in section_obj.model_dump().items():
                    key = f"{section_name}.{field_name}"
                    await repo.set_config(
                        key=key,
                        value=field_value,
                        section=section_name,
                        description=f"Auto-seeded from YAML config",
                        updated_by="seed_script",
                    )
                    count += 1
            print(f"[Seed] 已写入 {count} 条配置到数据库")

    asyncio.run(_seed())

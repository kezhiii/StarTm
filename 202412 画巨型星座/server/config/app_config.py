"""
应用程序配置管理

提供 YAML 配置加载、验证和类型化访问。
"""

from __future__ import annotations
import os
from dataclasses import dataclass, field
from typing import Optional

import yaml


@dataclass
class ServerConfig:
    """服务器配置"""
    http_port: int = 8000
    csv_api_port: int = 8080
    ws_port: int = 8765
    ws_host: str = "0.0.0.0"


@dataclass
class PropagationConfig:
    """轨道递推配置"""
    initial_push_seconds: int = 5
    compute_interval: int = 10
    push_interval: int = 10
    buffer_capacity: int = 3600
    dt: float = 1.0


@dataclass
class ConstellationConfig:
    """星座基础配置"""
    name: str = "Constellation"
    start_year: int = 2021
    start_month: int = 8
    start_day: int = 17
    center_oe_file: str = "Input/centerOEmat.txt"
    deputy_oe_file: str = "Input/deputyOEmat.txt"


@dataclass
class ConstellationParamsConfig:
    """星座参数配置（用于生成星座）"""
    orbit_height: float = 400000.0
    inclination_deg: float = 55.0
    phase_factor: int = 0
    plane_count: int = 20
    satellites_per_plane: int = 15

    @property
    def total_satellites(self) -> int:
        """总卫星数"""
        return self.plane_count * self.satellites_per_plane


@dataclass
class PhysicsConfig:
    """物理常量配置"""
    mu: float = 3.986004418e14
    mu_moon: float = 4.903e12
    mu_sun: float = 1.32712440018e20
    RE: float = 6.378137e6
    J2: float = 1.082626683e-3
    wE: float = 7.2921159e-5
    satellite_mass: float = 300.0
    cross_section: float = 0.785
    drag_coefficient: float = 2.2

    @property
    def days_to_seconds(self) -> float:
        """天转秒"""
        return 86400.0


@dataclass
class UnitsConfig:
    """单位转换配置"""
    hours_to_seconds: int = 3600
    days_to_seconds: int = 86400
    deg_to_rad: float = 0.017453292519943295


@dataclass
class CsvConfig:
    """CSV 配置"""
    default_path: str = "Output/test_1.csv"
    api_port: int = 8080
    compress: bool = True


@dataclass
class LoggingConfig:
    """日志配置"""
    level: str = "INFO"
    format: str = "[%(name)s] %(message)s"


class AppConfig:
    """
    应用程序配置主类。

    职责：
    - 加载 YAML 配置文件
    - 提供类型化的配置访问
    - 验证配置完整性
    - 计算派生值（如 JD0）
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
        config.validate()

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

    def validate(self) -> None:
        """
        验证配置完整性。

        Raises:
            ValueError: 配置项无效
        """
        if self.server.http_port <= 0 or self.server.http_port > 65535:
            raise ValueError(f"无效的 HTTP 端口: {self.server.http_port}")

        if self.server.ws_port <= 0 or self.server.ws_port > 65535:
            raise ValueError(f"无效的 WebSocket 端口: {self.server.ws_port}")

        if self.propagation.dt <= 0:
            raise ValueError(f"无效的时间步长: {self.propagation.dt}")

        if self.propagation.buffer_capacity <= 0:
            raise ValueError(f"无效的缓冲区容量: {self.propagation.buffer_capacity}")

        if self.constellation.start_year < 1900 or self.constellation.start_year > 2100:
            raise ValueError(f"无效的起始年份: {self.constellation.start_year}")

        if self.constellation_params.plane_count <= 0:
            raise ValueError(f"无效的轨道面数: {self.constellation_params.plane_count}")

        if self.constellation_params.satellites_per_plane <= 0:
            raise ValueError(f"无效的每轨道面卫星数: {self.constellation_params.satellites_per_plane}")

        if self.physics.mu <= 0:
            raise ValueError(f"无效的地心引力常数: {self.physics.mu}")

        if self.physics.RE <= 0:
            raise ValueError(f"无效的地球半径: {self.physics.RE}")

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

    def _convert_value(self, field_name: str, value, fields: dict) -> any:
        """
        将 YAML 值转换为正确的类型。
        """
        if field_name not in fields:
            return value

        field_type = fields[field_name].type

        # 处理字符串类型的数字（如科学计数法）
        if isinstance(value, str):
            # 由于 from __future__ import annotations，类型是字符串
            type_str = str(field_type) if not isinstance(field_type, str) else field_type
            if type_str == 'float' or type_str == "<class 'float'>":
                return float(value)
            elif type_str == 'int' or type_str == "<class 'int'>":
                try:
                    return int(value)
                except ValueError:
                    return int(float(value))
            elif type_str == 'bool' or type_str == "<class 'bool'>":
                return value.lower() in ('true', '1', 'yes')

        return value

    def _apply_raw(self, raw: dict) -> None:
        """
        将原始字典应用到配置对象。

        Args:
            raw: 原始 YAML 字典
        """
        if 'server' in raw:
            fields = ServerConfig.__dataclass_fields__
            self.server = ServerConfig(**{
                k: self._convert_value(k, v, fields)
                for k, v in raw['server'].items()
                if k in fields
            })

        if 'propagation' in raw:
            fields = PropagationConfig.__dataclass_fields__
            self.propagation = PropagationConfig(**{
                k: self._convert_value(k, v, fields)
                for k, v in raw['propagation'].items()
                if k in fields
            })

        if 'constellation' in raw:
            fields = ConstellationConfig.__dataclass_fields__
            self.constellation = ConstellationConfig(**{
                k: self._convert_value(k, v, fields)
                for k, v in raw['constellation'].items()
                if k in fields
            })

        if 'constellation_params' in raw:
            fields = ConstellationParamsConfig.__dataclass_fields__
            self.constellation_params = ConstellationParamsConfig(**{
                k: self._convert_value(k, v, fields)
                for k, v in raw['constellation_params'].items()
                if k in fields
            })

        if 'physics' in raw:
            fields = PhysicsConfig.__dataclass_fields__
            self.physics = PhysicsConfig(**{
                k: self._convert_value(k, v, fields)
                for k, v in raw['physics'].items()
                if k in fields
            })

        if 'units' in raw:
            fields = UnitsConfig.__dataclass_fields__
            self.units = UnitsConfig(**{
                k: self._convert_value(k, v, fields)
                for k, v in raw['units'].items()
                if k in fields
            })

        if 'csv' in raw:
            fields = CsvConfig.__dataclass_fields__
            self.csv = CsvConfig(**{
                k: self._convert_value(k, v, fields)
                for k, v in raw['csv'].items()
                if k in fields
            })

        if 'logging' in raw:
            fields = LoggingConfig.__dataclass_fields__
            self.logging = LoggingConfig(**{
                k: self._convert_value(k, v, fields)
                for k, v in raw['logging'].items()
                if k in fields
            })

    def __repr__(self) -> str:
        return (
            f"AppConfig(server={self.server.ws_host}:{self.server.ws_port}, "
            f"constellation='{self.constellation.name}', "
            f"satellites={self.constellation_params.total_satellites})"
        )

"""
自定义异常体系

提供结构化的异常类，用于后端各模块的错误处理。
"""

from __future__ import annotations


class SatelliteError(Exception):
    """卫星相关错误基类"""
    pass


class OrbitElementsError(SatelliteError):
    """轨道根数错误"""
    pass


class InvalidOrbitElementsError(OrbitElementsError):
    """无效的轨道根数"""
    def __init__(self, message: str, a: float = 0, e: float = 0, i: float = 0):
        super().__init__(message)
        self.a = a
        self.e = e
        self.i = i


class PropagationError(SatelliteError):
    """轨道递推错误基类"""
    pass


class PropagationFailedError(PropagationError):
    """递推失败"""
    def __init__(self, message: str, sat_id: int = -1, step: int = -1):
        super().__init__(message)
        self.sat_id = sat_id
        self.step = step


class BufferOverflowError(PropagationError):
    """缓冲区溢出"""
    def __init__(self, message: str = "缓冲区已满", capacity: int = 0, current: int = 0):
        super().__init__(message)
        self.capacity = capacity
        self.current = current


class ConstellationError(SatelliteError):
    """星座管理错误基类"""
    pass


class SatelliteNotFoundError(ConstellationError):
    """卫星未找到"""
    def __init__(self, sat_id: int):
        super().__init__(f"卫星 {sat_id} 未找到")
        self.sat_id = sat_id


class DuplicateSatelliteError(ConstellationError):
    """重复的卫星"""
    def __init__(self, sat_id: int):
        super().__init__(f"卫星 {sat_id} 已存在")
        self.sat_id = sat_id


class ConfigError(Exception):
    """配置错误基类"""
    pass


class ConfigFileNotFoundError(ConfigError):
    """配置文件未找到"""
    def __init__(self, path: str):
        super().__init__(f"配置文件不存在: {path}")
        self.path = path


class ConfigValidationError(ConfigError):
    """配置验证失败"""
    def __init__(self, message: str, field: str = ""):
        super().__init__(message)
        self.field = field


class CsvError(Exception):
    """CSV 相关错误基类"""
    pass


class CsvFileNotFoundError(CsvError):
    """CSV 文件未找到"""
    def __init__(self, path: str):
        super().__init__(f"CSV 文件不存在: {path}")
        self.path = path


class CsvParseError(CsvError):
    """CSV 解析错误"""
    def __init__(self, message: str, line: int = -1):
        super().__init__(message)
        self.line = line


class CsvNotLoadedError(CsvError):
    """CSV 数据未加载"""
    def __init__(self):
        super().__init__("CSV 数据未加载，请先调用 load()")


class WsError(Exception):
    """WebSocket 相关错误基类"""
    pass


class WsConnectionError(WsError):
    """WebSocket 连接错误"""
    pass


class WsSendError(WsConnectionError):
    """WebSocket 发送错误"""
    def __init__(self, message: str, client_id: str = ""):
        super().__init__(message)
        self.client_id = client_id


class StateTransitionError(Exception):
    """状态转换错误"""
    pass

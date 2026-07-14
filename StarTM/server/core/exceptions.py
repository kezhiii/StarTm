"""
自定义异常体系

提供结构化的异常类，用于后端各模块的错误处理。
"""

from __future__ import annotations


class SatelliteError(Exception):
    """卫星相关错误基类"""
    pass


class PropagationError(SatelliteError):
    """轨道递推错误基类"""
    pass


class ConfigError(Exception):
    """配置错误基类"""
    pass


class ConfigFileNotFoundError(ConfigError):
    """配置文件未找到"""
    def __init__(self, path: str):
        super().__init__(f"配置文件不存在: {path}")
        self.path = path


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

"""
CSV 数据服务

提供 CSV 文件解析、缓存、范围查询功能。
"""

from __future__ import annotations
import csv
import json
import os
import time
import gzip
from typing import Optional, Dict, List, Any
from dataclasses import dataclass, field

from ..core.exceptions import CsvFileNotFoundError, CsvNotLoadedError, CsvParseError


@dataclass
class CsvMeta:
    """CSV 元信息"""
    total_timestamps: int = 0
    sat_count: int = 0
    total_rows: int = 0
    load_time_ms: float = 0.0
    format: str = "compact"


@dataclass
class CsvData:
    """CSV 数据容器"""
    meta: CsvMeta = field(default_factory=CsvMeta)
    columns: List[str] = field(default_factory=list)
    timestamps: List[str] = field(default_factory=list)
    data: List[List[Any]] = field(default_factory=list)

    @property
    def is_loaded(self) -> bool:
        return len(self.timestamps) > 0


class CsvService:
    """
    CSV 数据服务。

    职责：
    - 解析 CSV 文件（紧凑格式和对象格式）
    - 缓存解析结果
    - 提供时间范围查询
    - 支持 gzip 压缩响应
    """

    def __init__(self, csv_path: Optional[str] = None, compress: bool = True):
        """
        创建 CSV 服务。

        Args:
            csv_path: CSV 文件路径
            compress: 是否启用 gzip 压缩
        """
        self._csv_path = csv_path
        self._compress = compress
        self._cache: Optional[CsvData] = None
        self._load_time: Optional[float] = None

    @property
    def csv_path(self) -> Optional[str]:
        return self._csv_path

    @property
    def is_loaded(self) -> bool:
        return self._cache is not None and self._cache.is_loaded

    @property
    def meta(self) -> Optional[CsvMeta]:
        return self._cache.meta if self._cache else None

    def load(self, csv_path: Optional[str] = None) -> CsvData:
        """
        加载并解析 CSV 文件。

        Args:
            csv_path: CSV 文件路径（可选，使用构造函数传入的路径）

        Returns:
            CsvData 实例

        Raises:
            FileNotFoundError: CSV 文件不存在
        """
        path = csv_path or self._csv_path
        if path is None:
            raise ValueError("CSV 文件路径未指定")

        if not os.path.exists(path):
            raise CsvFileNotFoundError(path)

        self._csv_path = path
        start_ms = time.time() * 1000

        try:
            self._cache = self._parse_compact(path)
        except Exception as e:
            raise CsvParseError(f"CSV 解析失败: {e}")
        self._load_time = time.time()

        load_ms = time.time() * 1000 - start_ms
        self._cache.meta.load_time_ms = round(load_ms, 1)

        return self._cache

    def get_full_data(self, fmt: str = "compact") -> Dict[str, Any]:
        """
        获取完整 CSV 数据。

        Args:
            fmt: 返回格式 ("compact" 或 "object")

        Returns:
            字典格式数据

        Raises:
            RuntimeError: CSV 数据未加载
        """
        if self._cache is None:
            raise CsvNotLoadedError()

        if fmt == "object" and self._cache.meta.format == "compact":
            return self._convert_to_object(self._cache)

        return self._to_dict(self._cache)

    def get_range(self, start: int, end: int) -> Dict[str, Any]:
        """
        获取指定时间范围的数据。

        Args:
            start: 起始索引（包含）
            end: 结束索引（不包含）

        Returns:
            字典格式数据

        Raises:
            RuntimeError: CSV 数据未加载
            ValueError: 参数错误
        """
        if self._cache is None:
            raise CsvNotLoadedError()

        total = len(self._cache.timestamps)
        start = max(0, start)
        end = min(total, end)

        if start >= end:
            raise ValueError(f"参数错误: start({start}) >= end({end})")

        range_data = CsvData(
            meta=CsvMeta(
                total_timestamps=total,
                sat_count=self._cache.meta.sat_count,
                total_rows=sum(len(d) for d in self._cache.data[start:end]),
                format=self._cache.meta.format,
            ),
            columns=self._cache.columns,
            timestamps=self._cache.timestamps[start:end],
            data=self._cache.data[start:end],
        )

        return self._to_dict(range_data)

    def get_info(self) -> Dict[str, Any]:
        """
        获取 CSV 元信息（不含数据）。

        Returns:
            字典格式元信息

        Raises:
            RuntimeError: CSV 数据未加载
        """
        if self._cache is None:
            raise CsvNotLoadedError()

        return {
            "meta": {
                "total_timestamps": self._cache.meta.total_timestamps,
                "sat_count": self._cache.meta.sat_count,
                "total_rows": self._cache.meta.total_rows,
                "load_time_ms": self._cache.meta.load_time_ms,
                "format": self._cache.meta.format,
            },
            "columns": self._cache.columns,
            "api_endpoints": {
                "full_data": "/api/csv-data",
                "info": "/api/csv-info",
                "range": "/api/csv-range?start=0&end=100",
                "object_format": "/api/csv-data?format=object",
            },
        }

    def compress_json(self, data: Dict[str, Any]) -> bytes:
        """
        将数据序列化为 JSON 并压缩。

        Args:
            data: 字典数据

        Returns:
            压缩后的字节数据
        """
        json_bytes = json.dumps(data, separators=(",", ":")).encode("utf-8")
        if self._compress:
            return gzip.compress(json_bytes)
        return json_bytes

    def _parse_compact(self, csv_path: str) -> CsvData:
        """
        解析 CSV 文件为紧凑格式。

        紧凑格式使用数组而非对象，减少 JSON 体积约 40%。
        """
        columns = ["sat_id", "a", "e", "i", "OMG", "omg", "f", "X", "Y", "Z", "Vx", "Vy", "Vz"]

        grouped: Dict[str, List[List[Any]]] = {}

        with open(csv_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                ts = row["timestamp"]
                sat_array = [
                    int(row["sat_id"]),
                    float(row["a"]),
                    float(row["e"]),
                    float(row["i"]),
                    float(row["OMG"]),
                    float(row["omg"]),
                    float(row["f"]),
                    float(row["X"]),
                    float(row["Y"]),
                    float(row["Z"]),
                    float(row["Vx"]),
                    float(row["Vy"]),
                    float(row["Vz"]),
                ]

                if ts not in grouped:
                    grouped[ts] = []
                grouped[ts].append(sat_array)

        timestamps = sorted(grouped.keys())
        data = [grouped[ts] for ts in timestamps]

        total_rows = sum(len(d) for d in data)
        sat_count = len(data[0]) if data else 0

        return CsvData(
            meta=CsvMeta(
                total_timestamps=len(timestamps),
                sat_count=sat_count,
                total_rows=total_rows,
                format="compact",
            ),
            columns=columns,
            timestamps=timestamps,
            data=data,
        )

    def _convert_to_object(self, csv_data: CsvData) -> Dict[str, Any]:
        """将紧凑格式转换为对象格式"""
        columns = csv_data.columns
        result = {
            "meta": {
                "total_timestamps": csv_data.meta.total_timestamps,
                "sat_count": csv_data.meta.sat_count,
                "total_rows": csv_data.meta.total_rows,
                "load_time_ms": csv_data.meta.load_time_ms,
                "format": "object",
            },
            "timestamps": csv_data.timestamps,
            "data": [],
        }

        for frame in csv_data.data:
            frame_objects = []
            for sat_array in frame:
                sat_obj = {columns[i]: sat_array[i] for i in range(len(columns))}
                frame_objects.append(sat_obj)
            result["data"].append(frame_objects)

        return result

    def _to_dict(self, csv_data: CsvData) -> Dict[str, Any]:
        """将 CsvData 转换为字典"""
        return {
            "meta": {
                "total_timestamps": csv_data.meta.total_timestamps,
                "sat_count": csv_data.meta.sat_count,
                "total_rows": csv_data.meta.total_rows,
                "load_time_ms": csv_data.meta.load_time_ms,
                "format": csv_data.meta.format,
            },
            "columns": csv_data.columns,
            "timestamps": csv_data.timestamps,
            "data": csv_data.data,
        }

    def __repr__(self) -> str:
        if self._cache is None:
            return "CsvService(not loaded)"
        return (
            f"CsvService(path='{self._csv_path}', "
            f"timestamps={self._cache.meta.total_timestamps}, "
            f"sats={self._cache.meta.sat_count})"
        )

"""
环形缓冲区

用于缓存轨道递推结果，支持流式推送。
"""

from __future__ import annotations
from typing import TypeVar, Generic, List, Optional

T = TypeVar('T')


class RingBuffer(Generic[T]):
    """
    泛型环形缓冲区。
    
    支持任意类型的元素，达到容量后拒绝追加（而非覆盖）。
    用于缓存 FrameData 或 numpy 数组。
    """
    
    def __init__(self, capacity: int = 3600):
        """
        创建环形缓冲区。
        
        Args:
            capacity: 最大容量
        """
        if capacity <= 0:
            raise ValueError(f"容量必须为正数，得到 {capacity}")
        self._capacity = capacity
        self._data: List[T] = []
    
    @property
    def capacity(self) -> int:
        """缓冲区容量"""
        return self._capacity
    
    @property
    def length(self) -> int:
        """当前元素数量"""
        return len(self._data)
    
    def is_full(self) -> bool:
        """是否已满"""
        return len(self._data) >= self._capacity
    
    def is_empty(self) -> bool:
        """是否为空"""
        return len(self._data) == 0
    
    def append(self, item: T) -> bool:
        """
        追加元素。
        
        Args:
            item: 要追加的元素
        
        Returns:
            是否成功追加（满时返回 False）
        """
        if self.is_full():
            return False
        self._data.append(item)
        return True
    
    def pop_front(self, n: int) -> List[T]:
        """
        弹出前 N 个元素。
        
        Args:
            n: 弹出数量
        
        Returns:
            弹出的元素列表
        """
        if n <= 0:
            return []
        if n >= len(self._data):
            result = self._data[:]
            self._data = []
            return result
        result = self._data[:n]
        self._data = self._data[n:]
        return result
    
    def peek(self, n: int) -> List[T]:
        """
        查看前 N 个元素（不弹出）。
        
        Args:
            n: 查看数量
        
        Returns:
            前 N 个元素
        """
        return self._data[:n]
    
    def clear(self) -> None:
        """清空缓冲区"""
        self._data = []
    
    def __len__(self) -> int:
        return len(self._data)
    
    def __repr__(self) -> str:
        return f"RingBuffer(capacity={self._capacity}, length={len(self._data)})"

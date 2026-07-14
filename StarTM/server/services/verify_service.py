"""
互校验服务

管理卫星间的互校验流程：
- 维护邻居状态记录表
- 处理VerifyRequest请求
- 处理VerifyResponse响应
- 验证数据一致性
"""

from __future__ import annotations
from typing import Dict, List, Optional
from dataclasses import dataclass, field

from ..protocol.transfer_frame import SubMessage


@dataclass
class StoredSubMessage:
    """存储的子消息记录"""
    msg_id: int
    dest_id: int
    data: bytes
    crc_msg: int


class VerifyService:
    """
    互校验服务
    
    维护每颗卫星的邻居状态记录，处理互校验请求和响应。
    
    工作流程:
    1. 地面站发送灯光控制帧，包含自身+邻星的SubMessage
    2. 卫星接收后存储邻星SubMessage到VerifyService
    3. 自校验失败时，向邻星发送VerifyRequest
    4. 邻星返回VerifyResponse（完整子消息）
    5. 对比多个邻星返回的CRC，一致则恢复成功
    """
    
    def __init__(self, num_satellites: int = 22):
        """
        初始化互校验服务
        
        Args:
            num_satellites: 卫星总数
        """
        self._num_satellites = num_satellites
        # 每颗卫星存储的子消息：{sat_id: {msg_id: StoredSubMessage}}
        self._stored_messages: Dict[int, Dict[int, StoredSubMessage]] = {
            i: {} for i in range(num_satellites)
        }
        # 每颗卫星的邻居列表：{sat_id: [neighbor_id, ...]}
        self._neighbor_map: Dict[int, List[int]] = {
            i: [] for i in range(num_satellites)
        }
    
    def set_neighbor_map(self, neighbor_map: Dict[int, List[int]]) -> None:
        """
        设置邻居拓扑
        
        Args:
            neighbor_map: {sat_id: [neighbor_id, ...], ...}
        """
        self._neighbor_map = neighbor_map
    
    def get_neighbors(self, sat_id: int) -> List[int]:
        """
        获取卫星的邻居列表
        
        Args:
            sat_id: 卫星编号
            
        Returns:
            邻居sat_id列表
        """
        return self._neighbor_map.get(sat_id, [])
    
    def store_submessages(
        self,
        sat_id: int,
        messages: List[SubMessage],
    ) -> None:
        """
        存储接收到的子消息
        
        Args:
            sat_id: 接收方卫星编号
            messages: 子消息列表（包含自身+邻星的SubMessage）
        """
        if sat_id not in self._stored_messages:
            return
        
        for msg in messages:
            stored = StoredSubMessage(
                msg_id=msg.msg_id,
                dest_id=msg.dest_id,
                data=msg.data,
                crc_msg=msg.crc_msg,
            )
            self._stored_messages[sat_id][msg.msg_id] = stored
    
    def get_stored_message(
        self,
        sat_id: int,
        msg_id: int,
    ) -> Optional[StoredSubMessage]:
        """
        获取存储的子消息
        
        Args:
            sat_id: 卫星编号
            msg_id: 子消息序号
            
        Returns:
            存储的子消息，不存在则返回None
        """
        return self._stored_messages.get(sat_id, {}).get(msg_id)
    
    def clear_satellite_data(self, sat_id: int) -> None:
        """
        清除指定卫星的存储数据
        
        Args:
            sat_id: 卫星编号
        """
        if sat_id in self._stored_messages:
            self._stored_messages[sat_id] = {}
    
    def reset_all(self) -> None:
        """重置所有数据"""
        self._stored_messages = {i: {} for i in range(self._num_satellites)}
        self._neighbor_map = {i: [] for i in range(self._num_satellites)}

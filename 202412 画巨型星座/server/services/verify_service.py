"""
互校验服务

管理卫星间的互校验流程：
- 维护邻居状态记录表
- 处理VerifyRequest请求
- 处理VerifyResponse响应
- 验证数据一致性
"""

from __future__ import annotations
import struct
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, field

from ..protocol.constants import MsgType
from ..protocol.transfer_frame import SubMessage, calc_crc32


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
    
    def handle_verify_request(
        self,
        requester_id: int,
        target_msg_id: int,
    ) -> List[SubMessage]:
        """
        处理VerifyRequest：查找并返回请求的子消息
        
        Args:
            requester_id: 请求方sat_id（当前卫星）
            target_msg_id: 要查找的子消息序号
            
        Returns:
            VerifyResponse子消息列表（每颗邻居返回一个）
        """
        stored = self.get_stored_message(requester_id, target_msg_id)
        if stored is None:
            return []
        
        # 构造VerifyResponse子消息
        # Data字段只包含原始子消息的data内容
        response_msg = SubMessage(
            msg_id=target_msg_id,
            dest_id=stored.dest_id,
            data=stored.data,
        )
        # CRC_msg设置为存储的CRC值
        response_msg.crc_msg = stored.crc_msg
        
        return [response_msg]
    
    def verify_responses(
        self,
        responses: List[SubMessage],
        target_sat_id: int,
        target_msg_id: int,
    ) -> Tuple[bool, Optional[bytes], str]:
        """
        验证多个邻居返回的响应是否一致
        
        Args:
            responses: VerifyResponse子消息列表
            target_sat_id: 目标卫星编号
            target_msg_id: 目标子消息序号
            
        Returns:
            (是否一致, 恢复的data, 错误信息)
        """
        if len(responses) < 1:
            return False, None, "No responses received"
        
        # 对每个响应重新计算CRC并对比
        crc_values: List[int] = []
        data_values: List[bytes] = []
        
        for resp in responses:
            # 用Dest_ID + Data_Length + Data重新计算CRC
            crc_data = struct.pack(">HH", resp.dest_id, len(resp.data)) + resp.data
            computed_crc = calc_crc32(crc_data)
            crc_values.append(computed_crc)
            data_values.append(resp.data)
        
        # 检查所有CRC是否一致
        if len(set(crc_values)) == 1:
            # 全部一致，返回data
            return True, data_values[0], ""
        else:
            # 不一致，尝试多数表决
            crc_count: Dict[int, int] = {}
            for crc in crc_values:
                crc_count[crc] = crc_count.get(crc, 0) + 1
            
            # 取出现次数最多的CRC
            majority_crc = max(crc_count, key=crc_count.get)
            majority_count = crc_count[majority_crc]
            
            if majority_count > len(crc_values) // 2:
                # 多数一致，使用多数结果
                majority_idx = crc_values.index(majority_crc)
                return True, data_values[majority_idx], ""
            else:
                return False, None, "CRC mismatch among neighbors"
    
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

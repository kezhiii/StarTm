"""
灯光控制服务

管理卫星编队的灯光状态，处理灯光控制命令。
支持可选的数据库持久化。
"""

from __future__ import annotations
from typing import Dict, Tuple, Optional

from ..protocol.constants import LightCommand


class LightControlService:
    """
    灯光控制服务
    
    管理所有卫星的灯光状态，提供设置、获取、切换灯光的接口。
    支持可选的数据库持久化（通过 satellite_repo）。
    
    灯光控制数据格式（SubMessage.Data）:
    [Command_Type(1B), Light_State(1B)]
    - Command_Type: 0x01=开灯, 0x02=关灯
    - Light_State: 0x00=灭, 0x01=亮
    """
    
    def __init__(self, num_satellites: int = 22, satellite_repo=None):
        """
        初始化灯光控制服务
        
        Args:
            num_satellites: 卫星数量（默认22颗）
            satellite_repo: SatelliteRepository 实例（可选，用于 DB 持久化）
        """
        self._light_states: Dict[int, bool] = {
            i: False for i in range(num_satellites)
        }
        self._num_satellites = num_satellites
        self._satellite_repo = satellite_repo
    
    def set_satellite_repo(self, satellite_repo) -> None:
        """设置卫星仓库（用于 DB 持久化）"""
        self._satellite_repo = satellite_repo
    
    def set_light(self, sat_id: int, command: LightCommand) -> bool:
        """
        设置卫星灯光状态
        
        Args:
            sat_id: 卫星编号
            command: 灯光命令（TURN_ON/TURN_OFF）
            
        Returns:
            是否设置成功
            
        Raises:
            ValueError: 卫星编号无效
        """
        if sat_id < 0 or sat_id >= self._num_satellites:
            raise ValueError(f"Invalid satellite ID: {sat_id}")
        
        if command == LightCommand.TURN_ON:
            self._light_states[sat_id] = True
        elif command == LightCommand.TURN_OFF:
            self._light_states[sat_id] = False
        else:
            raise ValueError(f"Unknown light command: {command}")
        
        print(f"[LightControl] 卫星{sat_id} 灯光: {'开' if self._light_states[sat_id] else '关'}")
        return True
    
    async def set_light_async(self, sat_id: int, command: LightCommand) -> bool:
        """
        设置卫星灯光状态并持久化到 DB
        
        Args:
            sat_id: 卫星编号
            command: 灯光命令
            
        Returns:
            是否设置成功
        """
        self.set_light(sat_id, command)
        
        if self._satellite_repo:
            light_state = command == LightCommand.TURN_ON
            await self._satellite_repo.update_light_state(sat_id, light_state)
        
        return True
    
    def get_light(self, sat_id: int) -> bool:
        """
        获取卫星灯光状态
        
        Args:
            sat_id: 卫星编号
            
        Returns:
            灯光状态（True=开, False=关）
        """
        if sat_id < 0 or sat_id >= self._num_satellites:
            return False
        return self._light_states.get(sat_id, False)
    
    def toggle_light(self, sat_id: int) -> bool:
        """
        切换卫星灯光状态
        
        Args:
            sat_id: 卫星编号
            
        Returns:
            切换后的状态
        """
        current = self.get_light(sat_id)
        new_state = not current
        command = LightCommand.TURN_ON if new_state else LightCommand.TURN_OFF
        self.set_light(sat_id, command)
        return new_state
    
    def get_all_states(self) -> Dict[int, bool]:
        """
        获取所有卫星灯光状态
        
        Returns:
            {sat_id: light_state, ...}
        """
        return dict(self._light_states)
    
    def parse_light_data(self, data: bytes) -> Tuple[LightCommand, LightCommand]:
        """
        解析灯光控制数据
        
        Args:
            data: SubMessage.Data字节（2字节）
            
        Returns:
            (Command_Type, Light_State)
            
        Raises:
            ValueError: 数据长度不正确
        """
        if len(data) != 2:
            raise ValueError(f"Invalid light data length: {len(data)}, expected 2")
        
        command_type = LightCommand(data[0])
        light_state = LightCommand(data[1])
        return command_type, light_state
    
    def apply_light_data(self, sat_id: int, data: bytes) -> bool:
        """
        解析并应用灯光控制数据
        
        Args:
            sat_id: 卫星编号
            data: SubMessage.Data字节
            
        Returns:
            是否应用成功
        """
        command_type, light_state = self.parse_light_data(data)
        
        if command_type == LightCommand.TURN_ON:
            return self.set_light(sat_id, LightCommand.TURN_ON)
        elif command_type == LightCommand.TURN_OFF:
            return self.set_light(sat_id, LightCommand.TURN_OFF)
        else:
            raise ValueError(f"Unknown command type: {command_type}")
    
    def reset_all(self) -> None:
        """重置所有卫星灯光状态为关"""
        for sat_id in self._light_states:
            self._light_states[sat_id] = False
        print("[LightControl] 所有卫星灯光已重置")

"""
LDPC编解码器

实现LDPC（Low-Density Parity-Check）编码和解码，
用于通信协议帧的外层校验。

帧结构:
| LDPC_Preamble(2B) | Length(2B) | LDPC Encoded Bits (variable) |

使用 pyldpc 库实现真正的LDPC编码和解码：
- 编码: 使用LDPC生成矩阵G将数据比特编码为码字
- 解码: 使用置信传播（Belief Propagation）算法解码，支持错误纠正
"""

import struct
import binascii
import numpy as np
from typing import Optional, Tuple

from .constants import LDPC_CODE_RATE, LDPC_BLOCK_SIZE, LDPC_PREAMBLE

try:
    from pyldpc import make_ldpc, encode, decode, get_message
    HAS_PYLDPC = True
except ImportError:
    HAS_PYLDPC = False


class LDPCCodec:
    """
    LDPC编解码器
    
    使用 pyldpc 库实现真正的LDPC编码/解码，支持错误纠正。
    
    编码流程:
    1. 将字节数据转换为比特流
    2. 补齐到信息比特数k的倍数
    3. 分块使用LDPC生成矩阵G编码
    4. 添加Preamble和原始长度头
    
    解码流程:
    1. 检测Preamble，提取原始长度
    2. 分块使用置信传播算法解码
    3. 恢复原始比特流并截取原始长度
    """
    
    def __init__(self, code_rate: float = LDPC_CODE_RATE, block_size: int = LDPC_BLOCK_SIZE):
        """
        初始化LDPC编解码器
        
        Args:
            code_rate: LDPC码率 (0.5表示编码后数据长度翻倍)
            block_size: 块大小（字节）
        """
        self.code_rate = code_rate
        self.block_size = block_size
        
        # LDPC参数 (n=15, k=8, 码率≈0.53)
        # 约束: d_c 必须整除 n, d_v 必须整除 (n-k)
        self._n = 15       # 码字长度（比特）
        self._d_v = 3      # 变量节点度 (3 整除 9)
        self._d_c = 5      # 校验节点度 (5 整除 15)
        self._snr = 10.0   # 信噪比（dB）
        self._seed = 42    # 固定种子确保编解码矩阵一致
        
        # 生成LDPC矩阵（使用固定种子确保跨实例一致性）
        if HAS_PYLDPC:
            self._H, self._G = make_ldpc(
                self._n, self._d_v, self._d_c,
                systematic=True, sparse=True, seed=self._seed
            )
            self._k = self._G.shape[1]  # 信息比特数
        else:
            self._H = self._G = None
            self._k = 0
    
    def _bytes_to_bits(self, data: bytes) -> np.ndarray:
        """字节数组转比特数组"""
        bits = []
        for byte in data:
            for i in range(7, -1, -1):
                bits.append((byte >> i) & 1)
        return np.array(bits, dtype=int)
    
    def _bits_to_bytes(self, bits: np.ndarray) -> bytes:
        """比特数组转字节数组"""
        # 补齐到8的倍数
        remainder = len(bits) % 8
        if remainder:
            bits = np.pad(bits, (0, 8 - remainder), 'constant')
        
        result = bytearray()
        for i in range(0, len(bits), 8):
            byte = 0
            for j in range(8):
                byte = (byte << 1) | int(bits[i + j])
            result.append(byte)
        return bytes(result)
    
    def _pad_bits(self, bits: np.ndarray) -> Tuple[np.ndarray, int]:
        """补齐比特到信息比特数k的倍数，返回(补齐后的比特, 原始长度)"""
        original_len = len(bits)
        remainder = original_len % self._k
        if remainder:
            pad_len = self._k - remainder
            bits = np.pad(bits, (0, pad_len), 'constant')
        return bits, original_len
    
    def encode(self, data: bytes) -> bytes:
        """
        编码数据
        
        Args:
            data: 原始数据（从Sync到CRC的帧数据）
            
        Returns:
            LDPC_Preamble + 原始比特长度(2B) + LDPC编码后数据
        """
        if not data:
            return LDPC_PREAMBLE + struct.pack(">H", 0)
        
        if not HAS_PYLDPC:
            return self._fallback_encode(data)
        
        # 字节→比特
        bits = self._bytes_to_bits(data)
        bits, original_bit_len = self._pad_bits(bits)
        
        # 分块编码（使用 G 矩阵直接计算，不加噪声）
        encoded_blocks = []
        for i in range(0, len(bits), self._k):
            block = bits[i:i + self._k]
            if len(block) < self._k:
                block = np.pad(block, (0, self._k - len(block)), 'constant')
            # 干净编码: codeword = G @ message mod 2
            codeword = np.mod(self._G @ block, 2).astype(int)
            encoded_blocks.append(codeword)
        
        # 拼接所有编码块
        encoded_bits = np.concatenate(encoded_blocks)
        
        # 比特→字节
        encoded_bytes = self._bits_to_bytes(encoded_bits)
        
        # 组装: Preamble + 原始比特长度 + 编码后数据
        result = LDPC_PREAMBLE + struct.pack(">H", original_bit_len) + encoded_bytes
        
        return result
    
    def _fallback_encode(self, data: bytes) -> bytes:
        """降级为CRC32编码（pyldpc未安装时）"""
        crc = binascii.crc32(data) & 0xFFFFFFFF
        parity = struct.pack(">I", crc)
        length = len(data)
        return LDPC_PREAMBLE + struct.pack(">H", length) + data + parity
    
    def decode(self, data: bytes) -> bytes:
        """
        解码数据
        
        Args:
            data: LDPC编码后的数据
            
        Returns:
            原始数据
            
        Raises:
            ValueError: 数据格式错误或校验失败
        """
        if len(data) < len(LDPC_PREAMBLE) + 2:
            raise ValueError("LDPC data too short")
        
        # 验证Preamble
        if data[:len(LDPC_PREAMBLE)] != LDPC_PREAMBLE:
            raise ValueError("Invalid LDPC preamble")
        
        # 提取原始信息比特长度
        offset = len(LDPC_PREAMBLE)
        original_bit_len = struct.unpack(">H", data[offset:offset+2])[0]
        offset += 2
        
        if original_bit_len == 0:
            return b""
        
        encoded_data = data[offset:]
        
        if not HAS_PYLDPC:
            return self._fallback_decode(encoded_data)
        
        # 计算块数和总编码比特数
        n_blocks = (original_bit_len + self._k - 1) // self._k
        total_encoded_bits = n_blocks * self._n
        
        # 转换为比特，只取需要的编码比特
        all_bits = self._bytes_to_bits(encoded_data)
        encoded_bits = all_bits[:total_encoded_bits]
        
        # 分块解码
        decoded_blocks = []
        for i in range(n_blocks):
            block = encoded_bits[i * self._n:(i + 1) * self._n]
            if len(block) < self._n:
                block = np.pad(block, (0, self._n - len(block)), 'constant')
            
            # BPSK: 0→+1, 1→-1
            soft_bits = np.where(block == 0, 1.0, -1.0).astype(float)
            # 使用BP算法纠正错误
            corrected = decode(self._H, soft_bits, self._snr)
            # 从纠正后的码字中提取信息比特
            decoded = get_message(self._G, corrected)
            decoded_blocks.append(decoded)
        
        # 拼接所有解码块
        decoded_bits = np.concatenate(decoded_blocks)
        
        # 截取原始信息比特长度
        decoded_bits = decoded_bits[:original_bit_len]
        
        # 转换为字节
        return self._bits_to_bytes(decoded_bits)
    
    def _fallback_decode(self, encoded_data: bytes) -> bytes:
        """降级为CRC32解码（pyldpc未安装时）"""
        # CRC32格式: [原始数据][CRC32(4B)]
        if len(encoded_data) < 4:
            raise ValueError("Fallback data too short")
        
        raw_data = encoded_data[:-4]
        received_parity = encoded_data[-4:]
        computed_parity = struct.pack(">I", binascii.crc32(raw_data) & 0xFFFFFFFF)
        
        if computed_parity != received_parity:
            raise ValueError("LDPC parity check failed, unable to correct")
        
        return raw_data
    
    def verify(self, data: bytes) -> bool:
        """
        验证LDPC数据格式
        
        Args:
            data: 完整的LDPC编码数据
            
        Returns:
            格式是否有效
        """
        if len(data) < len(LDPC_PREAMBLE) + 2:
            return False
        
        if data[:len(LDPC_PREAMBLE)] != LDPC_PREAMBLE:
            return False
        
        offset = len(LDPC_PREAMBLE)
        original_len = struct.unpack(">H", data[offset:offset+2])[0]
        
        if original_len == 0:
            return True
        
        return len(data) > offset + 2
    
    @property
    def has_real_ldpc(self) -> bool:
        """是否使用真正的LDPC编码"""
        return HAS_PYLDPC

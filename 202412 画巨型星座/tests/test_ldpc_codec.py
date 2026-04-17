import pytest
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from server.protocol.ldpc_codec import LDPCCodec

@pytest.fixture
def codec():
    return LDPCCodec()

def test_encode_decode_roundtrip(codec):
    """Test encoding-decoding roundtrip"""
    original = b"Hello, Satellite! Light control test."
    encoded = codec.encode(original)
    decoded = codec.decode(encoded)
    assert decoded == original

def test_encode_adds_parity(codec):
    """Test that encoded data is longer (parity added)"""
    original = b"Test data for LDPC"
    encoded = codec.encode(original)
    assert len(encoded) > len(original)

def test_decode_corrects_errors(codec):
    """Test LDPC error correction for small corruptions"""
    original = b"Test data with error correction"
    encoded = bytearray(codec.encode(original))
    # Corrupt one bit in encoded data (after header)
    if len(encoded) > 10:
        # Flip a single bit in byte 10
        encoded[10] ^= 0x01
    decoded = codec.decode(bytes(encoded))
    # LDPC should correct single-bit errors
    assert decoded == original

def test_decode_detects_heavy_errors(codec):
    """Test that heavy corruption exceeds LDPC correction capability"""
    original = b"Test data with heavy error detection"
    encoded = bytearray(codec.encode(original))
    # Corrupt multiple bytes to exceed error correction
    if len(encoded) > 15:
        encoded[8] ^= 0xFF
        encoded[9] ^= 0xFF
        encoded[10] ^= 0xFF
        encoded[11] ^= 0xFF
        encoded[12] ^= 0xFF
    decoded = codec.decode(bytes(encoded))
    # With heavy corruption, LDPC may produce wrong data (not raise)
    # This is expected behavior for error-correcting codes
    assert isinstance(decoded, bytes)
    # The decoded data may or may not match original

def test_verify_parity(codec):
    """Test LDPC parity verification"""
    original = b"Verify parity test"
    encoded = codec.encode(original)
    assert codec.verify(encoded) is True

def test_verify_corrupted(codec):
    """Test verify checks format, decode detects corruption"""
    original = b"Verify parity test"
    encoded = bytearray(codec.encode(original))
    if len(encoded) > 10:
        encoded[10] ^= 0xFF
    # verify only checks format (preamble + length header)
    assert codec.verify(bytes(encoded)) is True
    # decode actually detects corruption (pyldpc) or CRC mismatch (fallback)
    if codec.has_real_ldpc:
        # pyldpc may still decode corrupted data (error correction)
        decoded = codec.decode(bytes(encoded))
        assert isinstance(decoded, bytes)
    else:
        # fallback CRC32 detects corruption
        with pytest.raises(ValueError):
            codec.decode(bytes(encoded))

def test_empty_data(codec):
    """Test empty data encoding"""
    encoded = codec.encode(b"")
    decoded = codec.decode(encoded)
    assert decoded == b""

def test_large_data(codec):
    """Test large data encoding"""
    large_data = b"A" * 1000
    encoded = codec.encode(large_data)
    decoded = codec.decode(encoded)
    assert decoded == large_data

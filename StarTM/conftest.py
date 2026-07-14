"""
Pytest 配置文件

确保测试可以从项目根目录正确导入模块。
"""

import sys
from pathlib import Path

# 将项目根目录添加到 Python 路径
project_root = str(Path(__file__).parent)
if project_root not in sys.path:
    sys.path.insert(0, project_root)

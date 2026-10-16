# phase-00 测试记录

运行方式：有头 Chrome + CDP 设备度量覆盖，真实访问 http://127.0.0.1:8000/sim/。

## 结果

- **失败项**：无

## 逐项

```
== phase-00 真实浏览器验收 ==
PASS  桥接就绪  等待 8.0s
PASS  加载示例  已就绪 (1s)
布局 1792x864: {"topbar": [1792, 56, 0, 0], "rail": [323, 658, 8, 56], "scene": [1043, 658, 339, 56], "console": [394, 658, 1390, 56], "transport": [1792, 142, 0, 722], "iframeInner": [1042, 657], "canvasCss": [1042, 657], "canvasMatchesScene": true, "ovf": [0, 0], "verticalText": [], "meta": {"mission": "TM-V0-SIM · FreeDrift-Synthetic", "kind": "固定结果回放", "m": "3 颗 / 1 s / 86401 历元", "scene": "TM-V0-SIM"}, "cfg": [{"t": "轨道参数待接入计算引擎", "dis": true, "h": 64, "title": true}, {"t": "姿态参数待接入计算引擎", "dis": true, "h": 64, "title": true}, {"t": "能源参数待接入计算引擎", "dis": true, "h": 64, "title": true}, {"t": "热控参数待接入计算引擎", "dis": true, "h": 64, "title": true}]}
PASS  五区不重叠且场景有实际空间  scene=[1043, 658, 339, 56] ovf=[0, 0]
PASS  画布贴合 .scene 容器  canvas=[1042, 657] scene=[1043, 658, 339, 56]
PASS  浮层在场景容器内  
PASS  无逐字竖排  []
PASS  参数版本死字段已删除  
PASS  场景标识来自真实数据  TM-V0-SIM · FreeDrift-Synthetic
PASS  数据性质标注为固定结果回放  固定结果回放
PASS  卫星/采样/历元为真实元数据  3 颗 / 1 s / 86401 历元
PASS  四个配置入口存在且禁用  [{"t": "轨道参数待接入计算引擎", "dis": true, "h": 64, "title": true}, {"t": "姿态参数待接入计算引擎", "dis": true, "h": 64, "title": true}, {"t": "能源参数待接入计算引擎", "dis": true, "h": 64, "title": true}, {"t": "热控参数待接入计算引擎", "dis": true, "h": 64, "title": true}]
PASS  CSV 模式已接管  csv
PASS  rAF 单一且在跑  60.0 fps
PASS  播放推进  T+00:00:03 / 运行中 1×
PASS  暂停后不再推进  T+00:00:03 / 已暂停
PASS  时间轴拖动同步  {"t": "T+12:00:00", "u": "2026-09-13 16:00:00", "st": "43201 / 86401"}
PASS  选星不重置时间  {"t": "T+12:00:00", "k": "TM0S2", "i": 1}
PASS  收起两栏后场景未被压扁  scene=[1760, 658, 16, 56] canvas=[1758, 657]
PASS  切视角不重建 renderer、rAF 不中断  sameNode=True Δticks=122
布局 1366x768: scene=[698, 562, 302, 56] canvas=[697, 561] matches=True ovf=[0, 0] vertical=[] cfg=4
PASS  1366x768 布局无溢出/无竖排  [0, 0]
PASS  1366x768 画布贴合容器  scene=[698, 562, 302, 56]
布局 1280x720: scene=[970, 514, 302, 56] canvas=[969, 513] matches=True ovf=[0, 0] vertical=[] cfg=4
PASS  1280x720 布局无溢出/无竖排  [0, 0]
PASS  1280x720 画布贴合容器  scene=[970, 514, 302, 56]
右栏各标签实测: {"formation": {"hero": [], "charts": ["编队边长"]}, "orbit": {"hero": ["轨道高度598.33km", "速度7.56km/s", "站心斜距8993.2km", "仰角-39.44°"], "charts": ["目标区太阳高度（合肥）"]}, "attitude": {"hero": ["姿态模式nadir", "太阳入射角86.55°", "有效投影系数0.06", "目标离轴角44.87°"], "charts": ["目标区太阳高度（合肥）"]}, "power": {"hero": ["发电功率暂不可用", "用电功率暂不可用", "电池 SOC暂不可用", "电量裕度暂不可用"], "charts": ["目标区太阳高度（合肥）"]}, "thermal": {"hero": ["主要设备温度暂不可用", "设备发热暂不可用", "外热流暂不可用", "超限节点数暂不可用"], "charts": ["目标区太阳高度（合肥）"]}}
PASS  控制台无 error  []
PASS  无未捕获异常  []
```

## 截图

- `screenshots/phase-00/01-1792-overview.png`
- `screenshots/phase-00/02-1792-panels-collapsed.png`
- `screenshots/phase-00/03-1792-center.png`
- `screenshots/phase-00/04-1366-rail-collapsed.png`
- `screenshots/phase-00/04-1366x768-overview.png`
- `screenshots/phase-00/05-1280x720-overview.png`
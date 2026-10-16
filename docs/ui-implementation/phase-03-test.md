# phase-03 测试记录

运行方式：有头 Chrome + CDP 设备度量覆盖，真实访问 http://127.0.0.1:8000/sim/。

## 结果

- **失败项**：无

## 逐项

```
[等待渲染进程 初始] #0 readyState=interactive loopTicks=-1
[等待渲染进程 初始] #1 readyState=complete loopTicks=0
PASS  渲染进程能应答（先让它把 38MB+64MB 数据吞完，否则后面全是超时假失败）  见逐次日志
PASS  页面可见（隐藏会冻结 rAF 与合成器，之后全是假失败）  visibilityState=visible
== phase-03 真实浏览器验收 ==
PASS  桥接就绪  等待 0.0s
PASS  加载示例  已就绪 (1s)
布局 1792x864: {"topbar": [1792, 56, 0, 0], "rail": [323, 658, 8, 56], "scene": [1043, 658, 339, 56], "console": [394, 658, 1390, 56], "transport": [1792, 142, 0, 722], "iframeInner": [1042, 657], "canvasCss": [1042, 657], "canvasMatchesScene": true, "ovf": [0, 0], "verticalText": [], "meta": {"mission": "TM-V0-SIM · FreeDrift-Synthetic", "kind": "固定结果回放", "m": "3 颗 / 1 s / 86401 历元", "scene": "TM-V0-SIM"}, "cfg": [{"t": "轨道参数查看", "dis": false, "h": 64, "title": true}, {"t": "姿态参数查看", "dis": false, "h": 64, "title": true}, {"t": "能源参数查看", "dis": false, "h": 64, "title": true}, {"t": "热控参数查看", "dis": false, "h": 64, "title": true}]}
PASS  五区不重叠且场景有实际空间  scene=[1043, 658, 339, 56] ovf=[0, 0]
PASS  画布贴合 .scene 容器  canvas=[1042, 657] scene=[1043, 658, 339, 56]
PASS  浮层在场景容器内  
PASS  无逐字竖排  []
PASS  参数版本死字段已删除  
PASS  场景标识来自真实数据  TM-V0-SIM · FreeDrift-Synthetic
PASS  数据性质标注为固定结果回放  固定结果回放
PASS  卫星/采样/历元为真实元数据  3 颗 / 1 s / 86401 历元
PASS  四个配置入口存在、可点且带说明（Phase 4 已接通抽屉；Phase 1 时期望是禁用占位）  [{"t": "轨道参数查看", "dis": false, "h": 64, "title": true}, {"t": "姿态参数查看", "dis": false, "h": 64, "title": true}, {"t": "能源参数查看", "dis": false, "h": 64, "title": true}, {"t": "热控参数查看", "dis": false, "h": 64, "title": true}]
PASS  CSV 模式已接管  csv
[fps 探针] 刚 attach 完: 60.5 fps (Δ121 / 2.0s, vis=visible)
[强制合成帧] 122.0 tick / 2.05s（期间逼帧 19 次, vis=visible）
PASS  循环在跑：强制合成帧口径的 tick 速率落在 25–120（墙钟 60.5 fps 只作参考）  59.4 tick/s
全景机位 |cam|=153.2 单位, 场景高 656 px -> 地球直径占画布高 45.0%
PASS  地球直径落在 38%-52%  45.0%
PASS  三条轨迹线三色互不相同  ['38a9ff', '29d7d0', 'ffb83f']
PASS  轨迹环身份色 = CSS 身份色变量（不再各写一套十六进制）  ['38a9ff', '29d7d0', 'ffb83f'] vs ['38a9ff', '29d7d0', 'ffb83f']
PASS  基础光在 rebuildView 之后仍然在场景里（半球光曾被清场误删）  ['AmbientLight', 'HemisphereLight', 'DirectionalLight']
PASS  三星各自有独立标签  [True, True, True]
PASS  三条引线可见，且两端分别连在卫星本体与其标签上（不是只数对象个数）  [{"vis": true, "toMesh": 0, "toLabel": 0}, {"vis": true, "toMesh": 0, "toLabel": 0}, {"vis": true, "toMesh": 0, "toLabel": 0}]
状态同步: {"afterSatTab": {"camSel": "follow", "tab": "satellite"}, "afterCamSel": {"camSel": "formation", "view": "center"}, "afterReset": {"camSel": "global", "view": "third", "tab": "satellite"}, "ground": {"camSelDisabled": true, "view": "first"}, "back": {"camSel": "global", "view": "third"}}
PASS  切单星查看 -> 相机下拉同步为 follow  {'camSel': 'follow', 'tab': 'satellite'}
PASS  选编队近景 -> 三维真的进 center  {'camSel': 'formation', 'view': 'center'}
PASS  复位 -> 控件与三维一致回到 global  {'camSel': 'global', 'view': 'third', 'tab': 'satellite'}
PASS  地面观察下相机下拉被禁用  {'camSelDisabled': True, 'view': 'first'}
PASS  回到编队总览 -> 控件与三维一致  {'camSel': 'global', 'view': 'third'}
编队近景图层可用性: {"sup": {"trails": false, "terminator": false, "labels": true, "gtrack": false, "links": false}, "disabled": ["trails", "gtrack", "links", "terminator"], "hasTerminator": false, "rings": 0, "view": "center"}
PASS  编队近景下不存在的图层被置灰  {'sup': {'trails': False, 'terminator': False, 'labels': True, 'gtrack': False, 'links': False}, 'disabled': ['trails', 'gtrack', 'links', 'terminator'], 'hasTerminator': False, 'rings': 0, 'view': 'center'}
编队局部放大窗: {"title": "编队局部放大 · 非同尺度RTN 相对位置", "w": 240, "h": 176, "foot": "S12 1.067 · S23 0.979 · S31 1.024 km", "canvas": [238, 125], "painted": 1432}
PASS  局部放大窗存在且标注非同尺度  编队局部放大 · 非同尺度RTN 相对位置
PASS  局部放大窗尺寸 220-260 x 160-190  240x176
PASS  局部放大窗真的画了内容  px=1432 foot=S12 1.067 · S23 0.979 · S31 1.024 km
PASS  XYZ 方向轴指示器已绘制  3 lines
PASS  页面可见（否则 rAF 被节流，尺寸断言全是假阴性）  visibilityState=visible
点第三颗星标签: {"before": 0, "ndc": [-0.40831624861441523, -0.1843004343189287], "x": 308, "y": 389, "after": 2, "kvSat": "TM0S3"}
PASS  点标签能选中对应卫星（与点模型同一 ID）  {'before': 0, 'ndc': [-0.40831624861441523, -0.1843004343189287], 'x': 308, 'y': 389, 'after': 2, 'kvSat': 'TM0S3'}
CSV 真值 S12=1.067 S23=0.979 S31=1.024  |  小窗页脚 S12 1.067 · S23 0.979 · S31 1.024 km
PASS  小窗边长与 formation_rtn 逐条对账  {'S12': '1.067', 'S23': '0.979', 'S31': '1.024'} vs 1.067/0.979/1.024
目标跟随实测: {"follow": {"idx": 2, "dist": 18}, "selIdx": 2, "cam": [-11.6, 0, 71.8], "ctrl": [-8.7, 0, 54], "satP": [-8.7, 0, 54], "satVis": true, "camToSat": 18.034688796871432, "ctrlToSat": 0}
PASS  目标跟随：相机锁在选中卫星附近（不是全局远景）  {"follow": {"idx": 2, "dist": 18}, "selIdx": 2, "cam": [-11.6, 0, 71.8], "ctrl": [-8.7, 0, 54], "satP": [-8.7, 0, 54], "satVis": true, "camToSat": 18.034688796871432, "ctrlToSat": 0}
PASS  目标跟随：被跟随的卫星可见  True
PASS  方向轴指示器随相机真实变化（不是画死的）  493 vs 491 字节
基准：8 张强制合成帧 -> 48 tick
PASS  rAF 循环在跑  Δticks=48
PASS  播放按倍率真的推进（比较 T+ 秒数，不拿实现自己写的文案自证）  T+ 走了 2 s / 墙钟 3 s
PASS  暂停后不再推进  T+00:00:02 / T+00:00:02
PASS  运行态文案与状态一致  运行中 1× / 已暂停
PASS  时间轴拖动同步  {"t": "T+12:00:00", "u": "2026-09-13 16:00:00", "st": "43201 / 86401"}
PASS  选星不重置时间  {"t": "T+12:00:00", "k": "TM0S2", "i": 1}
PASS  收起两栏后场景未被压扁  scene=[1760, 658, 16, 56] canvas=[1758, 657]
PASS  切视角不重建 renderer  sameNode=True
PASS  反复切换后 rAF 未累积重复循环  切换后 46 tick vs 基准 48 tick（同样 8 帧）
布局 1366x768: scene=[698, 562, 302, 56] canvas=[697, 561] matches=True ovf=[0, 0] vertical=[] cfg=4
PASS  1366x768 布局无溢出/无竖排  [0, 0]
PASS  1366x768 画布贴合容器  scene=[698, 562, 302, 56]
PASS  1366x768 编队小窗不被右栏盖住  遮挡 0, 小窗 [240, 176, 748, 429], 右栏 [350, 562, 1008, 56]
布局 1280x720: scene=[970, 514, 302, 56] canvas=[969, 513] matches=True ovf=[0, 0] vertical=[] cfg=4
PASS  1280x720 布局无溢出/无竖排  [0, 0]
PASS  1280x720 画布贴合容器  scene=[970, 514, 302, 56]
PASS  1280x720 编队小窗不被右栏盖住  遮挡 0, 小窗 [240, 176, 395, 381], 右栏 [410, 514, 862, 56]
右栏各标签实测: {"formation": {"hero": [], "charts": ["编队边长（m）"]}, "orbit": {"hero": ["轨道高度598.33km", "速度7.56km/s", "径向相对位置0.42km", "沿迹相对位置-0.16km"], "charts": ["轨道高度（km）"]}, "attitude": {"hero": ["姿态模式nadir", "太阳入射角86.55°", "有效投影系数0.06", "目标离轴角44.87°"], "charts": ["太阳入射角（°）"]}, "power": {"hero": ["发电功率暂无数据", "用电功率暂无数据", "电池 SOC字段未提供", "电量裕度暂无数据"], "charts": ["发电功率与用电功率（W）"]}, "thermal": {"hero": ["主要设备温度暂无数据", "设备发热暂无数据", "外热流暂无数据", "超限节点数暂无数据"], "charts": ["温度测点（℃）"]}}
PASS  五个标签各有曲线区，四个卫星标签另有大字区（没有点了没反应的标签页）  {"formation": [0, 1], "orbit": [4, 1], "attitude": [4, 1], "power": [4, 1], "thermal": [4, 1]}
PASS  能源/热控页的大字区是空态而不是数字  {"power": ["发电功率暂无数据", "用电功率暂无数据", "电池 SOC字段未提供", "电量裕度暂无数据"], "thermal": ["主要设备温度暂无数据", "设备发热暂无数据", "外热流暂无数据", "超限节点数暂无数据"]}
[fps 探针] 全部检查跑完: 61.0 fps (Δ122 / 2.0s, vis=visible)
Phase3 采集: {"utcLabel": ["仿真时刻 (UTC)"], "evCount": 19, "evClickable": "auto", "satEv": {"sec": 17756, "sat": 1}, "allEv": 17456, "obsDisabled": [true, true, true], "groundNote": "方位角、仰角、斜距取自数据文件（站心 ENU），不是靠移动相机凑出来的。三维天空视图把编队张角放大了 5 倍以便分辨三颗星，属局部放大 · 非同尺度；地平线以下的卫星在列表里仍可读，天空视图不画。", "groundFixed": "当前结果使用固定观察站：本数据集的方位角、仰角、斜距是按该站一次性算出的，改经纬度不会重算这些读数，所以输入框禁用。天空视图里的站心换算可以跟着新站址走，但那是另一套数，不拿来冒充表里的值。"}
PASS  UTC 口径明确标注  ['仿真时刻 (UTC)']
PASS  事件标记存在且可点击  19 个, pointer-events=auto
PASS  自定义站址输入被禁用并说明原因  [True, True, True]
PASS  天空视图 5 倍张角放大已标注非同尺度  方位角、仰角、斜距取自数据文件（站心 ENU），不是靠移动相机凑出来的。三维天空视图把编队张角放大了 5 倍以便分辨三颗星，属局部放大 · 非同尺度；地平线以下
点带星号的事件: {"before": {"t": "T+12:00:00", "sat": "TM0S2"}, "after": {"t": "T+04:55:56", "sat": "TM0S1"}, "want": "T+04:55:56", "toast": "已跳到事件时刻 T+04:55:56，选中 TM0S1"}
PASS  点事件跳转到 t_actual 并选中该星  {'before': {'t': 'T+12:00:00', 'sat': 'TM0S2'}, 'after': {'t': 'T+04:55:56', 'sat': 'TM0S1'}, 'want': 'T+04:55:56', 'toast': '已跳到事件时刻 T+04:55:56，选中 TM0S1'}
点 ALL 事件: {"before": {"t": "T+04:55:56", "sat": "TM0S1"}, "after": {"t": "T+04:50:56", "sat": "TM0S1"}}
PASS  ALL 事件只跳时间、不擅自改选中目标  {'before': {'t': 'T+04:55:56', 'sat': 'TM0S1'}, 'after': {'t': 'T+04:50:56', 'sat': 'TM0S1'}}
同刻标记分布: {"nMarks": 19, "multi": 3, "dup": []}
PASS  同一时刻的多条事件标记不再重叠（每条都点得到）  {"nMarks": 19, "multi": 3, "dup": []}
跨星点事件: {"none": false, "sec": 17756, "exp": "T+04:55:56", "hit": true, "before": {"t": "T+04:50:56", "sat": "TM0S1"}, "after": {"t": "T+04:55:56", "sat": "TM0S3"}}
PASS  点别颗星的事件标记会把选中改到那颗星（起点必须是 S1）  {'none': False, 'sec': 17756, 'exp': 'T+04:55:56', 'hit': True, 'before': {'t': 'T+04:50:56', 'sat': 'TM0S1'}, 'after': {'t': 'T+04:55:56', 'sat': 'TM0S3'}}
PASS  跳到的时刻等于该标记自己的 t_actual  期望 T+04:55:56 实得 T+04:55:56
天空视图选中态: {"rows": 3, "out": [{"want": "1", "sat": "TM0S1", "sc": [2.2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], "vis": [true, true, true, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false]}, {"want": "3", "sat": "TM0S3", "sc": [1, 1, 2.2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], "vis": [true, true, true, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false]}, {"want": "2", "sat": "TM0S2", "sc": [1, 2.2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], "vis": [true, true, true, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false]}]}
PASS  点哪一行，天空视图里就只放大那一颗（§3.3）  {"rows": 3, "out": [{"want": "1", "sat": "TM0S1", "sc": [2.2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], "vis": [true, true, true, false, false, false, false, fal
天空视图网格数（含隐藏的历史网格）: [61, 61, 61]
地面观察下相机/按钮: {"cam": [0, 0, 0], "ctrl": [0, 0, 0], "view": "first", "dlDis": true, "dlTitle": "地面观察使用站心天空视角，昼夜全景取景暂不适用"}
PASS  进地面观察不拽走站心相机（相机仍在站心原点，不是全景机位）  {"cam": [0, 0, 0], "ctrl": [0, 0, 0], "view": "first", "dlDis": true, "dlTitle": "地面观察使用站心天空视角，昼夜全景取景暂不适用"}
PASS  地面观察下「框住昼夜分界」禁用并写明原因  {"cam": [0, 0, 0], "ctrl": [0, 0, 0], "view": "first", "dlDis": true, "dlTitle": "地面观察使用站心天空视角，昼夜全景取景暂不适用"}
播放中选中态配对: {"big": [2], "sel": 2, "playing": true, "vis": 3}
PASS  播放推进时放大的仍是选中那颗（插值路径也按 sat_id 认领，D10）  {"big": [2], "sel": 2, "playing": true, "vis": 3}
时钟一致性: {"a": {"t": "T+16:40:00", "step": "60001 / 86401", "utc": "2026-09-13 20:40:00", "el": ["-6.8", "-6.8", "-6.8"]}, "b": {"t": "T+05:00:00", "step": "18001 / 86401", "utc": "2026-09-13 09:00:00", "el": ["21.2", "21.1", "21.2"]}}
PASS  T+/步数/UTC 三者互相自洽  {"a": {"t": "T+16:40:00", "step": "60001 / 86401", "utc": "2026-09-13 20:40:00", "el": ["-6.8", "-6.8", "-6.8"]}, "b": {"t": "T+05:00:00", "step": "18001 / 86401", "utc": "2026-09-13 09:00:00", "el": ["21.2", "21.1", "21.2"]}}
PASS  仰角读数等于 columns.f32 抽出的真值（不是只比两者不同）  ['-6.8', '-6.8', '-6.8'] vs ['21.2', '21.1', '21.2']
地面观察表: {"rows": 3, "before": "TM0S3", "after": "TM0S1", "sel": ["3"], "tplus": "T+05:00:00"}
PASS  点地面观察表行可选中该星且不改时间  {'rows': 3, 'before': 'TM0S3', 'after': 'TM0S1', 'sel': ['3'], 'tplus': 'T+05:00:00'}
WS 状态 {"state": "paused", "ready": null}；WS 重试类 error 0 条
PASS  控制台无非预期 error  []
PASS  WS 若出现重试，最终仍连上（画面不靠它喂帧，但状态要如实记）  {"ws": {"state": "paused", "ready": null}, "noise": []}
PASS  无未捕获异常  []
PASS  全程没有原生弹窗（alert/confirm 会冻住主线程，三维侧初始化失败就是靠它暴露的）  []
```

## 截图

- `screenshots/phase-03/01-1792-overview.png`
- `screenshots/phase-03/02-1792-panels-collapsed.png`
- `screenshots/phase-03/03-1792-center.png`
- `screenshots/phase-03/04-1366-rail-collapsed.png`
- `screenshots/phase-03/04-1366x768-overview.png`
- `screenshots/phase-03/05-1280x720-overview.png`
- `screenshots/phase-03/06-1792-earth-framing.png`
- `screenshots/phase-03/06-1792-follow.png`
- `screenshots/phase-03/07-1792-inset-and-axes.png`
- `screenshots/phase-03/08-1792-rail-config-block.png`
- `screenshots/phase-03/09-1792-ground.png`
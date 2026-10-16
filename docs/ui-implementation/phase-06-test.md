# phase-06 测试记录

运行方式：有头 Chrome + CDP 设备度量覆盖，真实访问 http://127.0.0.1:8000/sim/。

## 结果

- **失败项**：无

## 逐项

```
[等待渲染进程 初始] #0 readyState=interactive loopTicks=-1
[等待渲染进程 初始] #1 readyState=complete loopTicks=0
PASS  渲染进程能应答（先让它把 38MB+64MB 数据吞完，否则后面全是超时假失败）  见逐次日志
PASS  页面可见（隐藏会冻结 rAF 与合成器，之后全是假失败）  visibilityState=visible
== phase-06 真实浏览器验收 ==
PASS  桥接就绪  等待 0.0s
PASS  加载示例  已就绪 (2s)
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
[fps 探针] 刚 attach 完: 60.0 fps (Δ120 / 2.0s, vis=visible)
[强制合成帧] 122.0 tick / 2.06s（期间逼帧 18 次, vis=visible）
PASS  循环在跑：强制合成帧口径的 tick 速率落在 25–120（墙钟 60.0 fps 只作参考）  59.1 tick/s
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
基准：8 张强制合成帧 -> 49 tick
PASS  rAF 循环在跑  Δticks=49
PASS  播放按倍率真的推进（比较 T+ 秒数，不拿实现自己写的文案自证）  T+ 走了 2 s / 墙钟 3 s
PASS  暂停后不再推进  T+00:00:02 / T+00:00:02
PASS  运行态文案与状态一致  运行中 1× / 已暂停
PASS  时间轴拖动同步  {"t": "T+12:00:00", "u": "2026-09-13 16:00:00", "st": "43201 / 86401"}
PASS  选星不重置时间  {"t": "T+12:00:00", "k": "TM0S2", "i": 1}
PASS  收起两栏后场景未被压扁  scene=[1760, 658, 16, 56] canvas=[1758, 657]
PASS  切视角不重建 renderer  sameNode=True
PASS  反复切换后 rAF 未累积重复循环  切换后 46 tick vs 基准 49 tick（同样 8 帧）
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
== Phase 6 端到端 ==
就绪态：桥版本=1 mode=csv 轨道页=['轨道高度598.33km', '速度7.56km/s', '径向相对位置0.42km', '沿迹相对位置-0.16km']
PASS  加载完成后处于就绪态且三维已进入外部驱动  {"attached": true, "ver": 1, "mode": "csv", "hero": ["轨道高度598.33km", "速度7.56km/s", "径向相对位置0.42km", "沿迹相对位置-0.16km"]}
掉线瞬间: {"run": "三维画面已重载，需重新加载", "attached": false, "playing": false, "hero": ["轨道高度未接入", "速度未接入", "径向相对位置0.42km", "沿迹相对位置-0.16km"]}
PASS  三维掉线后如实报告未就绪并停走带  {"run": "三维画面已重载，需重新加载", "attached": false, "playing": false, "hero": ["轨道高度未接入", "速度未接入", "径向相对位置0.42km", "沿迹相对位置-0.16km"]}
PASS  三维掉线就不留旧数值：轨道高度/速度改口成未接入  ['轨道高度未接入', '速度未接入', '径向相对位置0.42km', '沿迹相对位置-0.16km']
重新加载后: {"attached": true, "ver": 1, "mode": "csv", "run": "已就绪"}
PASS  点「重新加载」能恢复到外部驱动就绪态  {"attached": true, "ver": 1, "mode": "csv", "run": "已就绪"}
PASS  恢复后同一时刻的轨道页读数与掉线前一致（不是未接入、也不是别的时刻的数）  {"back": {"t": "T+12:00:00", "hero": ["轨道高度598.33km", "速度7.56km/s", "径向相对位置0.42km", "沿迹相对位置-0.16km"]}, "pre": ["轨道高度598.33km", "速度7.56km/s"]}
相机测试前的三维状态: {"mode": "csv", "steps": 86401, "vis": [true, true, true]}
PASS  重新挂载后确实回到外部驱动 CSV 模式且卫星网格可见  {"mode": "csv", "steps": 86401, "vis": [true, true, true]}
三种相机机位: {"global": [105, 37.5, 105], "formation": [728.8, 2039.7, -6636.5], "follow": [7.6, 21.2, -69.1]}
PASS  三种相机模式机位互不相同且都真的换了机位  {"global": [105, 37.5, 105], "formation": [728.8, 2039.7, -6636.5], "follow": [7.6, 21.2, -69.1]}
三颗星轮选: [{"sat": "TM0S1", "idx": 0, "dot": "rgb(56, 169, 255)"}, {"sat": "TM0S2", "idx": 1, "dot": "rgb(41, 215, 208)"}, {"sat": "TM0S3", "idx": 2, "dot": "rgb(255, 184, 63)"}]
PASS  点列表就是换目标：界面名、三维选中索引、列表圆点身份色三者对齐  {"sel": [{"sat": "TM0S1", "idx": 0, "dot": "rgb(56, 169, 255)"}, {"sat": "TM0S2", "idx": 1, "dot": "rgb(41, 215, 208)"}, {"sat": "TM0S3", "idx": 2, "dot": "rgb(255, 184, 63)"}], "vars": ["rgb(56, 169, 255)", "rgb(41, 215, 208)", "rgb(255, 184, 63)"]}
PASS  回起点后单步恰好 ±1 个采样间隔（1 s）  T+00:00:00 → T+00:00:01 → T+00:00:00
倍率实测: {"kv": "60×", "st": 60}
PASS  倍率按钮真的写进状态（档位 1/10/60）  {"kv": "60×", "st": 60}
同样泵 12 帧的时间推进: {"1": 1, "60": 69}
PASS  倍率真的改变推进速度：60× 走出的秒数远大于 1×（帧口径）  {"1": 1, "60": 69}
PASS  播放推进、暂停即停  T+00:01:11 / T+00:01:11 / T+00:01:11
PASS  拖动跳转后 T+/UTC/步数三者自洽  {"t": "T+18:00:00", "u": "2026-09-13 22:00:00", "step": "64801 / 86401"}
PASS  五个标签的曲线容器互不相同（不是同一张图复用）  {"formation": ["编队边长（m）"], "orbit": ["轨道高度（km）"], "attitude": ["太阳入射角（°）"], "power": ["发电功率与用电功率（W）"], "thermal": ["温度测点（℃）"]}
全屏按钮: {"toast": "全屏被浏览器拒绝：Permissions check failed", "isFs": false, "err": "no"}
PASS  全屏被浏览器拒绝时有明确反馈（不是点了没反应）  {"toast": "全屏被浏览器拒绝：Permissions check failed", "isFs": false, "err": "no"}
PASS  面板收起→恢复：场景宽度可逆，画布始终贴合容器  基线 [1043, 658, 339, 56] / 收起 [1760, 658, 16, 56] / 恢复 [1043, 658, 339, 56]
PASS  点带星号的事件标记：跳到该标记自己的 t_actual 并选中它所属的那颗星  {"t": "T+18:00:00", "sat": "TM0S3"} → {"want": "TM0S1", "exp": "T+04:55:56", "hit": true, "after": {"t": "T+04:55:56", "sat": "TM0S1"}}
PASS  端到端保存：确实产出一个场景文件  {"n": 0, "made": 1, "name": "天幕场景_20261016051102.json"}
PASS  端到端导出：产出一个带时间窗的 CSV  {"made": 1, "name": "TM0S1_时间序列_17156-18356.csv"}
setStep 调用数（各点一次「单步前进」）：交互前 1 / 全部交互之后 1
PASS  一轮完整交互之后没有多出重复的驱动路径（点一次单步只调 setStep 一次）  1 → 1
[fps 探针] 端到端跑完: 58.0 fps (Δ116 / 2.0s, vis=visible)
iframe 被强制重载 6 s 后（诊断，不作门禁）: {"attached": false, "run": "三维画面已重载，需重新加载", "bridge": true, "mode": "ws"}
随后点「重新加载」的结果: {"a": true, "m": "csv"}
WS 状态 {"state": "paused", "ready": null}；WS 重试类 error 0 条
PASS  控制台无非预期 error  []
PASS  WS 若出现重试，最终仍连上（画面不靠它喂帧，但状态要如实记）  {"ws": {"state": "paused", "ready": null}, "noise": []}
PASS  无未捕获异常  []
PASS  全程没有原生弹窗（alert/confirm 会冻住主线程，三维侧初始化失败就是靠它暴露的）  []
```

## 截图

- `screenshots/phase-06/01-1792-overview.png`
- `screenshots/phase-06/02-1792-panels-collapsed.png`
- `screenshots/phase-06/03-1792-center.png`
- `screenshots/phase-06/04-1366-rail-collapsed.png`
- `screenshots/phase-06/04-1366x768-overview.png`
- `screenshots/phase-06/05-1280x720-overview.png`
- `screenshots/phase-06/06-1792-earth-framing.png`
- `screenshots/phase-06/06-1792-follow.png`
- `screenshots/phase-06/07-1792-inset-and-axes.png`
- `screenshots/phase-06/08-1792-rail-config-block.png`
- `screenshots/phase-06/20-1792-e2e-views.png`
- `screenshots/phase-06/21-1792-cam-follow.png`
- `screenshots/phase-06/21-1792-cam-formation.png`
- `screenshots/phase-06/21-1792-cam-global.png`
- `screenshots/phase-06/21b-1792-cam-compare.png`
- `screenshots/phase-06/22-1792-restored.png`
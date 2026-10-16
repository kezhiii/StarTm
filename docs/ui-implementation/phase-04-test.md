# phase-04 测试记录

运行方式：有头 Chrome + CDP 设备度量覆盖，真实访问 http://127.0.0.1:8000/sim/。

## 结果

- **失败项**：无

## 逐项

```
[等待渲染进程 初始] #0 readyState=interactive loopTicks=-1
[等待渲染进程 初始] #1 readyState=complete loopTicks=-1
[等待渲染进程 初始] #2 readyState=complete loopTicks=0
PASS  渲染进程能应答（先让它把 38MB+64MB 数据吞完，否则后面全是超时假失败）  见逐次日志
PASS  页面可见（隐藏会冻结 rAF 与合成器，之后全是假失败）  visibilityState=visible
== phase-04 真实浏览器验收 ==
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
[fps 探针] 刚 attach 完: 60.0 fps (Δ120 / 2.0s, vis=visible)
[强制合成帧] 123.0 tick / 2.06s（期间逼帧 18 次, vis=visible）
PASS  循环在跑：强制合成帧口径的 tick 速率落在 25–120（墙钟 60.0 fps 只作参考）  59.8 tick/s
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
基准：8 张强制合成帧 -> 45 tick
PASS  rAF 循环在跑  Δticks=45
PASS  播放按倍率真的推进（比较 T+ 秒数，不拿实现自己写的文案自证）  T+ 走了 2 s / 墙钟 3 s
PASS  暂停后不再推进  T+00:00:02 / T+00:00:02
PASS  运行态文案与状态一致  运行中 1× / 已暂停
PASS  时间轴拖动同步  {"t": "T+12:00:00", "u": "2026-09-13 16:00:00", "st": "43201 / 86401"}
PASS  选星不重置时间  {"t": "T+12:00:00", "k": "TM0S2", "i": 1}
PASS  收起两栏后场景未被压扁  scene=[1760, 658, 16, 56] canvas=[1758, 657]
PASS  切视角不重建 renderer  sameNode=True
PASS  反复切换后 rAF 未累积重复循环  切换后 47 tick vs 基准 45 tick（同样 8 帧）
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
抽屉四入口实测: {"cfgOrbit": {"shown": true, "idx": 0, "opened": true, "groups": 5, "inputs": 18, "miss": 0, "txt": "① 轨道与编队3 颗 TM0S1半长轴 a₀km偏心率 e₀—倾角 i₀°升交点赤经 Ω₀°近地点幅角 ω₀°真近点角 ν₀°TM0S2半长轴 a₀km偏心率 e₀—倾角 i₀°升交点赤经 Ω₀°近地点幅角 ω₀°真近点角 ν₀°TM0S3半长轴 a₀km偏心率 e₀—倾角 i₀°升交点赤经 Ω₀°", "applyDis": true, "scene": "TM-V0-SIM · FreeDrift-Synthetic"}, "cfgAtt": {"shown": true, "idx": 1, "opened": true, "groups": 5, "inputs": 0, "miss": 0, "txt": "② 姿态与太阳翼只读 运行工况FreeDrift-Synthetic 姿态模式（数据里的取值）nadir 太阳翼展开轴未提供 · 本体数据里没有展开轴向，需结构侧给出后才显示", "applyDis": true, "scene": "TM-V0-SIM · FreeDrift-Synthetic"}, "cfgPower": {"shown": true, "idx": 2, "opened": true, "groups": 5, "inputs": 0, "miss": 1, "txt": "③ 能源系统未提供 未提供 · power 的 5 列整列为空，battery_soc_pct 列不存在，需能源模型交付时序 电池容量—Ah初始 SOC—%发电功率参数—W", "applyDis": true, "scene": "TM-V0-SIM · FreeDrift-Synthetic"}, "cfgThermal": {"shown": true, "idx": 4, "opened": true, "groups": 5, "inputs": 0, "miss": 1, "txt": "⑤ 热控参数未提供 未提供 · thermal 的 4 列整列为空，逐测点 temp_ 列未交付，需热控模型交付时序 初始温度—℃热参数——主动热控——", "applyDis": true, "scene": "TM-V0-SIM · FreeDrift-Synthetic"}}
PASS  四个配置入口都能打开抽屉并展开对应分组  {"cfgOrbit": {"shown": true, "idx": 0, "opened": true, "groups": 5, "inputs": 18, "miss": 0, "txt": "① 轨道与编队3 颗 TM0S1半长轴 a₀km偏心率 e₀—倾角 i₀°升交点赤经 Ω₀°近地点幅角 ω₀°真近点角 ν₀°TM0S2半长轴 a₀km偏心率 e₀—倾角 i₀°升交点赤经 Ω₀°近地点幅角 ω₀°真近点角 ν₀°TM0S3半长轴 a₀km偏心率 e₀—倾角 i₀°升交点赤经 Ω₀°", "applyDis": true, "scene": "TM-V0-SIM · FreeDrift-Synthetic"}, "cfgAtt": {"shown": true, "idx": 1, "opened": true, "groups": 5, "inputs": 0, "miss": 0, "txt": "② 姿态与太阳翼只读 运行工况FreeDrift-Synthetic 姿态模式（数据里的取值）nadir 太阳翼展开轴未提供 · 本体数据里没有展开轴向，需结构侧给出后才显示", "applyDis": true, "scene": "TM-V0-SIM · FreeDrift-Synthetic"}, "cfgPower": {"shown": true, "idx": 2, "opened": true, "groups": 5, "inputs": 0, "miss": 1, "txt": "③ 能源系统未提供 未提供 · power 的 5 列整列为空，battery_soc_pct 列不存在，需能源模型交付时序 电池容量—Ah初始 SOC—%发电功率参数—W", "applyDis": true, "scene": "TM-V0-SIM · FreeDrift-Synthetic"}, "cfgThermal": {"shown": true, "idx": 4, "opened": true, "groups": 5, "inputs": 0, "miss": 1, "txt": "⑤ 热控参数未提供 未提供 · thermal 的 4 列整列为空，逐测点 temp_ 列未交付，需热控模型交付时序 初始温度—℃热参数——主动热控——", "applyDis": true, "scene": "TM-V0-SIM · FreeDrift-Synthetic"}}
PASS  轨道分组有 18 个可编辑根数输入（3 星 × 6 个）  {'shown': True, 'idx': 0, 'opened': True, 'groups': 5, 'inputs': 18, 'miss': 0, 'txt': '① 轨道与编队3 颗 TM0S1半长轴 a₀km偏心率 e₀—倾角 i₀°升交点赤经 Ω₀°近地点幅角 ω₀°真近点角 ν₀°TM0S2半长轴 a₀km偏心率 e₀—倾角 i₀°升交点赤经 Ω₀°近地点幅角 ω₀°真近点角 ν₀°TM0S3半长轴 a₀km偏心率 e₀—倾角 i₀°升交点赤经 Ω₀°', 'applyDis': True, 'scene': 'TM-V0-SIM · FreeDrift-Synthetic'}
PASS  能源与热控分组如实标「未提供」且不放假输入框  ["③ 能源系统未提供 未提供 · power 的 5 列整列为空，battery_soc_pct 列不存在，需能源模型交付时序 电池容量—Ah初始 SOC—%发电功率参数—W", "⑤ 热控参数未提供 未提供 · thermal 的 4 列整列为空，逐测点 temp_ 列未交付，需热控模型交付时序 初始温度—℃热参数——主动热控——"]
PASS  场景标识带进抽屉标题  TM-V0-SIM · FreeDrift-Synthetic
PASS  抽屉确实渲染出 18 个根数输入（不是空壳）  18 个, ready=True
抽屉根数与 meta.oe_input 对账: 不一致 0 项 []
PASS  抽屉初值逐条等于 meta.oe_input（不是写死的示例数）  []
PASS  「应用并重新运行」在引擎接入前保持禁用  True
越界校验: {"after": {"err": "TM0S1 半长轴 a₀：120 超出定义域 6478.137–∞ km", "dis": true, "dirty": true, "old": "6978.137101"}, "clean": {"err": "", "dis": true}}
PASS  越界根数当场点名并说明定义域  TM0S1 半长轴 a₀：120 超出定义域 6478.137–∞ km
PASS  越界时应用按钮仍禁用  True
PASS  未应用更改标记随编辑出现  True
PASS  改回合法值后错误条清空  
脏状态关闭确认: {"kept": true, "conf": ["配置有未应用更改，确定放弃？", "配置有未应用更改，确定放弃？"], "hidden": true, "mask": true, "cls": false}
PASS  有未应用更改时关闭需确认，拒绝则保持打开  {'kept': True, 'conf': ['配置有未应用更改，确定放弃？', '配置有未应用更改，确定放弃？'], 'hidden': True, 'mask': True, 'cls': False}
PASS  确认后抽屉与遮罩一起关闭并解除 body 状态  {'kept': True, 'conf': ['配置有未应用更改，确定放弃？', '配置有未应用更改，确定放弃？'], 'hidden': True, 'mask': True, 'cls': False}
保存快照: ["场景格式版本", "场景标识", "起算时刻", "总时长_s", "采样间隔_s", "观察站", "轨道根数_初始", "未提供分组", "显示偏好", "有未应用更改"] name='\u5929\u5e55\u573a\u666f_20261016050809.json'
PASS  保存文件带格式版本标识  serproject-scenario/1
PASS  保存内容含三颗星的初始根数  {"TM0S1": {"a0": "6978.137101", "e0": 4.1e-05, "inc0_deg": 97.792, "raan0_deg": 260.833, "argp0_deg": 270.018, "nu0_deg": 89.987}, "TM0S2": {"a0": 6978.137053, "e0": 4.1e-05, "inc0_deg": 97.786, "raan
PASS  保存内容如实记录未提供分组与采样口径  {"未提供分组": ["能源系统（power 列为空）", "热控参数（temp_* 列未交付）"], "采样间隔_s": 1, "总时长_s": 86400}
PASS  顶栏总时长等于 (历元数−1)×间隔 = 24:00:00（不是多算一秒）  kvTotal=24:00:00 kvMeta=3 颗 / 1 s / 86401 历元
PASS  保存内容含显示偏好（视图/图层/选中目标）  {"选中目标": "TM0S2", "视图": "formation", "详情标签": "formation", "图层": {"labels": true, "trails": true, "gtrack": false, "links": false, "terminator": true}}
回灌场景文件: {"a0": "7100.5", "dirty": true, "applyDis": true, "toast": "已加载场景文件「test-scenario.json」，参数已编辑但尚未应用（重跑引擎未接入）"}
PASS  加载合法场景文件后输入框跟着变，并标记为未应用  {"a0": "7100.5", "dirty": true, "applyDis": true, "toast": "已加载场景文件「test-scenario.json」，参数已编辑但尚未应用（重跑引擎未接入）"}
加载非法文件: {"same": true, "toast": "加载失败：场景格式版本不是 serproject-scenario/1（界面保持原状态）"}
PASS  格式不对的文件报错且不改变界面状态  {"same": true, "toast": "加载失败：场景格式版本不是 serproject-scenario/1（界面保持原状态）"}
只有两颗星的场景 的拒绝结果: {"same": true, "n": 18, "toast": "加载失败：卫星集合对不上：基准是 TM0S1/TM0S2/TM0S3，文件是 TM0S1/TM0S2（界面保持原状态）"}
PASS  只有两颗星的场景 被拒（且理由正确：卫星集合对不上）抽屉一个字节都没变  {"same": true, "n": 18, "toast": "加载失败：卫星集合对不上：基准是 TM0S1/TM0S2/TM0S3，文件是 TM0S1/TM0S2（界面保持原状态）"}
缺 a0 字段的场景 的拒绝结果: {"same": true, "n": 18, "toast": "加载失败：TM0S3 缺 半长轴 a₀（a0）或其值不是数字（界面保持原状态）"}
PASS  缺 a0 字段的场景 被拒（且理由正确：a0）抽屉一个字节都没变  {"same": true, "n": 18, "toast": "加载失败：TM0S3 缺 半长轴 a₀（a0）或其值不是数字（界面保持原状态）"}
导出对话框: {"opened": true, "files": 1, "start": 1}
PASS  导出对话框能打开并按当前选择产出文件  {"opened": true, "files": 1, "start": 1}
导出回执: {"files": ["TM0S2_时间序列_全程.csv"], "skipped": [], "cols": 27} toast='\u5df2\u5bfc\u51fa TM0S2_\u65f6\u95f4\u5e8f\u5217_\u5168\u7a0b.csv\uff0827 \u4e2a\u5b57\u6bb5\uff1b\u7a7a\u503c\u4fdd\u6301\u4e3a\u7a7a\uff0c\u672a\u5199 0\uff09'
PASS  导出反馈带文件名，且剔除项说了/没剔除就不谎报（E1）  {"rec": {"files": ["TM0S2_时间序列_全程.csv"], "skipped": [], "cols": 27}, "toast": "已导出 TM0S2_时间序列_全程.csv（27 个字段；空值保持为空，未写 0）"}
导出 CSV: 86402 行, 29 列, rel_s=43200 的仰角=-39.439353942871094, 空字段=0
PASS  导出只含真有值的列（能源/热控整列空，不进表头）  []
PASS  导出全程 86401 个历元 + 表头  86402
PASS  导出首列就是相对秒 rel_s  'rel_s'
utcg 列前 4000 行非空 4000 条，列号=1 样本=['20260913040000', '20260913040001', '20260913040002']
PASS  导出的 utcg 列真的有值（不是硬写表头留空列）  {"i": 1, "nonempty": 4000, "sample": ["20260913040000", "20260913040001", "20260913040002"]}
PASS  utcg 是星历自带的 14 位紧凑 UTC，起点=t0 且逐行 +1 s  ["20260913040000", "20260913040001", "20260913040002"]
卡片仰角读数(选中星): '-39.4'
PASS  导出的仰角与界面卡片读数同一时刻一致  CSV -39.439353942871094 vs 卡片 -39.4
按窗口导出: {"files": 3, "closed": true, "lines": 1202, "first": "42600", "last": "43800", "name": "TM0S1_时间序列_42600-43800.csv"}
PASS  全部三颗各出一个文件  3
PASS  窗口导出只取游标前后各 10 分钟（1201 行）  {"lines": 1202, "first": "42600", "last": "43800", "name": "TM0S1_时间序列_42600-43800.csv"}
PASS  导出完成后对话框自动关闭  True
抽屉关闭后布局回到常态: drawerHidden=True
WS 状态 {"state": "paused", "ready": null}；WS 重试类 error 0 条
PASS  控制台无非预期 error  []
PASS  WS 若出现重试，最终仍连上（画面不靠它喂帧，但状态要如实记）  {"ws": {"state": "paused", "ready": null}, "noise": []}
PASS  无未捕获异常  []
PASS  全程没有原生弹窗（alert/confirm 会冻住主线程，三维侧初始化失败就是靠它暴露的）  []
```

## 截图

- `screenshots/phase-04/01-1792-drawer.png`
- `screenshots/phase-04/01-1792-overview.png`
- `screenshots/phase-04/02-1792-drawer-open.png`
- `screenshots/phase-04/02-1792-panels-collapsed.png`
- `screenshots/phase-04/03-1792-center.png`
- `screenshots/phase-04/04-1366-rail-collapsed.png`
- `screenshots/phase-04/04-1366x768-overview.png`
- `screenshots/phase-04/05-1280x720-overview.png`
- `screenshots/phase-04/06-1792-earth-framing.png`
- `screenshots/phase-04/06-1792-follow.png`
- `screenshots/phase-04/07-1792-inset-and-axes.png`
- `screenshots/phase-04/08-1792-rail-config-block.png`
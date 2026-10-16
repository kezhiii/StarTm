# phase-02 测试记录

运行方式：有头 Chrome + CDP 设备度量覆盖，真实访问 http://127.0.0.1:8000/sim/。

## 结果

- **失败项**：无

## 逐项

```
[等待渲染进程 初始] #0 readyState=interactive loopTicks=-1
[等待渲染进程 初始] #1 readyState=interactive loopTicks=-1
[等待渲染进程 初始] #2 readyState=complete loopTicks=0
PASS  渲染进程能应答（先让它把 38MB+64MB 数据吞完，否则后面全是超时假失败）  见逐次日志
PASS  页面可见（隐藏会冻结 rAF 与合成器，之后全是假失败）  visibilityState=visible
== phase-02 真实浏览器验收 ==
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
[fps 探针] 刚 attach 完: 60.5 fps (Δ121 / 2.0s, vis=visible)
[强制合成帧] 125.0 tick / 2.11s（期间逼帧 18 次, vis=visible）
PASS  循环在跑：强制合成帧口径的 tick 速率落在 25–120（墙钟 60.5 fps 只作参考）  59.3 tick/s
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
基准：8 张强制合成帧 -> 47 tick
PASS  rAF 循环在跑  Δticks=47
PASS  播放按倍率真的推进（比较 T+ 秒数，不拿实现自己写的文案自证）  T+ 走了 2 s / 墙钟 3 s
PASS  暂停后不再推进  T+00:00:03 / T+00:00:03
PASS  运行态文案与状态一致  运行中 1× / 已暂停
PASS  时间轴拖动同步  {"t": "T+12:00:00", "u": "2026-09-13 16:00:00", "st": "43201 / 86401"}
PASS  选星不重置时间  {"t": "T+12:00:00", "k": "TM0S2", "i": 1}
PASS  收起两栏后场景未被压扁  scene=[1760, 658, 16, 56] canvas=[1758, 657]
PASS  切视角不重建 renderer  sameNode=True
PASS  反复切换后 rAF 未累积重复循环  切换后 47 tick vs 基准 47 tick（同样 8 帧）
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
Phase2 右栏实测: {"formation": {"charts": ["编队边长（m）"], "empty": [], "rows": [], "badges": [], "kpi": ["可见卫星0 / 3", "平均星间距0.964 km", "构型偏差125.8 m", "当前仿真时刻T+12:00:00"], "edge": [["星间连线", "距离 (km)"], ["TM0S1–TM0S2", "0.941"], ["TM0S2–TM0S3", "1.007"], ["TM0S3–TM0S1", "0.943"]], "sub": ["前 1 小时 · 点击定位"], "paneHtmlLen": -1, "tabOn": "formation"}, "orbit": {"charts": ["轨道高度（km）"], "empty": [], "rows": ["边长 TM0S1-TM0S2", "边长 TM0S2-TM0S3", "边长 TM0S3-TM0S1", "旋转相位", "半长轴 a", "偏心率 e", "倾角 i", "升交点赤经 Ω", "星下点纬度", "星下点经度", "相对位置 R（径向）", "相对位置 T（沿迹）", "相对位置 N（法向）"], "badges": ["光照 日照 · 日面 100% · 本影裕度 +580 km", "稳定 是"], "kpi": [], "edge": [], "sub": ["前 1 小时 · 点击定位 · 数据源 preview，采样 60 s"], "paneHtmlLen": -1, "tabOn": "orbit"}, "attitude": {"charts": ["太阳入射角（°）"], "empty": [], "rows": ["四元数 w（x,y,z 展开见悬停）", "姿态模式", "稳定标志", "目标离轴角", "目标入锥(≤1°)", "太阳入射角（对 +Z_B）", "太阳入射角（对太阳翼法向）· 本数据集与上一行同值", "太阳翼有效投影系数", "太阳翼法向 x（J2000）", "太阳翼法向 y（J2000）", "太阳翼法向 z（J2000）"], "badges": ["光照 日照 · 日面 100% · 本影裕度 +580 km", "稳定 是"], "kpi": [], "edge": [], "sub": ["前 1 小时 · 点击定位"], "paneHtmlLen": -1, "tabOn": "attitude"}, "power": {"charts": ["发电功率与用电功率（W）"], "empty": ["本场景没有可画的发电功率与用电功率曲线当前结果未包含能源时序：power 的 gen_power / platform_power / payload_power 整列为空，battery_soc_pct 字段未提供。"], "rows": ["发电功率", "电量裕度"], "badges": ["光照 日照 · 日面 100% · 本影裕度 +580 km", "稳定 是"], "kpi": [], "edge": [], "sub": [], "paneHtmlLen": -1, "tabOn": "power"}, "thermal": {"charts": ["温度测点（℃）"], "empty": ["本场景没有可画的温度测点曲线当前结果未包含温度时序：thermal 的 temp_main 整列为空，且接口定义的逐测点 temp_ 列尚未交付。"], "rows": ["主要设备温度", "超限节点数"], "badges": ["光照 日照 · 日面 100% · 本影裕度 +580 km", "稳定 是"], "kpi": [], "edge": [], "sub": [], "paneHtmlLen": -1, "tabOn": "thermal"}, "ground": {"charts": ["目标区太阳高度（合肥）（°）"], "empty": [], "rows": ["单星可见", "三星共同可见", "方位角", "仰角", "斜距", "计划点亮", "实际点亮", "频率", "占空比", "亮度", "有效显示", "目标区太阳高度"], "badges": ["光照 日照 · 日面 100% · 本影裕度 +580 km", "稳定 是", "单星可见 否", "共同可见 否", "计划点亮 否", "实际点亮 否"], "kpi": [], "edge": [], "sub": ["前 1 小时 · 点击定位"], "paneHtmlLen": 1448, "tabOn": null}, "base": {}}
地面页宿主诊断: paneHtmlLen=1448 tabOn=None edge=[]
PASS  orbit 标签切换不改动时间/相机/选星  {'t': 'T+12:00:00', 'cam': [105, 37.5, 105], 'sat': 'TM0S2'}
PASS  attitude 标签切换不改动时间/相机/选星  {'t': 'T+12:00:00', 'cam': [105, 37.5, 105], 'sat': 'TM0S2'}
PASS  power 标签切换不改动时间/相机/选星  {'t': 'T+12:00:00', 'cam': [105, 37.5, 105], 'sat': 'TM0S2'}
PASS  thermal 标签切换不改动时间/相机/选星  {'t': 'T+12:00:00', 'cam': [105, 37.5, 105], 'sat': 'TM0S2'}
PASS  三组星间距离各占一行  [['星间连线', '距离 (km)'], ['TM0S1–TM0S2', '0.941'], ['TM0S2–TM0S3', '1.007'], ['TM0S3–TM0S1', '0.943']]
formation_geom.csv 真值(km) @T+12:00:00: [0.940968407, 1.00747596, 0.942560079]
PASS  能按当前时刻取到 formation_geom.csv 真值行（对账不许静默跳过）  [0.940968407, 1.00747596, 0.942560079]
PASS  KPI 平均星间距与 CSV 逐值对账（不是放大 1000 倍）  界面 0.964 vs CSV 0.9637 km
PASS  距离三行与 CSV 三条边长逐值对账  界面 [0.941, 1.007, 0.943] vs CSV [0.940968407, 1.00747596, 0.942560079]
PASS  四个单星标签各自有独立图表  {"orbit": ["轨道高度（km）"], "attitude": ["太阳入射角（°）"], "power": ["发电功率与用电功率（W）"], "thermal": ["温度测点（℃）"]}
PASS  轨道页只放轨道量（无地面站斜距/仰角/可见性）  ['边长 TM0S1-TM0S2', '边长 TM0S2-TM0S3', '边长 TM0S3-TM0S1', '旋转相位', '半长轴 a', '偏心率 e', '倾角 i', '升交点赤经 Ω', '星下点纬度', '星下点经度', '相对位置 R（径向）', '相对位置 T（沿迹）', '相对位置 N（法向）']
PASS  轨道页含轨道要素与相对位置  ['边长 TM0S1-TM0S2', '边长 TM0S2-TM0S3', '边长 TM0S3-TM0S1', '旋转相位', '半长轴 a', '偏心率 e', '倾角 i', '升交点赤经 Ω', '星下点纬度', '星下点经度', '相对位置 R（径向）', '相对位置 T（沿迹）', '相对位置 N（法向）']
PASS  姿态页不混显示任务量（亮度/频闪/有效显示）  ['四元数 w（x,y,z 展开见悬停）', '姿态模式', '稳定标志', '目标离轴角', '目标入锥(≤1°)', '太阳入射角（对 +Z_B）', '太阳入射角（对太阳翼法向）· 本数据集与上一行同值', '太阳翼有效投影系数', '太阳翼法向 x（J2000）', '太阳翼法向 y（J2000）', '太阳翼法向 z（J2000）']
PASS  姿态页含太阳入射角与太阳翼法向  ['四元数 w（x,y,z 展开见悬停）', '姿态模式', '稳定标志', '目标离轴角', '目标入锥(≤1°)', '太阳入射角（对 +Z_B）', '太阳入射角（对太阳翼法向）· 本数据集与上一行同值', '太阳翼有效投影系数', '太阳翼法向 x（J2000）', '太阳翼法向 y（J2000）', '太阳翼法向 z（J2000）']
PASS  power 页不出现太阳高度读数或曲线  ['发电功率', '电量裕度']
PASS  thermal 页不出现太阳高度读数或曲线  ['主要设备温度', '超限节点数']
PASS  attitude 页不出现太阳高度读数或曲线  ['四元数 w（x,y,z 展开见悬停）', '姿态模式', '稳定标志', '目标离轴角', '目标入锥(≤1°)', '太阳入射角（对 +Z_B）', '太阳入射角（对太阳翼法向）· 本数据集与上一行同值', '太阳翼有效投影系数', '太阳翼法向 x（J2000）', '太阳翼法向 y（J2000）', '太阳翼法向 z（J2000）']
PASS  orbit 页不出现太阳高度读数或曲线  ['边长 TM0S1-TM0S2', '边长 TM0S2-TM0S3', '边长 TM0S3-TM0S1', '旋转相位', '半长轴 a', '偏心率 e', '倾角 i', '升交点赤经 Ω', '星下点纬度', '星下点经度', '相对位置 R（径向）', '相对位置 T（沿迹）', '相对位置 N（法向）']
PASS  地面观察页承接 ②④⑤ 组（方位/仰角/斜距/亮度/有效显示）  ['单星可见', '三星共同可见', '方位角', '仰角', '斜距', '计划点亮', '实际点亮', '频率', '占空比', '亮度', '有效显示', '目标区太阳高度']
PASS  单星四页的徽带不再用地平可见性/点亮判据  {"orbit": ["光照 日照 · 日面 100% · 本影裕度 +580 km", "稳定 是"], "power": ["光照 日照 · 日面 100% · 本影裕度 +580 km", "稳定 是"]}
⑨ 组时间对齐: T+12h {'a': '半长轴 a6976.5km', 'inc': '倾角 i97.79deg', 'R': '相对位置 R（径向）0.42km', 'sat': 'TM0S2'} | T+00:05 {'a': '半长轴 a6976.2km', 'inc': '倾角 i97.79deg', 'R': '相对位置 R（径向）0.03km', 'sat': 'TM0S2'} | CSV 真值 sma(43200)=(6976.46421, 97.793) sma(300)=(6976.22309, 97.793)
PASS  T+12:00:00 的半长轴等于 preview 里 rel_s=43200 那一行  半长轴 a6976.5km vs CSV (6976.46421, 97.793)
PASS  T+00:05:00 读到的是 rel_s=300 那一行（不是 60 倍错位的 18000）  半长轴 a6976.2km vs CSV (6976.22309, 97.793)
PASS  两个时刻的轨道要素随时间走（不是钉死在某一行）  半长轴 a6976.5km / 半长轴 a6976.2km
PASS  power 页这些行存在且全部是缺值态（不是 0）  ["发电功率暂无数据W", "电量裕度暂无数据%"]
PASS  thermal 页这些行存在且全部是缺值态（不是 0）  ["主要设备温度暂无数据℃", "超限节点数暂无数据个"]
PASS  编队边长曲线三条线各自有允许带（不同初始值）  [{"lo": 1056.8139457702637, "hi": 1076.8139457702637}, {"lo": 969.3270826339722, "hi": 989.3270826339722}, {"lo": 1013.5968828201294, "hi": 1033.5968828201294}]
PASS  每条线单独报越限比例  ['TM0S1–TM0S2 940.97 · 图上采样点越限 92.5%TM0S2–TM0S3 1007.5 · 图上采样点越限 88.0%TM0S3–TM0S1 942.56 · 图上采样点越限 84.5%允许 ±10 m（对初始构型）']
PASS  轨道高度曲线按自身采样铺时间轴（窗口≈4200 s，不是被压成 60 s）  x0=39600 x1=43800 span=4200 sub=['前 1 小时 · 点击定位 · 数据源 preview，采样 60 s']
PASS  轨道页有真实数据点  [{"name": "轨道高度（a − 地球半径）", "n": 71, "band": null, "outRatio": null, "firstX": 39600, "lastX": 43800}]
PASS  能源页给出真实空态并点名缺失字段  ['本场景没有可画的发电功率与用电功率曲线当前结果未包含能源时序：power 的 gen_power / platform_power / payload_power 整列为空，battery_soc_pct 字段未提供。']
PASS  热控页给出真实空态并点名缺失字段  ['本场景没有可画的温度测点曲线当前结果未包含温度时序：thermal 的 temp_main 整列为空，且接口定义的逐测点 temp_ 列尚未交付。']
PASS  死控件 #curveSel 已删除  
PASS  缺值区分字段未提供/暂无数据  ['-39.4', '8992', '8993', '字段未提供', '日照', '暂无数据']
PASS  卡片不再用含混的可见/不可见  ['-39.4', '8992', '8993', '字段未提供', '日照', '暂无数据']
右栏截图两两差异(像素): [["formation", "orbit", 39466], ["formation", "attitude", 39180], ["formation", "power", 37390], ["formation", "thermal", 37173], ["orbit", "attitude", 23967], ["orbit", "power", 31743], ["orbit", "thermal", 31122], ["attitude", "power", 31179], ["attitude", "thermal", 30155], ["power", "thermal", 13564]]
PASS  五张标签截图右栏确实不同  最小差异 power vs thermal = 13564 px
[fps 探针] 全部检查跑完: 60.0 fps (Δ120 / 2.0s, vis=visible)
WS 状态 {"state": "paused", "ready": null}；WS 重试类 error 0 条
PASS  控制台无非预期 error  []
PASS  WS 若出现重试，最终仍连上（画面不靠它喂帧，但状态要如实记）  {"ws": {"state": "paused", "ready": null}, "noise": []}
PASS  无未捕获异常  []
PASS  全程没有原生弹窗（alert/confirm 会冻住主线程，三维侧初始化失败就是靠它暴露的）  []
```

## 截图

- `screenshots/phase-02/01-1792-overview.png`
- `screenshots/phase-02/02-1792-panels-collapsed.png`
- `screenshots/phase-02/03-1792-center.png`
- `screenshots/phase-02/04-1366-rail-collapsed.png`
- `screenshots/phase-02/04-1366x768-overview.png`
- `screenshots/phase-02/05-1280x720-overview.png`
- `screenshots/phase-02/06-1792-earth-framing.png`
- `screenshots/phase-02/06-1792-follow.png`
- `screenshots/phase-02/07-1792-inset-and-axes.png`
- `screenshots/phase-02/08-1792-rail-config-block.png`
- `screenshots/phase-02/_crop-chart.png`
- `screenshots/phase-02/tab-attitude.png`
- `screenshots/phase-02/tab-formation.png`
- `screenshots/phase-02/tab-ground.png`
- `screenshots/phase-02/tab-orbit.png`
- `screenshots/phase-02/tab-power.png`
- `screenshots/phase-02/tab-thermal.png`
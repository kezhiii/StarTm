# phase-05 测试记录

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
== phase-05 真实浏览器验收 ==
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
[强制合成帧] 125.0 tick / 2.10s（期间逼帧 21 次, vis=visible）
PASS  循环在跑：强制合成帧口径的 tick 速率落在 25–120（墙钟 60.0 fps 只作参考）  59.5 tick/s
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
PASS  暂停后不再推进  T+00:00:02 / T+00:00:02
PASS  运行态文案与状态一致  运行中 1× / 已暂停
PASS  时间轴拖动同步  {"t": "T+12:00:00", "u": "2026-09-13 16:00:00", "st": "43201 / 86401"}
PASS  选星不重置时间  {"t": "T+12:00:00", "k": "TM0S2", "i": 1}
PASS  收起两栏后场景未被压扁  scene=[1760, 658, 16, 56] canvas=[1758, 657]
PASS  切视角不重建 renderer  sameNode=True
PASS  反复切换后 rAF 未累积重复循环  切换后 48 tick vs 基准 47 tick（同样 8 帧）
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
token 实测: {"--bg-app": "#050d16", "--bg-panel": "#081522", "--bg-panel-raised": "#0b1b2a", "--bg-hover": "#10283a", "--border": "#17364b", "--border-active": "#28cfc8", "--text-primary": "#d7e6f2", "--text-secondary": "#8ba2b5", "--text-muted": "#60788c", "--accent-teal": "#29d7d0", "--accent-blue": "#38a9ff", "--accent-amber": "#ffb83f", "--status-ok": "#35d5b4", "--status-warn": "#ffb83f", "--status-error": "#ff6c5e", "--sat1": "#38a9ff", "--sat2": "#29d7d0", "--sat3": "#ffb83f", "--r1": "6px", "--r2": "8px", "--r3": "10px", "bodyBg": "rgb(5, 13, 22)"}
PASS  V0.3 §11.1 十五个颜色 token 逐字到位  {}
PASS  页面底色就是 --bg-app（不是各组件自带黑）  rgb(5, 13, 22) vs rgb(5, 13, 22)
PASS  圆角只有一档体系（6/8/10px）  ["6px", "8px", "10px"]
圆角分布: {'10px': 4, '6px': 9, '8px': 8}；发光: []；滚动容器: [['NAV#rail', 231], ['DIV#body', 220]]
PASS  圆角不出现 6–10px 档位之外的值（50% 圆形除外）  {}
PASS  辅助文字不低于 11px（V0.3 §11.3）  []
PASS  没有过度发光（强 alpha 或 ≥28px 模糊）  []
PASS  左右面板各自独立滚动，且没有多层嵌套滚动  [["NAV#rail", 231], ["DIV#body", 220]]
独立滚动实测: {"b0": 0, "c0": 0, "after": {"rail": 60, "console": 0}, "back": {"rail": 60, "console": 60}}
PASS  滚动左栏不会带动右栏（反之同样）  {"b0": 0, "c0": 0, "after": {"rail": 60, "console": 0}, "back": {"rail": 60, "console": 60}}
相机工具栏实测: {"list": [["btnReset", 36, 36, true, true], ["btnZoomIn", 36, 36, true, true], ["btnZoomOut", 36, 36, true, true]], "col": true, "gap": 6, "dist": [153.15433392496604, 122.52346713997282, 191.51759710272057, 153.15433392496604]}
PASS  §5.4 复位/放大/缩小三个按钮都在、可用、带 tooltip  [["btnReset", 36, 36, true, true], ["btnZoomIn", 36, 36, true, true], ["btnZoomOut", 36, 36, true, true]]
PASS  §5.4 按钮尺寸 34–40px 且纵向排列、间距 6px  尺寸=[(36, 36), (36, 36), (36, 36)] 纵排=True 间距=6
PASS  放大/缩小真的改变相机到目标的距离  [153.15433392496604, 122.52346713997282, 191.51759710272057, 153.15433392496604]
同色实测: {"vars": ["#38a9ff", "#29d7d0", "#ffb83f"], "dots": ["rgb(56, 169, 255)", "rgb(41, 215, 208)", "rgb(255, 184, 63)"], "meshes": ["00ff00", "00ff00", "00ff00"], "rings": ["38a9ff", "29d7d0", "ffb83f"], "leaders": ["38a9ff", "29d7d0", "ffb83f"], "sel": "28cfc8", "hot": "#28cfc8", "legend": ["", "#38a9ff", "#29d7d0", "#ffb83f"]}
PASS  CSS 变量等于 V0.3 的蓝/青绿/琥珀  ['#38a9ff', '#29d7d0', '#ffb83f']
PASS  列表圆点取的就是这三色  ['rgb(56, 169, 255)', 'rgb(41, 215, 208)', 'rgb(255, 184, 63)']
PASS  对比表头用同一套变量  ['', '#38a9ff', '#29d7d0', '#ffb83f']
PASS  三维轨迹环身份色 = 这三色  ['38a9ff', '29d7d0', 'ffb83f']
PASS  三维引线身份色 = 这三色  ['38a9ff', '29d7d0', 'ffb83f']
PASS  选中环 = --border-active 且不撞任何身份色  环=28cfc8 token=#28cfc8
小窗像素实测: {"wh": [238, 126], "n": 3, "legacyHere": [], "nonbg": ["41,215,208", "40,215,208", "255,184,63", "255,183,63", "46,211,206", "41,214,208"]}
PASS  小窗（RTN 放大）画的也是同一套身份色，且旧调色板已绝迹  {"wh": [238, 126], "n": 3, "legacyHere": [], "nonbg": ["41,215,208", "40,215,208", "255,184,63", "255,183,63", "46,211,206", "41,214,208"]}
PASS  三维模型本体是状态色（绿/红/黄），且界面有文字说明这一点  ['00ff00', '00ff00', '00ff00']
字号记录器在位: top={"min": 11, "n": 40} iframe={"min": 42, "n": 182}
三维标签有效字号反算（全景视角）: 13.13 px
canvas 字号实测: {"top": {"min": 11, "n": 54}, "f": {"min": 42, "n": 182}, "spriteFont": 13.13}
PASS  外层 canvas 字号 ≥11px 且记录器确实 fired（不是初值 99 蒙过去）  {"min": 11, "n": 54}
PASS  三维画面 iframe 的 canvas 字号 ≥11px 且记录器 fired  {"min": 42, "n": 182}
PASS  三维标签的有效字号反算 ≥11px（§11.3 地板要覆盖贴图路径）  反算=13.13 px
字号汇总: 外层={"min": 11, "n": 54} iframe={"min": 42, "n": 182} 反算标签=13.13；XYZ 指示器文字实测={"px": 15.2, "attr": "0.31"}
PASS  XYZ 方向轴字母实测不低于 10.6px  {"px": 15.2, "attr": "0.31"}
PASS  反复开合面板后画布仍贴合容器（resize 由容器驱动）  scene=[1043, 658, 339, 56] canvas=[1042, 657]
PASS  反复开合 6 次后渲染循环没有被重复叠加（每帧工作量不变）  开合前 51 tick / 开合后 54 tick（同样 8 帧）
视觉实测 1792x864: 最小字号=11 违规=[] 溢出=[0, 0]
PASS  1792x864 全站可见文字最小字号 ≥11px  11 px
PASS  1792x864 无文档级溢出  [0, 0]
PASS  1792x864 编队小窗不压住 XYZ 方向轴  {"ox": 0, "oy": 72, "area": 0}
视觉实测 1366x768: 最小字号=11 违规=[] 溢出=[0, 0]
PASS  1366x768 全站可见文字最小字号 ≥11px  11 px
PASS  1366x768 无文档级溢出  [0, 0]
PASS  1366x768 编队小窗不压住 XYZ 方向轴  {"ox": 0, "oy": 72, "area": 0}
视觉实测 1280x720: 最小字号=11 违规=[] 溢出=[0, 0]
PASS  1280x720 全站可见文字最小字号 ≥11px  11 px
PASS  1280x720 无文档级溢出  [0, 0]
PASS  1280x720 编队小窗不压住 XYZ 方向轴  {"ox": 0, "oy": 72, "area": 0}
WS 状态 {"state": "paused", "ready": null}；WS 重试类 error 0 条
PASS  控制台无非预期 error  []
PASS  WS 若出现重试，最终仍连上（画面不靠它喂帧，但状态要如实记）  {"ws": {"state": "paused", "ready": null}, "noise": []}
PASS  无未捕获异常  []
PASS  全程没有原生弹窗（alert/confirm 会冻住主线程，三维侧初始化失败就是靠它暴露的）  []
```

## 截图

- `screenshots/phase-05/01-1792-overview.png`
- `screenshots/phase-05/02-1792-panels-collapsed.png`
- `screenshots/phase-05/03-1792-center.png`
- `screenshots/phase-05/04-1366-rail-collapsed.png`
- `screenshots/phase-05/04-1366x768-overview.png`
- `screenshots/phase-05/05-1280x720-overview.png`
- `screenshots/phase-05/06-1792-earth-framing.png`
- `screenshots/phase-05/06-1792-follow.png`
- `screenshots/phase-05/07-1792-inset-and-axes.png`
- `screenshots/phase-05/08-1792-rail-config-block.png`
- `screenshots/phase-05/10-1792x864-visual.png`
- `screenshots/phase-05/11-1366x768-visual.png`
- `screenshots/phase-05/12-1280x720-visual.png`
- `screenshots/phase-05/13-1792-visual-formation.png`
- `screenshots/phase-05/14-1792-visual-attitude.png`
- `screenshots/phase-05/15-1792-visual-orbit.png`
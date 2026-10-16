# Phase 3 独立审查（第二轮 · 复审放行条件核验）

- 审查者：独立审查子代理（只读；本轮只新增本文件）
- 日期：2026-10-16｜依据：`phase-03-review.md`「复审放行条件（最小集）」
- 取证方式：真实浏览器验收台一次独立实跑（未重启服务端、未并发起第二个浏览器、未 `taskkill` Chrome 全家桶）：

```
cd /e/project_code/serproject && D:/anaconda/python.exe -X utf8 outputs/cdp-check/harness.py phase-03
→ === phase-03: 0 FAIL ===（exit 0，全部截图与记录重写）
跑前检查：wmic 只有 main_fastapi.py(43188) 与 scratch 静态服务(8010)，无其它 harness
```

- 真值复核（不读 64 MB columns.f32）：`sim-data/preview/ground_obs.csv` → el@18000 = 21.1605/21.1282/21.1626，el@60000 = −6.8074/−6.8041/−6.8098；`preview/events.csv` → `可见区间` TM0S1/2/3 各 3 行，t_actual 同为 08:55:56 / 10:31:19 / 22:18:21（17756 s 与第一轮独立反推一致）。

## 结论

**有条件 PASS** —— D1–D7 的整改是真的、且新断言我逐条审过「能失败」；但 D8（流程）一个字没改，且 D3/D6 各有一处只剩代码没有运行时证明，另发现 2 个新缺陷（D9/D10，均不阻塞）。

## 逐条判定

| 项 | 判定 | 我实际跑了什么 / 读了哪一行 |
|---|---|---|
| D1 事件跨星选中 | **满足** | `panels.js:596-610` 确认选中星过滤已删（注释点名 D1）；`main.js:442-451` 点击 handler：`seekSeconds(sec)` + `selectSat(sat)`。实跑：evCount 13→**19**（3+9+3+3+1，三星窗口全画）；`phase-03-test.md:84` 第一条点事件 before=TM0S2→after=**TM0S1**（过去恒真式现在真的跨了星）；`:88` 跨星断言：先选 S1（before=TM0S1），点 `data-sat=3` 标记 → after=**TM0S3**、tplus=T+04:55:56=该标记 data-sec(17756) 换算，hit=true。S3 的 17756 我用 events.csv 独立对上 |
| D2 点表格行高亮天空视图 | **满足** | `first-person.js:247-249` 与 `interpolation.js:216-218` 每帧按 `selectedSatIdx` 写 scale 2.2/1；`playback-manager.js:1271-1272` `__probe().skyScale/skyVis`。实跑 `phase-03-test.md:91`：依次点行 1/3/2，`sc` 数组分别只有下标 0/2/1 为 2.2、其余全 1，且 kvSat 同步 TM0S1/3/2 —— 三个方向都能失败 |
| D3 follow(null) 视角守卫 | **代码满足，运行时证据不完整** | `playback-manager.js:1202-1211`：复位分支加 `appState.currentView === 'third'` 守卫；`main.js:17-27 setSceneButtons`：`btnDaylight` 在地面观察下 disabled+title；`main.js:186` setPageView 末尾调用。**但 harness 全文 grep `Daylight` 0 命中**——btnDaylight 禁用无断言；地面视角下 `__probe().cam` 也无数值断言（共享块 `:37` 只断言 camSelDisabled+view=first）。间接证据：本轮实拍 `09-1792-ground.png` 是正常站心天空（地平网格+星标+hero 54.03/21.16），不是 153 单位外的全景——若守卫失效这张图应是空白/外景 |
| D4 行号换算 | **满足** | `panels.js:106` 所有源统一走 `epFor`（binary 时恒等）；`runsOf:581`、`nextWindow:318-320`、`exportRows:685-698` 改用 `stepOf(e)`（导出还跳过时间基不一致的文件）；`main.js:346-355` 启动比对 `binStep()` 与 `stepIntervalSec`，不一致 setRun(error)+toast+中止挂载。实跑：时间基显示「步长 1 s」、全部读数对账 PASS。报错分支本身无运行时触发（要改数据才能测，可接受） |
| D5 orbitAt 按 id 认领 | **满足（代码）** | `playback-manager.js:1133-1138` 回传 `sat_id`；`panels.js:135-142` `rows.find(x => Number(x.sat_id) === sat)`，找不到返回 `missingField('该星无星历行')`。无「乱序/缺行数据」的运行时证伪（防御性修复，当前数据三星连续块），但见新缺陷 **D10**：同样的 id 认领在插值路径漏了一半 |
| D6 setCameraMode 空桥回滚 | **代码满足，回滚分支无运行时证明** | `main.js:159-167`：`!bridge` 时把 `#camSel` 回滚为 store 值 + toast「三维画面未就绪，相机模式没有改动」，不再先 patch。地面禁用半边有证据（实跑 `:37` camSelDisabled=true）；**回滚半边**：harness 里 `detachForTest` 只在 phase-06 用（`:1301`），且掉线期间没有任何 camSel 操作断言 → 「代码已改但无运行时证明」 |
| D7 断言强度 | **满足** | ①播放推进 `harness.py:441-444`：改比 `T+` 秒数增量 ∈[1,12]（实跑「T+ 走了 2 s / 墙钟 3 s」），文案另立一条不当主证；②T+/UTC `:817-821`：真比较 `utc=='2026-09-13 20:40:00'`/`09:00:00`（t0=04:00:00 + 60000/18000 s，我独立算过）；③仰角 `:825-827`：期望值 `21.2/21.1/21.2` 与 `-6.8/-6.8/-6.8` 来自第一轮 columns.f32 独立实测，我用 preview/ground_obs.csv 复核 toFixed(1) 后逐位吻合（写成 `—` 会 FAIL，`_n` 归一 U+2212 后仍要求相等） |
| D8 流程：验收矩阵引用审查 | **不满足** | `FINAL_ACCEPTANCE.md:15` 仍是「并入 Phase 2/5 复审｜通过」，未改为引用 `phase-03-review.md`；`:109` 仍写「phase-03-review.md 待补」（文件早已存在）；§2b 轮次表没有 Phase 3 行。第一轮放行条件第 5 条明文要求改这一行，没做 |

## 新断言可失败性审计（「什么输入让它 FAIL / 期望值哪来的」）

- D1 两条：删掉 `panels.js:604` 的 sat 解析或去掉 selectSat → FAIL；无 S3 标记（回到选中星过滤）→ `none:true` → FAIL；时刻不来自实现文案，来自标记自身 data-sec 的纯算术换算（harness 自己写的 `pad/exp`）。残留弱点：三颗星窗口 t_actual 相同，「时刻相等」对该标记区分度低——但「选中必须从 S1 变到 S3」补足了指认。
- D2：期望「只有 want−1 那格 >1.5」是结构判据不是抄文案；scale 不写、写错颗、kvSat 不同步都会 FAIL。数组长 61 的原因我查了：`app.js:334` 从后端拿 `satCount`（平台 61 颗）建网格、CSV 只更新前 3 颗、其余常驻 hidden(scale=1)——不是「切视角累积泄漏」，harness `:795-799` 的注释猜错了原因，但判据恰好因此仍然成立（隐藏网格永远 1，不会污染 big）。
- D7③ 的期望值锚在两份独立数据源（columns.f32 与 preview CSV 同值），不是实现自产文案——这次没有「38,169,255」式的照抄错误。

## 新发现缺陷

- **D9（轻）三星同刻事件标记完全重叠，真实鼠标只能点中最上层那颗。** `panels.js:629` 按 `left:%` 定位，S1/S2/S3 的 `可见区间` t_actual 逐秒相同 → 三个 6 px 标记同一坐标；harness 用 `dispatchEvent` 直接打到指定元素，绕过了命中测试，所以「点 S1 的窗口标记」在真实交互里做不到。建议：同类标记按星错开一点垂直偏移，或 hover 出列表。
- **D10（轻-中）D5/D2 的「按 sat_id 认领」只修了一半：插值路径仍按数组下标配对。** `interpolation.js:139,217-218` 用 `interpData.forEach((satData, idx)` 的 `idx` 直接对 `satelliteMeshes1D[idx]` 写位置与选中 scale，从不看 `satData[1]`（sat_id）；而 `first-person.js:242-249` 已改成 `sats.find(s => s.sat_id === idx+1)`。播放中每帧走的是前者——数据一旦历元主序/缺行，天空视图的星身份与选中态会静默错位，正是 D5 要堵的洞。当前数据（三星升序连续块）不发作，且现有断言在暂停态走 first-person 路径，测不到它。建议 3 行改成按 satData[1] 认领。

## 仍缺的运行时证明（不送 PASS 的部分）

1. D3：地面观察下 `__probe().cam` 的数值断言（期望 ≈[0,0,0]）；`btnDaylight.disabled===true && title` 的断言（现只有截图间接证据）。
2. D6：`detachForTest` 掉线期间操作 `#camSel` → 断言 value 回滚 + toast 文案（phase-06 已有掉线场景，加 3 行即可）。
3. D4 报错分支与 D5 缺行分支：无数据可触发，登记为「结构性防御、未证伪」即可，不要求造数据。
4. D10 修复后需要一条**播放中**（走插值路径）的 skyScale 断言，否则选中态在播放时依旧无人验证。

## 环境披露

服务端 127.0.0.1:8000 未重启；本轮只启动过验收台自己的 Chrome（atexit 收整棵进程树，未动用户浏览器）；未做重 I/O 扫描（64 MB columns.f32 一次都没读，真值全部来自 preview CSV 与第一轮记录）；未修改任何实现文件。

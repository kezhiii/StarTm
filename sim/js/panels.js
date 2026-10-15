import { loadCategory, getValue, getStepSec, lastSecond } from './loader.js?v=32';
import { createChart } from './chart.js?v=32';

const $ = (id) => document.getElementById(id);
// 三星身份色：与三维轨迹线、图例、曲线图例同一套，跨视图不变（方案 §8.1）
export const SAT_COLORS = ['#7fe3d6', '#6fa8dc', '#e8a33d'];
const colorOf = (sat) => SAT_COLORS[(sat - 1) % SAT_COLORS.length];
const SERIES_COLORS = SAT_COLORS;

// 选中目标的四格大字：按标签归类，轨道页另有一组
const HERO = {
    orbit: [
        { field: 'sma', file: 'orbit', name: '轨道高度', unit: 'km', sub: true },
        { field: 'speed', file: 'orbit', name: '速度', unit: 'km/s' },
        { field: 'range', file: 'ground_obs', name: '站心斜距', unit: 'km' },
        { field: 'el', file: 'ground_obs', name: '仰角', unit: '°' },
    ],
    attitude: [
        { field: 'att_mode', file: 'attitude', name: '姿态模式', unit: '' },
        { field: 'incidence_deg', file: 'sun_eclipse', name: '太阳入射角', unit: '°' },
        { field: 'array_proj_factor', file: 'sun_eclipse', name: '有效投影系数', unit: '' },
        { field: 'off_axis', file: 'ground_obs', name: '目标离轴角', unit: '°' },
    ],
    power: [
        { field: 'gen_power', file: 'power', name: '发电功率', unit: 'W' },
        { field: 'load_power', file: 'power', name: '用电功率', unit: 'W', calc: ['platform_power', 'payload_power'] },
        { field: 'battery_soc_pct', file: 'power', name: '电池 SOC', unit: '%' },
        { field: 'battery_margin', file: 'power', name: '电量裕度', unit: '%' },
    ],
    thermal: [
        { field: 'temp_main', file: 'thermal', name: '主要设备温度', unit: '℃' },
        { field: 'equip_power', file: 'thermal', name: '设备发热', unit: 'W' },
        { field: 'ext_heatflux', file: 'thermal', name: '外热流', unit: 'W/m²' },
        { field: 'over_limit_count', file: 'thermal', name: '超限节点数', unit: '个' },
    ],
};
const BADGES = [
    { field: 'stable', file: 'attitude', name: '稳定', bool: true },
    { field: 'visible', file: 'ground_obs', name: '单星可见', bool: true },
    { field: 'common_vis', file: 'ground_obs', name: '共同可见', bool: true },
    { field: 'plan_strobe', file: 'display', name: '计划点亮', bool: true },
    { field: 'actual_strobe', file: 'display', name: '实际点亮', bool: true },
];
// 表2-1 八组按语义归到四个标签，全参数仍可查，不因改版丢验收项
const TAB_GROUPS = {
    orbit: ['①', '②'],
    attitude: ['③', '④', '⑤'],
    power: ['⑥'],
    thermal: ['⑦'],
    formation: ['⑧'],
};
const EDGE_FIELDS = ['edge_12', 'edge_23', 'edge_31'];
const EDGE_LABEL = { edge_12: '1-2', edge_23: '2-3', edge_31: '3-1' };
const SHADOW_STATE = ['日照', '半影', '本影'];
// 事件按类别给形状，颜色不再独自承担含义（方案 §4.3）
const EVENT_CLASS = (c) => ({
    '点亮': 'strobe', '熄灭': 'strobe',
    '可见区间': 'window', '显示任务': 'task',
    '转向': 'maneuver', '恢复': 'maneuver', '控制': 'maneuver',
    '进地影': 'eclipse', '出地影': 'eclipse',
}[c] || 'other');

let cfg = null;              // { groups, charts, display }
let entries = {};            // 文件名 → loader entry
let missing = new Set();
let nominal = {};            // 'file.field' → 首历元值，作为构型保持的标称
let sats = [1, 2, 3];
let selectedSat = 1;
let activeTab = 'formation';
let activeView = 'formation';
let charts = {};
let spanSec = 0;
let marks = [];              // 时间标尺上的可解释标记：{from,to,tip}
let t0ms = 0;                // 数据起点（UTC 毫秒），事件表只有绝对时刻
let hooks = {};

const key = (file, field) => `${file}.${field}`;
const isNotComputed = (file, field) => (cfg.display.notComputed || []).includes(key(file, field));

// ── 取值与四态：未接入 / 尚未计算 / 暂不可用 / 数据异常 ──
function read(file, field, sat, epoch, scale) {
    if (missing.has(file) || !entries[file]) return { kind: 'notConnected', text: '未接入' };
    if (isNotComputed(file, field)) return { kind: 'na', text: '尚未计算' };
    const raw = getValue(entries[file], epoch, sat, field);
    if (raw === null || raw === undefined || raw === '') return { kind: 'na', text: '暂不可用' };
    if (/^-?\d+(\.\d+)?$/.test(raw)) {
        const n = Number(raw) * (scale || 1);
        return Number.isFinite(n) ? { kind: 'num', n, raw: Number(raw) } : { kind: 'bad', text: '数据异常' };
    }
    return { kind: 'text', text: raw };
}

// 由若干列求和（用电功率 = 平台 + 载荷）；任一列缺值即整体不可得，不拿 0 顶
function sumOf(file, fields, sat, epoch) {
    let acc = 0, got = false;
    for (const f of fields) {
        const v = read(file, f, sat, epoch, 1);
        if (v.kind !== 'num') continue;
        acc += v.n; got = true;
    }
    return got ? { kind: 'num', n: acc } : { kind: 'na', text: '暂不可用' };
}

function heroValue(h, sat, epoch) {
    if (h.file === 'orbit') return orbitAt(sat, epoch, h.field);
    if (h.calc) return sumOf(h.file, h.calc, sat, epoch);
    return read(h.file, h.field, sat, epoch, 1);
}

// 轨道高度与速度只有 14 列投影里有，向桥要当前帧，不在这一页再解析 38 MB CSV
function orbitAt(sat, epoch, field) {
    const rows = hooks.orbitAt ? hooks.orbitAt(epoch) : null;
    if (!rows) return { kind: 'notConnected', text: '未接入' };
    const r = rows[sat - 1];
    if (!r) return { kind: 'na', text: '暂不可用' };
    const n = field === 'sma' ? r.a - 6378.137 : Math.hypot(r.Vx, r.Vy, r.Vz);
    return Number.isFinite(n) ? { kind: 'num', n } : { kind: 'na', text: '暂不可用' };
}

function fmt(v) {
    const dp = Math.abs(v) >= 10000 ? 0 : Math.abs(v) >= 1000 ? 1 : 2;
    return v.toFixed(dp);
}

function cell(v) {
    if (v.kind === 'num') return { text: fmt(v.n), cls: '' };
    if (v.kind === 'text') return { text: v.text, cls: '' };
    if (v.kind === 'bad') return { text: v.text, cls: 'bad' };
    return { text: v.text, cls: 'na' };
}

function hms(sec) {
    const p = n => String(n).padStart(2, '0');
    const s = Math.max(0, Math.floor(sec));
    return `${p(Math.floor(s / 3600))}:${p(Math.floor(s % 3600 / 60))}:${p(s % 60)}`;
}

// 数据滞后：仿真时刻超出该文件覆盖范围的部分（离线文件内部不存在滞后）
function lagOf(file, simSeconds) {
    const e = entries[file];
    if (!e || missing.has(file)) return 0;
    return Math.max(0, simSeconds - lastSecond(e));
}

// ── 左栏：卫星列表（状态一律带文字，不只靠颜色） ────
function buildTargets() {
    const host = $('tgtList');
    host.innerHTML = '';
    sats.forEach(id => {
        const b = document.createElement('button');
        b.className = 'tgt';
        b.type = 'button';
        b.dataset.sat = id;
        b.style.setProperty('--satc', colorOf(id));
        b.setAttribute('aria-current', String(id === selectedSat));
        b.innerHTML = `<span class="n"><i class="dot"></i>TM0S${id}<span class="st" data-r="st">未加载</span></span>` +
            `<span class="g">` +
            `<span><em>光照</em><b data-r="light">—</b></span>` +
            `<span><em>SOC</em><b data-r="soc">—</b></span>` +
            `<span><em>温度</em><b data-r="temp">—</b></span>` +
            `<span><em>仰角</em><b data-r="el">—</b>°</span>` +
            `<span><em>斜距</em><b data-r="rg">—</b>km</span>` +
            `</span>`;
        b.onclick = () => selectSat(id);
        host.appendChild(b);
    });
    $('tgtCount').textContent = sats.length + ' 颗';
}

export function selectSat(id) {
    selectedSat = id;
    [...$('tgtList').children].forEach(x => x.setAttribute('aria-current', String(Number(x.dataset.sat) === id)));
    $('kvSat').textContent = 'TM0S' + id;
    if (hooks.onSelect) hooks.onSelect(id);
    if (spanSec) paintWindows();
    render(hooks.simSeconds());
}

export function getSelectedSat() { return selectedSat; }
export function satColor(id) { return colorOf(id); }

// ── 视图与标签 ─────────────────────────────────────
export function setView(view) {
    activeView = view;
    [...$('viewTabs').children].forEach(b => {
        const on = b.dataset.view === view;
        b.classList.toggle('on', on);
        b.setAttribute('aria-selected', String(on));
    });
    if (view === 'ground') setTab('ground');
    else if (view === 'satellite') setTab('orbit');
    else setTab('formation');
    render(hooks.simSeconds ? hooks.simSeconds() : 0);
}

export function setTab(tab) {
    activeTab = tab;
    [...$('detailTabs').children].forEach(b => {
        const on = b.dataset.tab === tab;
        b.classList.toggle('on', on);
        b.setAttribute('aria-selected', String(on));
    });
    const satPane = tab !== 'formation' && tab !== 'ground';
    $('tabFormation').hidden = tab !== 'formation';
    $('tabGround').hidden = tab !== 'ground';
    $('tabSat').hidden = !satPane;
    render(hooks.simSeconds ? hooks.simSeconds() : 0);
}

export function getTab() { return activeTab; }
export function getView() { return activeView; }

// ── 右栏：选中目标大字区 ───────────────────────────
function renderHero(epoch) {
    const rows = HERO[activeTab] || HERO.orbit;
    $('hero').innerHTML = rows.map(h => {
        const v = heroValue(h, selectedSat, epoch);
        const c = cell(v);
        const bad = v.kind === 'num' && h.field === 'el' && v.n < cfg.display.minElevationDeg;
        return `<div class="cell"><div class="k">${h.name}</div>` +
               `<div class="v ${bad ? 'bad' : c.cls}">${c.text}${h.unit && !c.cls ? `<u>${h.unit}</u>` : ''}</div></div>`;
    }).join('');
}

// 光照状态取自星历算出的日/地圆盘遮挡判定，不靠画面黑不黑来猜
function shadowBadge(epoch, sat) {
    const st = read('sun_eclipse', 'shadow_state', sat, epoch, 1);
    if (st.kind !== 'num') return `<span class="tag na"><i></i>光照 ${st.text}</span>`;
    const ratio = read('sun_eclipse', 'sun_ratio', sat, epoch, 1);
    const sep = read('sun_eclipse', 'sun_sep_deg', sat, epoch, 1);
    const mg = read('sun_eclipse', 'umbra_margin_km', sat, epoch, 1);
    const pf = read('sun_eclipse', 'array_proj_factor', sat, epoch, 1);
    const i = Math.round(st.raw);
    const cls = i === 0 ? 'ok' : i === 1 ? 'warn' : 'bad';
    const pct = ratio.kind === 'num' ? Math.round(ratio.n * 100) + '%' : '—';
    const sepTxt = sep.kind === 'num' ? sep.n.toFixed(2) + '°' : '—';
    // 本影裕度 = 地心到「卫星—太阳」连线的垂距 − 地球半径，正数即地球遮不住日面。
    // 状态词只认 shadow_state：晨侧垂距也可能小于地半径，那时并没有被遮挡。
    const margin = mg.kind === 'num'
        ? ` · 本影裕度 ${mg.n >= 0 ? '+' : ''}${Math.abs(mg.n) < 10 ? mg.n.toFixed(1) : Math.round(mg.n)} km` : '';
    const tip = `日面可见比例 ${pct}，日下点角距 ${sepTxt}，有效投影系数`
        + `${pf.kind === 'num' ? ' ' + pf.n.toFixed(3) : ' —'}，本影裕度`
        + `${mg.kind === 'num' ? ' ' + (mg.n >= 0 ? '+' : '') + Math.round(mg.n) + ' km' : ' —'}`
        + '（地心到卫星—太阳连线的垂距减地球半径，>0 即在本影之外；画面上的夜半球不代表被遮挡）'
        + '——按卫星看日面与地面的圆盘遮挡判定';
    return `<span class="tag ${cls}" title="${tip}"><i></i>光照 ${SHADOW_STATE[i] || st.text} · 日面 ${pct}${margin}</span>`;
}
function lightWord(v) {
    return v.kind === 'num' ? (SHADOW_STATE[Math.round(v.raw)] || '—') : v.text;
}

function renderBadges(epoch) {
    $('badges').innerHTML = shadowBadge(epoch, selectedSat) + BADGES.map(b => {
        const v = read(b.file, b.field, selectedSat, epoch, 1);
        if (b.bool && v.kind === 'num') {
            return `<span class="tag ${v.raw === 1 ? 'ok' : 'na'}"><i></i>${b.name} ${v.raw === 1 ? '是' : '否'}</span>`;
        }
        const c = cell(v);
        return `<span class="tag ${c.cls === 'na' ? 'na' : ''}"><i></i>${b.name} ${c.text}</span>`;
    }).join('');
}

function nextWindow(simSeconds) {
    const e = entries.ground_obs;
    if (!e) return '';
    const stepSec = getStepSec();
    for (let ep = Math.floor(simSeconds / stepSec); ep < e.nEpoch; ep++) {
        if (Number(getValue(e, ep, selectedSat, 'common_vis')) === 1) return `下一窗口 T+${hms(ep * stepSec)}`;
    }
    return '此后无窗口';
}

// ── 编队总览：状态四格 + 三星关键指标对比 ───────────
function renderFormation(epoch, simSeconds) {
    const d = cfg.display;
    const edges = EDGE_FIELDS.map(f => read('formation_geom', f, 1, epoch, 1000));
    const nums = edges.filter(e => e.kind === 'num').map(e => e.n);
    const avg = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
    const devs = edges.filter(e => e.kind === 'num')
        .map((e, i) => Math.abs(e.n - (nominal['formation_geom.' + EDGE_FIELDS[i]] || 1000)));
    const worst = devs.length ? Math.max(...devs) : null;
    const online = sats.filter(s => {
        const v = read('ground_obs', 'visible', s, epoch, 1);
        return v.kind === 'num' && v.raw === 1;
    }).length;
    $('formationHero').innerHTML = [
        ['三颗卫星', `${online} / ${sats.length} 可见`, online === sats.length ? 'ok' : ''],
        ['星间距离（平均）', avg === null ? '暂不可用' : avg.toFixed(1) + ' km', avg === null ? 'na' : ''],
        ['构型偏差', worst === null ? '暂不可用' : worst.toFixed(1) + ' m',
            worst === null ? 'na' : (worst > d.edgeToleranceM ? 'bad' : 'ok')],
        ['当前时刻', 'T+' + hms(simSeconds), ''],
    ].map(([k, v, cls]) => `<div class="cell"><div class="k">${k}</div>` +
        `<div class="v ${cls || ''}" style="font-size:${String(v).length > 9 ? 16 : 24}px">${v}</div></div>`).join('');
    $('kvFormationTag').textContent = worst === null ? '' : `允许 ±${d.edgeToleranceM} m`;

    const rows = [
        ['光照状态', s => lightWord(read('sun_eclipse', 'shadow_state', s, epoch, 1))],
        ['电池 SOC', s => { const v = read('power', 'battery_soc_pct', s, epoch, 1);
                            return v.kind === 'num' ? v.n.toFixed(0) + ' %' : v.text; }],
        ['发电功率', s => { const v = read('power', 'gen_power', s, epoch, 1);
                            return v.kind === 'num' ? v.n.toFixed(0) + ' W' : v.text; }],
        ['用电功率', s => { const v = sumOf('power', ['platform_power', 'payload_power'], s, epoch);
                            return v.kind === 'num' ? v.n.toFixed(0) + ' W' : v.text; }],
        ['关键温度', s => { const v = read('thermal', 'temp_main', s, epoch, 1);
                            return v.kind === 'num' ? v.n.toFixed(1) + ' ℃' : v.text; }],
    ];
    // 星间距离是编队量，列在三颗星的格子里会重复三遍，单独一行放在对比表下方
    const edgeLine = EDGE_FIELDS.map(f => {
        const v = read('formation_geom', f, 1, epoch, 1000);
        return `${EDGE_LABEL[f]} ${v.kind === 'num' ? v.n.toFixed(2) : '—'}`;
    }).join(' · ');
    const head = `<tr><th>指标</th>${sats.map(s =>
        `<th style="--satc:${colorOf(s)}">TM0S${s}</th>`).join('')}</tr>`;
    $('cmpBody').innerHTML = `<table>${head}` + rows.map(([name, fn]) => {
        const cells = sats.map(s => fn(s));
        const na = cells.every(c => /未|暂|—/.test(c));
        const cls = na ? 'na' : (/不可见|本影|异常/.test(cells.join('')) ? 'bad' : '');
        return `<tr><td>${name}</td>${cells.map(c => `<td class="${cls}">${c}</td>`).join('')}</tr>`;
    }).join('') +
        `<tr><td>星间距离 km</td><td colspan="${sats.length}" style="text-align:left">${edgeLine}</td></tr>` +
        `</table>`;
    $('cmpSatNote').textContent = '无数据的项显示"未计算"，不以 0 代替';
}

function renderMission(epoch, simSeconds) {
    const d = cfg.display;
    const edges = EDGE_FIELDS.map(f => read('formation_geom', f, 1, epoch, 1000));
    const devs = edges.filter(e => e.kind === 'num')
        .map((e, i) => Math.abs(e.n - (nominal['formation_geom.' + EDGE_FIELDS[i]] || 1000)));
    const worst = devs.length ? Math.max(...devs) : null;
    const cv = read('ground_obs', 'common_vis', selectedSat, epoch, 1);
    const lag = Math.max(lagOf('ground_obs', simSeconds), lagOf('formation_geom', simSeconds));
    const rows = [
        ['构型偏差', worst === null ? { text: '暂不可用' } : { text: worst.toFixed(1) + ' m', cls: worst > d.edgeToleranceM ? 'bad' : 'ok' }, `允许 ±${d.edgeToleranceM} m（对初始构型）`],
        ['三星共同可见', cv.kind === 'num' ? { text: cv.raw === 1 ? '可见' : '不可见', cls: cv.raw === 1 ? 'ok' : 'na' } : { text: '暂不可用' }, nextWindow(simSeconds)],
        ['数据滞后', lag > d.lagThresholdSec ? { text: lag.toFixed(0) + ' s', cls: 'bad' } : { text: '同步', cls: 'ok' }, `门限 ${d.lagThresholdSec} s`],
    ];
    $('missionSum').innerHTML = rows.map(([k, v, note]) =>
        `<div class="kv"><span>${k}</span><b class="${v.cls || ''}">${v.text}</b></div>` +
        `<div class="kv"><span></span><b style="color:var(--dim);font-size:11px">${note || ''}</b></div>`).join('');
    $('kvLag').textContent = lag > d.lagThresholdSec ? `滞后 ${lag.toFixed(0)} s` : '与数据同步';
    $('kvLag').style.color = lag > d.lagThresholdSec ? 'var(--bad)' : 'var(--dim)';

    let alarms = 0;
    if (worst !== null && worst > d.edgeToleranceM) alarms++;
    const st = read('attitude', 'stable', selectedSat, epoch, 1);
    if (st.kind === 'num' && st.raw === 0) alarms++;
    hooks.onAlarms(alarms);
}

// ── 参数表：按标签过滤，全参数仍收在折叠区 ──────────
function renderTable(epoch) {
    const main = $('panelBody'), tele = $('telemetryBody'), pane = $('tabPanes');
    main.innerHTML = ''; tele.innerHTML = '';
    const groupsOf = (tab) => cfg.groups.filter(g => (TAB_GROUPS[tab] || []).some(p => (g.name || '').startsWith(p)));
    const block = (list) => list.map(g => `<tr class="group"><td colspan="3">${g.name}</td></tr>` +
        g.rows.map(row => {
            const v = read(row.file, row.field, selectedSat, epoch, row.scale);
            const c = cell(v);
            return `<tr><td class="name" title="${row.ref || ''}">${row.name}</td>` +
                   `<td class="val ${c.cls}">${c.text}</td><td class="unit">${row.unit || ''}</td></tr>`;
        }).join('')).join('');
    const cur = groupsOf(activeTab);
    pane.innerHTML = cur.length ? `<table class="ptable"><tbody>${block(cur)}</tbody></table>` : '';
    for (const g of cfg.groups) {
        const out = g.panel === 'telemetry' ? tele : main;
        out.insertAdjacentHTML('beforeend', block([g]));
    }
}

// ── 地面观察读数 ───────────────────────────────────
function renderGround(epoch) {
    const host = $('groundBody');
    if (!host) return;
    const rows = sats.map(s => {
        const az = read('ground_obs', 'az', s, epoch, 1);
        const el = read('ground_obs', 'el', s, epoch, 1);
        const rg = read('ground_obs', 'range', s, epoch, 1);
        const above = el.kind === 'num' ? (el.n >= 0 ? '地平以上' : '地平以下') : el.text;
        return `<tr><td>TM0S${s}</td>` +
            `<td class="${az.kind === 'num' ? '' : 'na'}">${az.kind === 'num' ? az.n.toFixed(1) + '°' : az.text}</td>` +
            `<td class="${el.kind === 'num' ? (el.n >= 0 ? 'ok' : '') : 'na'}">${el.kind === 'num' ? el.n.toFixed(1) + '°' : el.text}</td>` +
            `<td class="${rg.kind === 'num' ? '' : 'na'}">${rg.kind === 'num' ? rg.n.toFixed(0) + ' km' : rg.text}</td>` +
            `<td class="${el.kind === 'num' && el.n < 0 ? 'na' : ''}">${above}</td></tr>`;
    }).join('');
    host.innerHTML = `<table><tr><th>目标</th><th>方位角</th><th>仰角</th><th>斜距</th><th>状态</th></tr>${rows}</table>`;
}

// ── 趋势图 ──────────────────────────────────────────
function buildCharts() {
    for (const spec of cfg.charts) {
        const host = $(spec.id);
        if (!host) continue;
        if ((cfg.display.notComputed || []).some(k => spec.series.some(s => k === `${spec.file}.${s.field}`))) {
            host.hidden = true;      // 全为未计算量的图不画，避免把恒 0 线当成完美保持
            continue;
        }
        host.innerHTML = `<div class="ch-hd"><h3>${spec.title}</h3><span class="sub"></span></div>` +
            `<canvas></canvas><div class="legend"></div>`;
        const cv = host.querySelector('canvas');
        cv.setAttribute('role', 'img');
        cv.setAttribute('aria-label', `${spec.title} 趋势图`);
        cv.addEventListener('charthover', e => showTip(e.detail, spec));
        cv.addEventListener('chartleave', hideTip);
        charts[spec.id] = { spec, host, cv, chart: createChart(cv, { onPick: sec => hooks.onSeek && hooks.onSeek(sec) }) };
    }
}

function seriesFor(spec, epLo, epHi) {
    const e = entries[spec.file];
    if (!e) return [];
    const stepSec = getStepSec();
    const stride = Math.max(1, Math.ceil((epHi - epLo) / 600));   // 1 秒数据抽到 ≤600 点，画得快也不糊
    // 三条边长按"组"上色而不是按星：一条边对应两颗星，用星色会误导
    return spec.series.map((s, i) => {
        const data = [];
        for (let ep = epLo; ep <= epHi; ep += stride) {
            const v = read(spec.file, s.field, spec.perSat ? selectedSat : 1, ep, spec.scale);
            if (v.kind === 'num') data.push({ x: ep * stepSec, y: v.n });
        }
        return { name: s.name, color: s.color || SERIES_COLORS[i % SERIES_COLORS.length], data };
    });
}

function renderCharts(simSeconds) {
    const stepSec = getStepSec();
    const nEpoch = Math.max(...Object.values(entries).map(e => e.nEpoch || 1));
    const epHi = Math.min(nEpoch - 1, Math.floor((simSeconds + 600) / stepSec));
    const epLo = Math.max(0, Math.floor((simSeconds - 3600) / stepSec));
    for (const { spec, chart, host } of Object.values(charts)) {
        if (host.hidden) continue;
        const d = cfg.display;
        const opts = { cursor: simSeconds };
        if (spec.bandFromNominal) {
            const nom = nominal[`${spec.file}.${spec.series[0].field}`];
            if (nom) {
                const tol = spec.band === 'tolerance' ? d.edgeToleranceM : d.driftToleranceM;
                opts.band = { lo: nom - tol, hi: nom + tol };
                opts.plan = { y: nom };
            }
        } else if (spec.band) opts.band = { lo: spec.band[0], hi: spec.band[1] };
        if (spec.plan != null) opts.plan = { y: spec.plan };
        if (spec.gate && d.sunAltGate.enabled) opts.plan = { y: d.sunAltGate.thresholdDeg };
        chart.setData(seriesFor(spec, epLo, epHi), opts);
        host.querySelector('.legend').innerHTML = spec.series.map((s, i) => {
            const v = read(spec.file, s.field, spec.perSat ? selectedSat : 1,
                Math.floor(simSeconds / stepSec), spec.scale);
            return `<span style="color:${s.color || SERIES_COLORS[i % SERIES_COLORS.length]}"><i></i>${s.name} ` +
                   `<b>${v.kind === 'num' ? fmt(v.n) : '—'}</b></span>`;
        }).join('') + [
            opts.plan ? `<span style="color:var(--plan)"><i class="dash"></i>${spec.planLabel || '标称'} ${fmt(opts.plan.y)}</span>` : '',
            opts.band ? `<span style="color:var(--bad)"><i></i>${spec.bandLabel || `允许 ±${d.edgeToleranceM} m`}</span>` : '',
            spec.gate && !cfg.display.sunAltGate.enabled ? '<span style="color:var(--dim)">天黑门限（当前关闭）</span>' : '',
        ].join('');
        host.querySelector('.sub').textContent = '前 1 小时 · 点击定位';
    }
}

function showTip(detail, spec) {
    const tip = $('tip');
    tip.style.display = 'block';
    tip.style.left = Math.min(detail.clientX + 12, innerWidth - 260) + 'px';
    tip.style.top = (detail.clientY - 34) + 'px';
    tip.textContent = `T+${hms(detail.x)}  ${detail.name} ${fmt(detail.y)} ${spec.unit}`;
}
function hideTip() { const t = $('tip'); if (t) t.style.display = 'none'; }

// ── 时间标尺窗口带与事件 ───────────────────────────
function runsOf(file, field, cls) {
    const e = entries[file];
    if (!e || missing.has(file) || isNotComputed(file, field)) return [];
    const stepSec = getStepSec();
    const out = [];
    let start = null;
    for (let ep = 0; ep <= e.nEpoch; ep++) {
        const on = ep < e.nEpoch && Number(getValue(e, ep, selectedSat, field)) === 1;
        if (on && start === null) start = ep;
        if (!on && start !== null) { out.push({ cls, from: start * stepSec, to: ep * stepSec }); start = null; }
    }
    return out;
}

// 事件表按真实时刻单点显示（不插值），换算成相对秒后标在时间轴上
function eventMarks() {
    const e = entries.events;
    if (!e || !t0ms) return [];
    const skip = cfg.display.timelineEventSkip || [];
    return e.rows.filter(r => !skip.includes(r.category))
        .filter(r => r.category !== '可见区间' || r.sat_id === 'TM0S' + selectedSat)
        .map(r => {
            const sec = (Date.parse((r.t_actual || '').replace(' ', 'T') + 'Z') - t0ms) / 1000;
            if (!Number.isFinite(sec) || sec < 0 || sec > spanSec) return null;
            return { from: sec, to: sec + (Number(r.duration_s) || 0), cls: EVENT_CLASS(r.category),
                     tip: `事件「${r.category}」${r.sat_id} T+${hms(sec)}` +
                          `${r.duration_s ? ` 起 ${Math.round(r.duration_s)} s` : ''}${r.reason ? `（${r.reason}）` : ''}` };
        }).filter(Boolean);
}

function paintWindows() {
    const host = $('tlBands');
    if (!host || !spanSec) return;
    const runs = [...runsOf('ground_obs', 'common_vis', ''), ...runsOf('display', 'effective', 'disp')];
    host.innerHTML = runs.map(r => {
        const left = r.from / spanSec * 100, width = Math.max((r.to - r.from) / spanSec * 100, .3);
        const label = (r.cls === 'disp' ? '有效显示 ' : '共同可见 ') +
            `T+${hms(r.from)} → T+${hms(r.to)}（${Math.round(r.to - r.from)} s）`;
        return `<div class="band${r.cls}" style="left:${left}%;width:${width}%" ` +
               `data-tip="${label}" data-from="${r.from}" data-to="${r.to}"></div>`;
    }).join('');
    marks = [...runs.map(r => ({ from: r.from, to: r.to,
              tip: (r.cls === 'disp' ? '有效显示 ' : '共同可见 ') + `T+${hms(r.from)} → T+${hms(r.to)}（${Math.round(r.to - r.from)} s）` })),
             ...eventMarks()];
    const ev = $('tlEvents');
    if (ev) ev.innerHTML = eventMarks().map(m =>
        `<div class="ev ${m.cls}" style="left:${m.from / spanSec * 100}%" title="${m.tip}"></div>`).join('');
    const legend = $('bandLegend');
    if (legend) {
        const kinds = [...new Set(runs.map(r => r.cls))];
        const evKinds = [...new Set(eventMarks().map(m => m.cls))];
        const EVNAME = { strobe: '点亮/熄灭', window: '可见区间', maneuver: '转向/恢复/控制',
                         task: '显示任务', eclipse: '进出地影', other: '其他事件' };
        legend.innerHTML = kinds.map(c =>
            c === 'disp' ? '<span><i class="sw disp"></i>有效显示窗口</span>' : '<span><i class="sw"></i>共同可见窗口</span>').join('')
            + evKinds.map(c => {
                const shp = { strobe: 'shp', window: 'shp round', maneuver: 'shp tri',
                              task: 'shp dia', eclipse: 'shp ring', other: 'shp dia' }[c];
                const col = { strobe: 'var(--event)', window: 'var(--sel)', maneuver: 'var(--label)',
                              task: '#c78bd8', eclipse: 'var(--sat2)', other: 'var(--bad)' }[c];
                return `<span style="color:${col}"><i class="${shp}"></i>${EVNAME[c] || c}</span>`;
            }).join('');
    }
}

// 时间轴上某一刻的可解释标记（窗口或事件），供悬停提示使用
export function markAt(sec) {
    const tol = spanSec * 0.004;
    const hit = marks.find(m => sec >= m.from - tol && sec <= Math.max(m.to, m.from) + tol);
    return hit ? hit.tip : '';
}

function paintTicks() {
    const host = $('tlTicks');
    if (!host || !spanSec) return;
    const step = Math.max(60, Math.round(spanSec / 8 / 60) * 60);
    let html = '';
    for (let s = step; s < spanSec; s += step) {
        const pos = s / spanSec * 100;
        html += `<div class="tick" style="left:${pos}%"></div>` +
                `<div class="ticklab" style="left:${pos}%">${hms(s).slice(0, 5)}</div>`;
    }
    host.innerHTML = html;
}

// ── 保存与导出用的数据快照（只含真实存在的列） ─────
export function scenarioSnapshot() {
    return {
        场景: '三星编队示例', 数据版本: cfg.display.paramVerHint || 'synth',
        起算时刻: t0ms ? new Date(t0ms).toISOString() : null,
        总时长_s: spanSec, 采样间隔_s: getStepSec(),
        观察点: cfg.station || null, 选中目标: 'TM0S' + selectedSat,
        视图: activeView, 标签: activeTab,
    };
}
export function exportRows(sat) {
    // 只导当前数据里真有值的列；空值保持空，不写 0
    const stepSec = getStepSec();
    const cols = [];
    for (const [file, fields] of Object.entries({
        ground_obs: ['az', 'el', 'range', 'visible', 'common_vis', 'off_axis', 'incone', 'sun_alt'],
        sun_eclipse: ['incidence_deg', 'array_incidence_deg', 'array_proj_factor', 'shadow_state', 'sun_ratio', 'umbra_margin_km'],
        attitude: ['q_j2b_x', 'q_j2b_y', 'q_j2b_z', 'q_j2b_w', 'att_mode', 'stable'],
        display: ['mission_active', 'plan_strobe', 'actual_strobe', 'effective', 'freq_hz', 'duty', 'brightness'],
        power: ['gen_power', 'platform_power', 'payload_power', 'accum_energy', 'battery_margin'],
        thermal: ['ext_heatflux', 'equip_power', 'temp_main', 'over_limit_count'],
    })) {
        const e = entries[file];
        if (!e || missing.has(file)) continue;
        for (const f of fields) {
            const probe = [0, Math.floor(e.nEpoch / 2)].some(ep => {
                const v = getValue(e, ep, sat, f);
                return v !== null && v !== undefined && v !== '';
            });
            if (probe) cols.push({ file, f });
        }
    }
    const head = ['rel_s', 'utcg', ...cols.map(c => `${c.file}.${c.f}`)];
    const lines = [head.join(',')];
    for (let ep = 0; ep < entries.ground_obs.nEpoch; ep++) {
        const row = [ep * stepSec, getValue(entries.ground_obs, ep, sat, 'utcg') ?? ''];
        for (const c of cols) { const v = getValue(entries[c.file], ep, sat, c.f); row.push(v === null || v === undefined ? '' : v); }
        lines.push(row.join(','));
    }
    return { text: lines.join('\n'), cols: cols.length };
}

// ── 对外接口 ────────────────────────────────────────
export function render(simSeconds) {
    if (!cfg) return;
    const stepSec = getStepSec() || 1;
    const epoch = Math.max(0, Math.min(Math.floor(simSeconds / stepSec), (entries.ground_obs?.nEpoch || 1) - 1));
    if (activeView === 'formation') renderFormation(epoch, simSeconds);
    if (activeTab === 'ground' || activeView === 'ground') renderGround(epoch);
    if (['orbit', 'attitude', 'power', 'thermal'].includes(activeTab)) {
        renderHero(epoch); renderBadges(epoch); renderTable(epoch);
    }
    renderMission(epoch, simSeconds);
    renderCharts(simSeconds);
    [...$('tgtList').children].forEach(card => {
        const sat = Number(card.dataset.sat);
        const put = (name, text, cls) => {
            const el = card.querySelector(`[data-r="${name}"]`);
            el.textContent = text;
            el.className = cls || '';
        };
        const vis = read('ground_obs', 'visible', sat, epoch, 1);
        put('st', vis.kind === 'num' ? (vis.raw === 1 ? '可见' : '不可见') : vis.text,
            vis.kind === 'num' ? (vis.raw === 1 ? 'st' : 'st na') : 'st na');
        put('light', lightWord(read('sun_eclipse', 'shadow_state', sat, epoch, 1)));
        const soc = read('power', 'battery_soc_pct', sat, epoch, 1);
        put('soc', soc.kind === 'num' ? soc.n.toFixed(0) + '%' : '未计算');
        const tp = read('thermal', 'temp_main', sat, epoch, 1);
        put('temp', tp.kind === 'num' ? tp.n.toFixed(1) + '℃' : '未计算');
        const el = read('ground_obs', 'el', sat, epoch, 1);
        const rg = read('ground_obs', 'range', sat, epoch, 1);
        put('el', el.kind === 'num' ? el.n.toFixed(1) : '—');
        put('rg', rg.kind === 'num' ? rg.n.toFixed(0) : '—');
        card.querySelector('.dot').style.background = colorOf(sat);
    });
}

export function setSpan(sec) { spanSec = sec; paintTicks(); paintWindows(); }

export async function initPanels(displayJson, h) {
    hooks = h;
    cfg = { groups: (await (await fetch('/sim/config/panels.json')).json()).groups,
            charts: displayJson.charts, display: displayJson };
    const files = new Set();
    cfg.groups.forEach(g => g.rows.forEach(r => files.add(r.file)));
    (displayJson.charts || []).forEach(c => files.add(c.file));
    ['ground_obs', 'display', 'events', 'time_ident', 'sun_eclipse', 'formation_geom', 'power', 'thermal']
        .forEach(f => files.add(f));
    for (const f of files) {
        try { entries[f] = await loadCategory(f); } catch (e) { missing.add(f); }
    }
    if (entries.ground_obs?.satIds?.length) sats = entries.ground_obs.satIds;
    if (!sats.includes(selectedSat)) selectedSat = sats[0];
    for (const spec of (displayJson.charts || [])) {
        for (const s of spec.series) {
            const v = Number(getValue(entries[spec.file], 0, sats[0], s.field));
            if (Number.isFinite(v)) nominal[`${spec.file}.${s.field}`] = v * (spec.scale || 1);
        }
    }
    t0ms = hooks.t0ms ? hooks.t0ms() : 0;
    $('detailTabs').addEventListener('click', (e) => {
        const b = e.target.closest('button[data-tab]');
        if (b) setTab(b.dataset.tab);
    });
    cfg.station = hooks.station ? hooks.station() : null;
    buildTargets();
    buildCharts();
    if (missing.size) hooks.onMissing([...missing]);
}


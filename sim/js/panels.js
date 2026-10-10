import { loadCategory, getValue, getStepSec, lastSecond } from './loader.js?v=28';
import { createChart } from './chart.js?v=28';

const $ = (id) => document.getElementById(id);
const SERIES_COLORS = ['#7fe3d6', '#6fa8dc', '#9db2c6'];
const HERO = [
    { field: 'el', file: 'ground_obs', name: '仰角', unit: '°' },
    { field: 'range', file: 'ground_obs', name: '斜距', unit: 'km' },
    { field: 'off_axis', file: 'ground_obs', name: '目标离轴角', unit: '°' },
    { field: 'effective', file: 'display', name: '有效显示', unit: '' },
];
const BADGES = [
    { field: 'att_mode', file: 'attitude', name: '姿态' },
    { field: 'stable', file: 'attitude', name: '稳定', bool: true },
    { field: 'visible', file: 'ground_obs', name: '单星可见', bool: true },
    { field: 'common_vis', file: 'ground_obs', name: '共同可见', bool: true },
    { field: 'plan_strobe', file: 'display', name: '计划点亮', bool: true },
    { field: 'actual_strobe', file: 'display', name: '实际点亮', bool: true },
];

let cfg = null;              // { groups, charts, display }
let entries = {};            // 文件名 → loader entry
let missing = new Set();
let nominal = {};            // 'file.field' → 首历元值，作为构型保持的标称
let sats = [1, 2, 3];
let selectedSat = 1;
let charts = {};
let spanSec = 0;
let marks = [];            // 时间标尺上的可解释标记：{from,to,tip}
let t0ms = 0;              // 数据起点（UTC 毫秒），事件表只有绝对时刻，由桥的首帧时间戳给出
let hooks = {};

const key = (file, field) => `${file}.${field}`;
const isNotComputed = (file, field) => (cfg.display.notComputed || []).includes(key(file, field));

// ── 取值与四态：未接入 / 尚未计算 / 数据异常 / 正常 ──
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

// 数据滞后：仿真时刻超出该文件覆盖范围的部分（离线文件内部不存在滞后）
function lagOf(file, simSeconds) {
    const e = entries[file];
    if (!e || missing.has(file)) return 0;
    return Math.max(0, simSeconds - lastSecond(e));
}

// ── 左栏：目标列表与任务状态 ────────────────────────
function buildTargets() {
    const host = $('tgtList');
    host.innerHTML = '';
    sats.forEach(id => {
        const b = document.createElement('button');
        b.className = 'tgt';
        b.type = 'button';
        b.dataset.sat = id;
        b.setAttribute('aria-current', String(id === selectedSat));
        b.innerHTML = `<span class="n"><i class="dot"></i>TM0S${id}</span>` +
                      `<span class="g"><span><em>仰角</em> <b class="el">--</b>°</span>` +
                      `<span><em>斜距</em> <b class="rg">--</b>km</span></span>`;
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

// ── 右栏：选中目标详情 ──────────────────────────────
function renderHero(epoch) {
    $('hero').innerHTML = HERO.map(h => {
        const v = read(h.file, h.field, selectedSat, epoch, 1);
        const c = cell(v);
        const bad = v.kind === 'num' && h.field === 'el' && v.n < cfg.display.minElevationDeg;
        return `<div class="cell"><div class="k">${h.name}</div>` +
               `<div class="v ${bad ? 'bad' : c.cls}">${c.text}${h.unit && !c.cls ? `<u>${h.unit}</u>` : ''}</div></div>`;
    }).join('');
}

const SHADOW_STATE = ['日照', '半影', '本影'];

// 光照状态取自星历算出的日/地圆盘遮挡判定，不靠画面黑不黑来猜
function shadowBadge(epoch) {
    const st = read('sun_eclipse', 'shadow_state', selectedSat, epoch, 1);
    if (st.kind !== 'num') return `<span class="tag na"><i></i>光照 ${st.text}</span>`;
    const ratio = read('sun_eclipse', 'sun_ratio', selectedSat, epoch, 1);
    const sep = read('sun_eclipse', 'sun_sep_deg', selectedSat, epoch, 1);
    const i = Math.round(st.raw);
    const cls = i === 0 ? 'ok' : i === 1 ? 'warn' : 'bad';
    const pct = ratio.kind === 'num' ? Math.round(ratio.n * 100) + '%' : '—';
    const tip = `日面可见比例 ${pct}，日下点角距 ${sep.kind === 'num' ? sep.n.toFixed(2) + '°' : '—'}`
        + '（按卫星看日面与地面的圆盘遮挡判定）';
    return `<span class="tag ${cls}" title="${tip}"><i></i>光照 ${SHADOW_STATE[i] || st.text} · 日面 ${pct}</span>`;
}

function renderBadges(epoch) {
    $('badges').innerHTML = shadowBadge(epoch) + BADGES.map(b => {
        const v = read(b.file, b.field, selectedSat, epoch, 1);
        if (b.bool && v.kind === 'num') {
            return `<span class="tag ${v.raw === 1 ? 'ok' : 'na'}"><i></i>${b.name} ${v.raw === 1 ? '是' : '否'}</span>`;
        }
        const c = cell(v);
        return `<span class="tag ${c.cls === 'na' ? 'na' : ''}"><i></i>${b.name} ${c.text}</span>`;
    }).join('');
}

function hms(sec) {
    const p = n => String(n).padStart(2, '0');
    const s = Math.max(0, Math.floor(sec));
    return `${p(Math.floor(s / 3600))}:${p(Math.floor(s % 3600 / 60))}:${p(s % 60)}`;
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

function renderMission(epoch, simSeconds) {
    const d = cfg.display;
    const edges = ['edge_12', 'edge_23', 'edge_31'].map(f => read('formation_geom', f, 1, epoch, 1000));
    const devs = edges.filter(e => e.kind === 'num')
        .map((e, i) => Math.abs(e.n - (nominal['formation_geom.' + ['edge_12', 'edge_23', 'edge_31'][i]] || 1000)));
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

// ── 参数表（表2-1 全参数 / 系统遥测分栏） ───────────
function renderTable(epoch) {
    const main = $('panelBody'), tele = $('telemetryBody');
    main.innerHTML = ''; tele.innerHTML = '';
    for (const g of cfg.groups) {
        const out = g.panel === 'telemetry' ? tele : main;
        const h = document.createElement('tr');
        h.className = 'group';
        h.innerHTML = `<td colspan="3">${g.name}</td>`;
        out.appendChild(h);
        for (const row of g.rows) {
            const v = read(row.file, row.field, selectedSat, epoch, row.scale);
            const c = cell(v);
            const tr = document.createElement('tr');
            tr.innerHTML = `<td class="name" title="${row.ref || ''}">${row.name}</td>` +
                `<td class="val ${c.cls}">${c.text}</td><td class="unit">${row.unit || ''}</td>`;
            out.appendChild(tr);
        }
    }
}

// ── 趋势图 ──────────────────────────────────────────
function buildCharts() {
    for (const spec of cfg.charts) {
        const host = $(spec.id);
        if (!host) continue;
        if ((cfg.display.notComputed || []).some(k => k.startsWith(spec.file + '.') &&
            spec.series.some(s => k === `${spec.file}.${s.field}`))) {
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
    return spec.series.map((s, i) => {
        const data = [];
        for (let ep = epLo; ep <= epHi; ep += stride) {
            const v = read(spec.file, s.field, selectedSat, ep, spec.scale);
            if (v.kind === 'num') data.push({ x: ep * stepSec, y: v.n });
        }
        return { name: s.name, color: SERIES_COLORS[i % SERIES_COLORS.length], data };
    });
}

function renderCharts(simSeconds) {
    const stepSec = getStepSec();
    const nEpoch = Math.max(...Object.values(entries).map(e => e.nEpoch || 1));
    const epHi = Math.min(nEpoch - 1, Math.floor((simSeconds + 600) / stepSec));
    const epLo = Math.max(0, Math.floor((simSeconds - 3600) / stepSec));
    for (const { spec, chart, host } of Object.values(charts)) {
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
            const v = read(spec.file, s.field, selectedSat, Math.floor(simSeconds / stepSec), spec.scale);
            return `<span style="color:${SERIES_COLORS[i % SERIES_COLORS.length]}"><i></i>${s.name} <b>${v.kind === 'num' ? fmt(v.n) : '—'}</b></span>`;
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
    tip.style.left = Math.min(detail.clientX + 12, innerWidth - 240) + 'px';
    tip.style.top = (detail.clientY - 34) + 'px';
    tip.textContent = `T+${hms(detail.x)}  ${detail.name} ${fmt(detail.y)} ${spec.unit}`;
}
function hideTip() { const t = $('tip'); if (t) t.style.display = 'none'; }

// ── 时间标尺窗口带 ─────────────────────────────────
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
    // 频闪的点亮/熄灭是逐次边沿（1 Hz 下上千条），只进事件表不上时间轴；
    // 可见区间按当前星过滤，避免同一时刻叠三个标记
    const skip = cfg.display.timelineEventSkip || [];
    return e.rows.filter(r => !skip.includes(r.category))
        .filter(r => r.category !== '可见区间' || r.sat_id === 'TM0S' + selectedSat)
        .map(r => {
            const sec = (Date.parse((r.t_actual || '').replace(' ', 'T') + 'Z') - t0ms) / 1000;
            if (!Number.isFinite(sec) || sec < 0 || sec > spanSec) return null;
            const w = Math.max((Number(r.duration_s) || 0) / spanSec * 100, .35);
            return { from: sec, to: sec + (Number(r.duration_s) || 0),
                     tip: `事件「${r.category}」${r.sat_id} T+${hms(sec)}${r.reason ? '（' + r.reason + '）' : ''}` };
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
        `<div class="ev" style="left:${m.from / spanSec * 100}%" title="${m.tip}"></div>`).join('');
    const legend = $('bandLegend');
    if (legend) {
        const kinds = [...new Set(runs.map(r => r.cls))];
        legend.innerHTML = kinds.map(c =>
            c === 'disp' ? '<span><i class="sw disp"></i>有效显示窗口</span>' : '<span><i class="sw"></i>共同可见窗口</span>').join('')
            + (eventMarks().length ? '<span><i class="sw ev"></i>事件（点选定位）</span>' : '');
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
                `<div class="ticklab" style="left:${pos}%">+${Math.floor(s / 3600)}h${String(Math.floor(s % 3600 / 60)).padStart(2, '0')}</div>`;
    }
    host.innerHTML = html;
}

// ── 对外接口 ────────────────────────────────────────
export function render(simSeconds) {
    if (!cfg) return;
    const stepSec = getStepSec();
    const epoch = Math.max(0, Math.min(Math.floor(simSeconds / stepSec), (entries.ground_obs?.nEpoch || 1) - 1));
    renderHero(epoch);
    renderBadges(epoch);
    renderMission(epoch, simSeconds);
    renderTable(epoch);
    renderCharts(simSeconds);
    [...$('tgtList').children].forEach(card => {
        const sat = Number(card.dataset.sat);
        const el = read('ground_obs', 'el', sat, epoch, 1);
        const rg = read('ground_obs', 'range', sat, epoch, 1);
        card.querySelector('.el').textContent = el.kind === 'num' ? el.n.toFixed(1) : '—';
        card.querySelector('.rg').textContent = rg.kind === 'num' ? rg.n.toFixed(0) : '—';
        const vis = read('ground_obs', 'visible', sat, epoch, 1);
        card.querySelector('.dot').style.background =
            vis.kind === 'num' && vis.raw === 1 ? 'var(--sel)' : 'var(--na)';
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
    ['ground_obs', 'display', 'events', 'time_ident', 'sun_eclipse'].forEach(f => files.add(f));
    for (const f of files) {
        try { entries[f] = await loadCategory(f); } catch (e) { missing.add(f); }
    }
    // 星数与标称构型都从数据取，不写死
    if (entries.ground_obs?.satIds?.length) sats = entries.ground_obs.satIds;
    if (!sats.includes(selectedSat)) selectedSat = sats[0];
    for (const spec of (displayJson.charts || [])) {
        for (const s of spec.series) {
            const v = Number(getValue(entries[spec.file], 0, sats[0], s.field));
            if (Number.isFinite(v)) nominal[`${spec.file}.${s.field}`] = v * (spec.scale || 1);
        }
    }
    t0ms = hooks.t0ms ? hooks.t0ms() : 0;
    buildTargets();
    buildCharts();
    if (missing.size) hooks.onMissing([...missing]);
}

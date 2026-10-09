import { loadCategory, getNearest, getValue, getStepSec } from './loader.js';
import { createChart } from './chart.js';

const $ = (id) => document.getElementById(id);
const COLORS = ['#7fe3d6', '#7ba6e8', '#e8a33d', '#c58fd6'];
let cfg = null;          // { groups, display }
let entries = {};        // 文件名 → loader entry
let selectedSat = 1;
let tiles = {};          // metric key → {spec, chart, vals}

const METRICS = [
    { key: 'edge', name: '编队边长', file: 'formation_geom', fields: ['edge_12', 'edge_23', 'edge_31'], unit: 'm', scale: 1000 },
    { key: 'cd', name: '至参考中心', file: 'formation_geom', fields: ['cd_1', 'cd_2', 'cd_3'], unit: 'm', scale: 1000 },
    { key: 'drift', name: '参考中心漂移 RTN', file: 'formation_geom', fields: ['drift_R', 'drift_T', 'drift_N'], unit: 'm', scale: 1000 },
    { key: 'sun', name: '目标区太阳高度', file: 'ground_obs', fields: ['sun_alt'], unit: '°', scale: 1 },
];

function fmtVal(v, row) {
    if (v === null || v === undefined || v === '') return { text: '空值', cls: 'st-empty' };
    const f = Number(v);
    if (!isNaN(f) && /^-?\d+(\.\d+)?$/.test(String(v))) {
        const s = row.scale ? f * row.scale : f;
        const dp = Math.abs(s) >= 10000 ? 0 : Math.abs(s) >= 1000 ? 1 : 2;
        return { text: s.toFixed(dp), cls: '' };
    }
    return { text: String(v), cls: '' };
}

function renderRow(row, simSeconds, out) {
    const entry = entries[row.file];
    const r = getNearest(entry, simSeconds, selectedSat, row.field, cfg.display.lagThresholdSec);
    const tr = document.createElement('tr');
    let valueHtml = '<td class="val st-empty">无数据</td>';
    if (r) {
        const v = fmtVal(r.value, row);
        if (v.cls) {
            valueHtml = `<td class="val ${v.cls}">${v.text}</td>`;
        } else if (r.stale) {
            valueHtml = `<td class="val">${v.text} <span class="st-lag">+${Math.round(r.lagSec)}s</span></td>`;
        } else {
            valueHtml = `<td class="val">${v.text}</td>`;
        }
    }
    tr.innerHTML = `<td class="name">${row.name}</td>${valueHtml}<td class="unit">${row.unit || ''}</td>`;
    out.appendChild(tr);
}

function buildTiles() {
    const host = $('metrics');
    host.innerHTML = '';
    for (const spec of METRICS) {
        const box = document.createElement('div');
        box.className = 'metric';
        box.innerHTML = `<div class="m-head"><span class="m-name">${spec.name}</span>` +
            `<span class="m-vals"></span><span class="m-unit">${spec.unit}</span></div>` +
            `<canvas></canvas>`;
        host.appendChild(box);
        const chart = createChart(box.querySelector('canvas'), {});
        tiles[spec.key] = { spec, chart, vals: box.querySelector('.m-vals') };
    }
}

function thresholdsFor(spec) {
    const d = cfg.display;
    if (spec.key === 'edge') {
        return [{ y: 1000 + d.edgeToleranceM, color: '#d8604b' }, { y: 1000 - d.edgeToleranceM, color: '#d8604b' }];
    }
    if (spec.key === 'drift') {
        return [{ y: d.driftToleranceM, color: '#d8604b' }, { y: -d.driftToleranceM, color: '#d8604b' }];
    }
    if (spec.key === 'sun' && d.sunAltGate.enabled) {
        return [{ y: d.sunAltGate.thresholdDeg, color: '#e8a33d' }];
    }
    return [];
}

function updateTiles(simSeconds) {
    const stepSec = getStepSec();
    for (const { spec, chart, vals } of Object.values(tiles)) {
        const entry = entries[spec.file];
        if (!entry) continue;
        const epoch = Math.max(0, Math.min(Math.floor(simSeconds / stepSec), entry.nEpoch - 1));

        vals.innerHTML = spec.fields.map((f, i) => {
            const raw = Number(getValue(entry, epoch, selectedSat, f));
            const v = isFinite(raw) ? raw * (spec.scale || 1) : NaN;
            const dp = Math.abs(v) >= 1000 ? 1 : 2;
            const txt = isFinite(v) ? v.toFixed(dp) : '空值';
            return `<b class="m-v"><i style="background:${COLORS[i % COLORS.length]}"></i>${txt}</b>`;
        }).join('');

        const lo = simSeconds - 3600, hi = simSeconds + 60;
        const thr = thresholdsFor(spec);
        chart.setData(spec.fields.map((f, i) => {
            const data = [];
            for (let ep = 0; ep < entry.nEpoch; ep++) {
                const t = ep * stepSec;
                if (t < lo || t > hi) continue;
                const v = Number(getValue(entry, ep, selectedSat, f));
                if (isFinite(v)) data.push({ x: t, y: v * (spec.scale || 1) });
            }
            return { color: COLORS[i % COLORS.length], data };
        }), thr);
    }
}

// 时间标尺背后的可见/显示窗口带：把连续区间合并成段，按选星呈现
export function paintWindows(spanSec) {
    const host = $('tlBands');
    if (!host || !entries.ground_obs || !spanSec) return;
    const e = entries.ground_obs;
    const stepSec = getStepSec();
    const runs = [];
    for (const [field, cls] of [['common_vis', ''], ['incone', 'disp']]) {
        let start = null;
        for (let ep = 0; ep <= e.nEpoch; ep++) {
            const on = ep < e.nEpoch && Number(getValue(e, ep, selectedSat, field)) === 1;
            if (on && start === null) start = ep;
            if (!on && start !== null) {
                runs.push({ cls, left: start * stepSec / spanSec * 100, width: (ep - start) * stepSec / spanSec * 100 });
                start = null;
            }
        }
    }
    host.innerHTML = runs.map(r =>
        `<div class="band${r.cls}" style="left:${r.left}%;width:${Math.max(r.width, .25)}%"></div>`).join('');
}

export function paintTicks(spanSec) {
    const host = $('tlTicks');
    if (!host || !spanSec) return;
    const raw = spanSec / 8;
    const step = Math.max(60, Math.round(raw / 60) * 60);
    let html = '';
    for (let s = step; s < spanSec; s += step) {
        const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60);
        html += `<div class="tick" style="left:${s / spanSec * 100}%"></div>`;
        html += `<div class="ticklab" style="left:${s / spanSec * 100}%">+${h}h${String(m).padStart(2, '0')}</div>`;
    }
    html += `<div class="ticklab" style="left:0">T+</div>`;
    host.innerHTML = html;
}

export function render(simSeconds) {
    if (!cfg) return;
    const out = $('panelBody');
    out.innerHTML = '';
    for (const g of cfg.groups) {
        const h = document.createElement('tr');
        h.className = 'group';
        h.innerHTML = `<td colspan="3">${g.name}</td>`;
        out.appendChild(h);
        for (const row of g.rows) renderRow(row, simSeconds, out);
    }
    updateTiles(simSeconds);
}

export async function initPanels(displayJson) {
    cfg = { groups: (await (await fetch('/sim/config/panels.json')).json()).groups, display: displayJson };
    const files = new Set();
    cfg.groups.forEach(g => g.rows.forEach(r => files.add(r.file)));
    METRICS.forEach(m => files.add(m.file));
    files.add('ground_obs');
    for (const f of files) entries[f] = await loadCategory(f);

    buildTiles();

    const sel = $('satSel');
    sel.innerHTML = '';
    [1, 2, 3].forEach(id => {
        const b = document.createElement('button');
        b.textContent = 'TM0S' + id;
        b.setAttribute('aria-pressed', String(id === selectedSat));
        if (id === selectedSat) b.classList.add('on');
        b.onclick = () => {
            selectedSat = id;
            [...sel.children].forEach(x => { x.classList.remove('on'); x.setAttribute('aria-pressed', 'false'); });
            b.classList.add('on');
            b.setAttribute('aria-pressed', 'true');
            const s = $('kvSat');
            if (s) s.textContent = 'TM0S' + id;
            render(_simSeconds());
            paintWindows(_spanSec);
        };
        sel.appendChild(b);
    });
}

let _simSeconds = () => 0;
let _spanSec = 0;
export function setStateSource(fn) { _simSeconds = fn; }
export function setSpan(sec) { _spanSec = sec; paintTicks(sec); paintWindows(sec); }

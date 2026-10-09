import { loadCategory, getNearest } from './loader.js';
import { createChart } from './chart.js';

const $ = (id) => document.getElementById(id);
let cfg = null;          // { groups, display }
let entries = {};        // 文件名 → loader entry
let selectedSat = 1;
let charts = {};

export function getSelectedSat() { return selectedSat; }

function fmtVal(v, row) {
    if (v === null || v === undefined || v === '') return { text: '空值', cls: 'st-empty' };
    const f = Number(v);
    if (!isNaN(f) && /^-?\d+(\.\d+)?$/.test(String(v))) {
        const scaled = row.scale ? f * row.scale : f;
        return { text: String(Math.round(scaled * 1000) / 1000), cls: '' };
    }
    return { text: String(v), cls: '' };
}

function renderRow(row, simSeconds, out) {
    const entry = entries[row.file];
    const r = getNearest(entry, simSeconds, selectedSat, row.field, cfg.display.lagThresholdSec);
    const tr = document.createElement('tr');
    let valueHtml = '<td class="st-empty">无数据</td>';
    if (r) {
        const v = fmtVal(r.value, row);
        if (v.cls) {
            valueHtml = `<td class="${v.cls}">${v.text}</td>`;
        } else if (r.stale) {
            valueHtml = `<td>${v.text} <span class="st-lag">滞后 ${Math.round(r.lagSec)}s</span></td>`;
        } else {
            valueHtml = `<td>${v.text}</td>`;
        }
    }
    tr.innerHTML = `<td>${row.name}</td>${valueHtml}<td class="unit">${row.unit || ''}</td>`;
    out.appendChild(tr);
    return r ? Number(r.value) : NaN;
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
    drawCharts(simSeconds);
}

function seriesFrom(file, fields, scale, satId, epochCount) {
    const e = entries[file];
    if (!e) return [];
    return fields.map((f, i) => {
        const data = [];
        for (let ep = 0; ep < epochCount; ep++) {
            const r = getNearest(e, ep * 60, satId, f, 1e9);
            const v = Number(r ? r.value : NaN);
            if (isFinite(v)) data.push({ x: ep * 60, y: v * (scale || 1) });
        }
        return { name: f.replace(/_/g, ' '), color: ['#4fc3f7', '#aed581', '#ffb74d', '#ce93d8'][i % 4], data };
    });
}

function drawCharts(simSeconds) {
    const N = entries.formation_geom ? entries.formation_geom.nEpoch : 0;
    if (!N) return;
    const marker = { x: simSeconds };
    const mk = (id, series, thresholds, yLabel) => {
        if (!charts[id]) charts[id] = createChart($(id), { yLabel, thresholds });
        charts[id].setData(series.map(s => ({
            ...s,
            data: s.data.filter(p => p.x >= (marker.x - 3600) && p.x <= (marker.x + 60)),
        })));
        charts[id].draw();
    };
    const S = selectedSat;
    // 选取当前时刻附近 1 小时窗口
    mk('chartEdge',
       seriesFrom('formation_geom', ['edge_12', 'edge_23', 'edge_31'], 1000).map(s => s),
       [{ y: 1000 + cfg.display.edgeToleranceM, color: '#c0392b', label: '+10m' },
        { y: 1000 - cfg.display.edgeToleranceM, color: '#c0392b', label: '-10m' }], '边长 m');
    mk('chartCd',
       seriesFrom('formation_geom', ['cd_1', 'cd_2', 'cd_3'], 1000), [], '中心距 m');
    mk('chartDrift',
       seriesFrom('formation_geom', ['drift_R', 'drift_T', 'drift_N'], 1000),
       [{ y: cfg.display.driftToleranceM, color: '#c0392b', label: '+50m' },
        { y: -cfg.display.driftToleranceM, color: '#c0392b', label: '-50m' }], '中心漂移 m');
    const sun = seriesFrom('ground_obs', ['sun_alt'], 1, S).map(s => s)[0];
    const gate = cfg.display.sunAltGate;
    mk('chartSun', sun ? [sun] : [],
       gate.enabled ? [{ y: gate.thresholdDeg, color: '#e67e22', label: '判定门限' }] : [],
       '太阳高度 deg');
}

export async function initPanels(displayJson) {
    cfg = { groups: (await (await fetch('/sim/config/panels.json')).json()).groups, display: displayJson };
    const files = new Set();
    cfg.groups.forEach(g => g.rows.forEach(r => files.add(r.file)));
    for (const f of files) entries[f] = await loadCategory(f);
    // 星选择按钮
    const sel = $('satSel');
    [1, 2, 3].forEach(id => {
        const b = document.createElement('button');
        b.textContent = 'TM0S' + id;
        if (id === selectedSat) b.classList.add('on');
        b.onclick = () => {
            selectedSat = id;
            [...sel.children].forEach(x => x.classList.remove('on'));
            b.classList.add('on');
            render(getStateSimSeconds());
        };
        sel.appendChild(b);
    });
}

let _simSeconds = () => 0;
export function setStateSource(fn) { _simSeconds = fn; }
function getStateSimSeconds() { return _simSeconds(); }

import { getState, patch } from './store.js';
import { initPanels, render as renderPanels, setStateSource, setSpan } from './panels.js';
import { setStepSec, getStepSec, loadCategory, getValue } from './loader.js';

const displayCfg = await (await fetch('/sim/config/display.json')).json();

const $ = (id) => document.getElementById(id);
const frame = $('stage');
let sunEntry = null;
let dispEntry = null;

function fmtUtc(raw) {
    if (!raw || raw.length < 14) return 'UTC --';
    return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)} ` +
           `${raw.slice(8, 10)}:${raw.slice(10, 12)}:${raw.slice(12, 14)}`;
}

function fmtElapsed(s) {
    const t = Math.max(0, Math.floor(s));
    const p = (n) => String(n).padStart(2, '0');
    return `${p(Math.floor(t / 3600))}:${p(Math.floor(t % 3600 / 60))}:${p(t % 60)}`;
}

function setStatus(text, cls) {
    $('statusText').textContent = text;
    $('status').className = cls || '';
}

// 等待 iframe 里的 StarTM 初始化出 __simbridge
function waitBridge(tries = 0) {
    const w = frame.contentWindow;
    if (w && w.__simbridge && w.__simbridge.version) {
        setStatus('三维画面已就绪', 'live');
        return w.__simbridge;
    }
    if (tries > 300) { setStatus('桥接超时：三维画面未加载完成', 'err'); return null; }
    setTimeout(() => { bridge = waitBridge(tries + 1); }, 200);
    return null;
}

let bridge = null;

// 拉取姿态表：attitude.csv 的 q_j2b 列，table[epochIdx][satId] = [qx,qy,qz,qw]
async function loadAttitude() {
    const res = await fetch('/sim-data/preview/attitude.csv');
    const lines = (await res.text()).split(/\r?\n/).filter(l => l && !l.startsWith('#'));
    const table = [];
    let satId = null; let epoch = 0;
    for (const line of lines) {
        const v = line.split(',');
        if (v[0] !== satId) { satId = v[0]; epoch = 0; }
        const sat = Number(v[0]);
        table[epoch] = table[epoch] || {};
        table[epoch][sat] = [Number(v[3]), Number(v[4]), Number(v[5]), Number(v[6])];
        epoch += 1;
    }
    return table;
}

// 把当前时刻的太阳方向推给三维画面，使昼夜分界与数据一致
function pushSun(simSeconds) {
    if (!bridge || !bridge.setSunJ2000 || !sunEntry) return;
    const ep = Math.max(0, Math.min(Math.floor(simSeconds / getStepSec()), sunEntry.nEpoch - 1));
    const x = Number(getValue(sunEntry, ep, 1, 'sun_j2000_x'));
    const y = Number(getValue(sunEntry, ep, 1, 'sun_j2000_y'));
    const z = Number(getValue(sunEntry, ep, 1, 'sun_j2000_z'));
    if (isFinite(x) && isFinite(y) && isFinite(z)) bridge.setSunJ2000(x, y, z);
}

// 显示载荷执行状态驱动画面上的发光面（表2-1「实际点亮」）
function pushLights(simSeconds) {
    if (!bridge || !bridge.setLight || !dispEntry) return;
    const ep = Math.max(0, Math.min(Math.floor(simSeconds / getStepSec()), dispEntry.nEpoch - 1));
    for (let sat = 1; sat <= 3; sat++) {
        bridge.setLight(sat - 1, Number(getValue(dispEntry, ep, sat, 'actual_strobe')) === 1);
    }
}

function refreshMeta() {
    const st = getState();
    st.totalSteps = bridge.totalSteps();
    st.stepIntervalSec = bridge.getStepIntervalSec();
    $('stepSlider').max = Math.max(0, st.totalSteps - 1);
    $('kvInterval').textContent = `${st.stepIntervalSec} s`;
    $('kvStep').textContent = `${st.currentStep} / ${st.totalSteps}`;
}

function showStep(idx) {
    const st = getState();
    bridge.setStep(idx);
    $('tplus').innerHTML = `<span class="pre">T+</span>${fmtElapsed(st.simSeconds)}`;
    $('utcg').textContent = fmtUtc(bridge.getTimestamp(idx));
    $('stepSlider').value = idx;
    $('kvStep').textContent = `${idx} / ${st.totalSteps}`;
    pushSun(st.simSeconds);
    pushLights(st.simSeconds);
    renderPanels(st.simSeconds);
}

function tick() {
    const st = getState();
    if (!st.attached || !st.playing || !bridge) return;
    st.simSeconds += (st.rate * 100) / 1000;
    const idx = Math.min(Math.floor(st.simSeconds / st.stepIntervalSec), st.totalSteps - 1);
    if (idx !== st.currentStep) {
        st.currentStep = idx;
        showStep(idx);
    } else {
        $('tplus').innerHTML = `<span class="pre">T+</span>${fmtElapsed(st.simSeconds)}`;
    }
    if (idx >= st.totalSteps - 1) { patch({ playing: false }); $('btnPlay').classList.remove('on'); }
}

setInterval(tick, 100);

$('btnAttach').onclick = async () => {
    if (!bridge) return;
    setStatus('正在装载星历回放…');
    bridge.setExternalMode(true);   // 先声明外部驱动，WS 重连不再改写模式与网格
    if (bridge.mode() !== 'csv') bridge.toggleCsvMode();   // 已是 CSV 就别再翻回 WS
    // 等 StarTM 把 /api/csv-data 拉完、状态可用
    for (let i = 0; i < 60; i++) {
        await new Promise(r => setTimeout(r, 300));
        if (bridge.totalSteps() > 0 && bridge.getTimestamp(bridge.totalSteps() - 1)) break;
    }
    if (!bridge.totalSteps()) { setStatus('装载失败：数据为空', 'err'); return; }

    try {
        const st = (await (await fetch('/sim-data/meta.json')).json()).station;
        if (st && bridge.setStation) {
            bridge.setStation(st.lat_deg, st.lon_deg);
            $('kvStation').textContent = `${st.name} ${st.lat_deg.toFixed(3)}°N ${st.lon_deg.toFixed(3)}°E`;
        }
    } catch (e) {
        $('kvStation').textContent = '未提供';
    }
    try {
        bridge.setAttitudeTable(await loadAttitude());
        sunEntry = await loadCategory('sun_eclipse');
        dispEntry = await loadCategory('display');
    } catch (e) {
        setStatus(`姿态/太阳数据装载失败：${e.message}`, 'err');
        return;
    }
    setStepSec(bridge.getStepIntervalSec());
    pushSun(0);          // 视角重建前先给一次太阳方向
    bridge.rebuildView();
    refreshMeta();
    patch({ attached: true, simSeconds: 0, currentStep: 0, playing: false });
    try {
        await initPanels(displayCfg);
        setStateSource(() => getState().simSeconds);
        const ti = await loadCategory('time_ident');
        $('kvVer').textContent = ti.rows[0] ? ti.rows[0].param_ver : '--';
        setSpan(getState().totalSteps * getState().stepIntervalSec);
    } catch (e) {
        console.warn('参数台初始化失败（不阻塞时钟）:', e);
    }
    showStep(0);
    setStatus('外部驱动已接管：时钟归本页面', 'live');
    $('btnAttach').classList.add('on');
    $('btnAttach').textContent = '已接入，重新装载';
};

$('btnPlay').onclick = () => {
    if (!getState().attached) return;
    patch({ playing: true });
    $('btnPlay').classList.add('on');
};
$('btnPause').onclick = () => {
    patch({ playing: false });
    $('btnPlay').classList.remove('on');
};
$('rate').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-rate]');
    if (!b) return;
    [...$('rate').children].forEach(x => x.classList.remove('on'));
    b.classList.add('on');
    patch({ rate: Number(b.dataset.rate) });
    if (bridge) bridge.setRate(Number(b.dataset.rate));
});
$('viewSel').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-view]');
    if (!b || !bridge || !bridge.setView) return;
    [...$('viewSel').children].forEach(x => x.classList.remove('on'));
    b.classList.add('on');
    bridge.setView(b.dataset.view);
});
$('stepSlider').oninput = (e) => {
    const st = getState();
    if (!st.attached) return;
    const idx = Number(e.target.value);
    st.currentStep = idx;
    st.simSeconds = idx * st.stepIntervalSec;
    showStep(idx);
};

// 键盘：空格走带/暂停，左右方向键单步
document.addEventListener('keydown', (e) => {
    const st = getState();
    if (!st.attached) return;
    if (e.code === 'Space') { e.preventDefault(); (st.playing ? $('btnPause') : $('btnPlay')).click(); }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        const idx = Math.max(0, Math.min(st.currentStep + (e.key === 'ArrowRight' ? 1 : -1), st.totalSteps - 1));
        st.currentStep = idx;
        st.simSeconds = idx * st.stepIntervalSec;
        showStep(idx);
    }
});

frame.addEventListener('load', () => { bridge = waitBridge(); });
// iframe 可能先于本模块完成加载，load 事件已错过则直接开始等
if (frame.contentWindow && frame.contentWindow.document.readyState === 'complete') {
    bridge = waitBridge();
}

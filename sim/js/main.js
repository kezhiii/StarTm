import { getState, patch } from './store.js';
import { initPanels, render as renderPanels, setStateSource } from './panels.js';
import { setStepSec } from './loader.js';

const displayCfg = await (await fetch('/sim/config/display.json')).json();

const $ = (id) => document.getElementById(id);
const frame = $('stage');

function fmtTs(raw) {
    if (!raw || raw.length < 14) return '--';
    return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)} ` +
           `${raw.slice(8, 10)}:${raw.slice(10, 12)}:${raw.slice(12, 14)}`;
}

// 等待 iframe 里的 StarTM 初始化出 __simbridge
function waitBridge(tries = 0) {
    const w = frame.contentWindow;
    if (w && w.__simbridge && w.__simbridge.version) {
        $('status').textContent = '桥接已建立';
        return w.__simbridge;
    }
    if (tries > 300) { $('status').textContent = '桥接超时：StarTM 未加载出 __simbridge'; return null; }
    setTimeout(() => { bridge = waitBridge(tries + 1); }, 200);
    return null;
}

let bridge = null;

// 拉取姿态表：attitude.csv 的 q_j2b 列，table[epochIdx][satId] = [qx,qy,qz,qw]
async function loadAttitude() {
    const res = await fetch('/sim-data/preview/attitude.csv');
    const lines = (await res.text()).split('\n').filter(l => l && !l.startsWith('#'));
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

function refreshMeta() {
    const st = getState();
    st.totalSteps = bridge.totalSteps();
    st.stepIntervalSec = bridge.getStepIntervalSec();
    $('stepSlider').max = Math.max(0, st.totalSteps - 1);
    $('kvInterval').textContent = `步长 ${st.stepIntervalSec} s`;
    $('kvStep').textContent = `步 ${st.currentStep} / ${st.totalSteps}`;
}

function tick() {
    const st = getState();
    if (!st.attached || !st.playing || !bridge) return;
    const before = st.simSeconds;
    st.simSeconds += (st.rate * 100) / 1000;
    const idx = Math.min(Math.floor(st.simSeconds / st.stepIntervalSec), st.totalSteps - 1);
    if (idx !== st.currentStep) {
        st.currentStep = idx;
        bridge.setStep(idx);
        $('clock').textContent = fmtTs(bridge.getTimestamp(idx));
        $('stepSlider').value = idx;
        $('kvStep').textContent = `步 ${idx} / ${st.totalSteps}`;
        renderPanels(st.simSeconds);
    } else if (Math.floor(before * 10) !== Math.floor(st.simSeconds * 10)) {
        // 同一步内的插值显示暂不做（StarTM 侧 progress=0），只更新走带
    }
    if (idx >= st.totalSteps - 1) { patch({ playing: false }); $('btnPlay').classList.remove('on'); }
}

setInterval(tick, 100);

$('btnAttach').onclick = async () => {
    if (!bridge) return;
    $('status').textContent = '正在切换到 CSV 回放…';
    bridge.toggleCsvMode();
    // 轮询等 StarTM 把 /api/csv-data 拉完、状态可用
    for (let i = 0; i < 60; i++) {
        await new Promise(r => setTimeout(r, 300));
        if (bridge.totalSteps() > 0 && bridge.getTimestamp(bridge.totalSteps() - 1)) break;
    }
    if (!bridge.totalSteps()) { $('status').textContent = '切换失败：StarTM 数据为空'; return; }
    bridge.setExternalMode(true);
    try {
        const table = await loadAttitude();
        bridge.setAttitudeTable(table);
        $('status').textContent = '外部驱动已接管：时钟归本页面（含姿态）';
    } catch (e) {
        $('status').textContent = '外部驱动已接管（姿态表加载失败：' + e.message + '）';
        return;
    }
    bridge.rebuildView();
    refreshMeta();
    bridge.setStep(0);
    patch({ attached: true, simSeconds: 0, currentStep: 0, playing: false });
    setStepSec(bridge.getStepIntervalSec());
    try {
        await initPanels(displayCfg);
        setStateSource(() => getState().simSeconds);
        renderPanels(0);
    } catch (e) {
        console.warn('参数表初始化失败（不阻塞时钟）:', e);
    }
    $('status').textContent = '外部驱动已接管：时钟归本页面';
    $('btnAttach').classList.add('on');
    $('clock').textContent = fmtTs(bridge.getTimestamp(0));
};

$('btnPlay').onclick = () => {
    const st = getState();
    if (!st.attached) return;
    patch({ playing: true });
    $('btnPlay').classList.add('on');
};
$('btnPause').onclick = () => {
    patch({ playing: false });
    $('btnPlay').classList.remove('on');
};
$('rate').onchange = (e) => {
    const r = Number(e.target.value);
    patch({ rate: r });
    bridge.setRate(r);
};
$('stepSlider').oninput = (e) => {
    const st = getState();
    if (!st.attached) return;
    const idx = Number(e.target.value);
    st.currentStep = idx;
    st.simSeconds = idx * st.stepIntervalSec;
    bridge.setStep(idx);
    $('clock').textContent = fmtTs(bridge.getTimestamp(idx));
    $('kvStep').textContent = `步 ${idx} / ${st.totalSteps}`;
    renderPanels(st.simSeconds);
};

frame.addEventListener('load', () => { bridge = waitBridge(); });
// iframe 可能先于本模块完成加载，load 事件已错过则直接开始等
if (frame.contentWindow && frame.contentWindow.document.readyState === 'complete') {
    bridge = waitBridge();
}

import { getState, patch } from './store.js';
import { initPanels, render as renderPanels, selectSat, setSpan, getSelectedSat } from './panels.js';
import { setStepSec, getStepSec, loadCategory, getValue } from './loader.js';

const displayCfg = await (await fetch('/sim/config/display.json')).json();

const $ = (id) => document.getElementById(id);
const frame = $('stage');
let sunEntry = null;
let dispEntry = null;
let bridge = null;

function fmtUtc(raw) {
    if (!raw || raw.length < 14) return '--';
    return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)} ` +
           `${raw.slice(8, 10)}:${raw.slice(10, 12)}:${raw.slice(12, 14)}`;
}
function hms(sec) {
    const p = n => String(n).padStart(2, '0');
    const s = Math.max(0, Math.floor(sec));
    return `${p(Math.floor(s / 3600))}:${p(Math.floor(s % 3600 / 60))}:${p(s % 60)}`;
}
// 只改内层文字：整体覆写 innerHTML 会连 #runTagText/#dataTagText 一起销毁
function setTag(el, text, cls) {
    el.className = 'tag ' + (cls || 'na');
    const span = el.querySelector('span') || el.appendChild(document.createElement('span'));
    span.textContent = text;
}

// ── 顶栏状态 ────────────────────────────────────────
function setRun(text, cls) { setTag($('runTag'), text, cls); }
function setData(text, cls) { setTag($('dataTag'), text, cls); }

// 等待 iframe 里的 StarTM 初始化出 __simbridge
function waitBridge(tries = 0) {
    const w = frame.contentWindow;
    if (w && w.__simbridge && w.__simbridge.version) {
        bridge = w.__simbridge;
        bridge.onPick = (meshIdx) => selectSat(meshIdx + 1);   // 画面里点星 → 联动参数台
        setData('三维画面已就绪', 'ok');
        return bridge;
    }
    if (tries > 300) { setRun('三维画面未就绪', 'bad'); setData('桥接超时', 'bad'); return null; }
    setTimeout(() => waitBridge(tries + 1), 200);
    return null;
}

// 姿态表：table[epochIdx][satId] = [qx,qy,qz,qw]
async function loadAttitude() {
    const res = await fetch('/sim-data/preview/attitude.csv');
    const lines = (await res.text()).split(/\r?\n/).filter(l => l && !l.startsWith('#'));
    const table = [];
    let satId = null, epoch = 0;
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

// 太阳方向与点亮状态推给三维画面，使昼夜分界与发光面和数据一致
function pushSceneState(simSeconds) {
    if (!bridge) return;
    const e = Math.max(0, Math.min(Math.floor(simSeconds / getStepSec()), 1e9));
    if (sunEntry && bridge.setSunJ2000) {
        const ep = Math.min(e, sunEntry.nEpoch - 1);
        const x = Number(getValue(sunEntry, ep, 1, 'sun_j2000_x'));
        const y = Number(getValue(sunEntry, ep, 1, 'sun_j2000_y'));
        const z = Number(getValue(sunEntry, ep, 1, 'sun_j2000_z'));
        if ([x, y, z].every(Number.isFinite)) bridge.setSunJ2000(x, y, z);
    }
    if (dispEntry && bridge.setLight) {
        const ep = Math.min(e, dispEntry.nEpoch - 1);
        for (const sat of dispEntry.satIds) {
            bridge.setLight(sat - 1, Number(getValue(dispEntry, ep, sat, 'actual_strobe')) === 1);
        }
    }
}

function showStep(idx) {
    const st = getState();
    bridge.setStep(idx);
    $('tplus').innerHTML = `<span class="pre">T+</span>${hms(st.simSeconds)}`;
    $('utcg').textContent = fmtUtc(bridge.getTimestamp(idx));
    $('stepSlider').value = idx;
    $('kvStep').textContent = `${idx + 1} / ${st.totalSteps}`;
    pushSceneState(st.simSeconds);
    renderPanels(st.simSeconds);
}

// 供 panels.js 回调
function seekSeconds(sec) {
    const st = getState();
    if (!st.attached) return;
    const idx = Math.max(0, Math.min(Math.round(sec / st.stepIntervalSec), st.totalSteps - 1));
    st.currentStep = idx;
    st.simSeconds = idx * st.stepIntervalSec;
    showStep(idx);
}

// 视角模式：全局轨道（远观）· 目标跟随（吊在选中星上方）· 编队近景（km 尺度的主星视角）
function applyView(mode) {
    if (!bridge) return;
    const idx = getSelectedSat() - 1;
    if (mode === 'center') { bridge.setView('center'); bridge.follow && bridge.follow(null); return; }
    bridge.setView('third');
    bridge.selectSat && bridge.selectSat(idx);
    bridge.follow && bridge.follow(mode === 'follow' ? idx : null, 18);
}

let lastTick = performance.now();
function tick() {
    const st = getState();
    const now = performance.now();
    const dt = (now - lastTick) / 1000;
    lastTick = now;
    if (!st.attached || !st.playing || !bridge) return;
    st.simSeconds += st.rate * dt;
    const idx = Math.min(Math.floor(st.simSeconds / st.stepIntervalSec), st.totalSteps - 1);
    if (idx !== st.currentStep) { st.currentStep = idx; showStep(idx); }
    else $('tplus').innerHTML = `<span class="pre">T+</span>${hms(st.simSeconds)}`;
    if (idx >= st.totalSteps - 1) { pause(); setRun('已到数据末尾', 'warn'); }
}

function play() {
    patch({ playing: true });
    lastTick = performance.now();
    $('btnPlay').classList.add('on');
    if (bridge) bridge.resume();
    setRun(`回放中 ${getState().rate}×`, 'ok');
}
function pause() {
    patch({ playing: false });
    $('btnPlay').classList.remove('on');
    if (bridge) bridge.pause();
    if (getState().attached) setRun('已暂停', 'warn');
}

setInterval(tick, 100);

$('btnAttach').onclick = async () => {
    if (!bridge) { setRun('三维画面未就绪', 'bad'); return; }
    const t0 = performance.now();
    setRun('正在装载星历回放…', 'warn');
    const timer = setInterval(() => setRun(`正在装载星历回放 ${(performance.now() - t0) / 1000 | 0}s`, 'warn'), 500);
    bridge.setExternalMode(true);
    if (bridge.mode() !== 'csv') bridge.toggleCsvMode();   // 已是 CSV 就别再翻回 WS
    let ready = false;
    for (let i = 0; i < 60; i++) {
        await new Promise(r => setTimeout(r, 300));
        if (bridge.totalSteps() > 0 && bridge.getTimestamp(bridge.totalSteps() - 1)) { ready = true; break; }
    }
    clearInterval(timer);
    if (!ready) { setRun('装载失败：数据为空', 'bad'); setData('未连接', 'bad'); return; }

    try {
        const st = (await (await fetch('/sim-data/meta.json')).json()).station;
        if (st && bridge.setStation) bridge.setStation(st.lat_deg, st.lon_deg);
    } catch (e) { /* 站址缺失只影响画面标记，不阻塞回放 */ }
    try {
        bridge.setAttitudeTable(await loadAttitude());
        sunEntry = await loadCategory('sun_eclipse');
        dispEntry = await loadCategory('display');
    } catch (e) {
        setRun('装载失败：' + e.message, 'bad');
        return;
    }
    pushSceneState(0);
    bridge.rebuildView();

    const s = getState();
    s.totalSteps = bridge.totalSteps();
    s.stepIntervalSec = bridge.getStepIntervalSec();
    $('stepSlider').max = Math.max(0, s.totalSteps - 1);
    $('kvStepSec').textContent = `${s.stepIntervalSec} s`;
    patch({ attached: true, simSeconds: 0, currentStep: 0, playing: false });
    setStepSec(s.stepIntervalSec);
    try {
        await initPanels(displayCfg, {
            simSeconds: () => getState().simSeconds,
            onSelect: sat => {
                bridge && bridge.selectSat && bridge.selectSat(sat - 1);
                const mode = $('viewSel').querySelector('.on').dataset.view;
                if (mode === 'follow' && bridge) bridge.follow(sat - 1, 18);
                renderPanels(getState().simSeconds);
            },
            onSeek: seekSeconds,
            onAlarms: n => {
                $('alarmCount').textContent = n;
                $('alarmTag').className = 'tag ' + (n ? 'bad' : 'ok');
            },
            onMissing: files => setData(`数据缺 ${files.join('、')}`, 'warn'),
        });
        setSpan(s.totalSteps * s.stepIntervalSec);
    } catch (e) {
        setRun('参数台初始化失败：' + e.message, 'bad');
    }
    showStep(0);
    $('btnAttach').textContent = '重新装载';
    setRun('已接入，待播放', 'ok');
    setData(`星历回放 ${s.totalSteps} 步 · ${s.stepIntervalSec} s`, 'ok');
};

$('btnPlay').onclick = play;
$('btnPause').onclick = pause;
$('rate').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-rate]');
    if (!b) return;
    [...$('rate').children].forEach(x => x.classList.remove('on'));
    b.classList.add('on');
    patch({ rate: Number(b.dataset.rate) });
    if (bridge) bridge.setRate(Number(b.dataset.rate));
    if (getState().playing) setRun(`回放中 ${b.dataset.rate}×`, 'ok');
});
$('viewSel').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-view]');
    if (!b) return;
    [...$('viewSel').children].forEach(x => x.classList.remove('on'));
    b.classList.add('on');
    applyView(b.dataset.view);
});
$('stepSlider').oninput = (e) => {
    const st = getState();
    if (!st.attached) return;
    const idx = Number(e.target.value);
    st.currentStep = idx;
    st.simSeconds = idx * st.stepIntervalSec;
    showStep(idx);
};

// 时间标尺悬停：把光标位置换成仿真时刻，并说明落在哪个窗口里
$('stepSlider').addEventListener('mousemove', (e) => {
    const st = getState();
    if (!st.attached) return;
    const r = e.target.getBoundingClientRect();
    const sec = (e.clientX - r.left) / r.width * st.totalSteps * st.stepIntervalSec;
    const band = [...document.querySelectorAll('#tlBands .band')]
        .find(el => sec >= Number(el.dataset.from) && sec < Number(el.dataset.to));
    const tip = $('tip');
    tip.style.display = 'block';
    tip.style.left = Math.min(e.clientX + 12, innerWidth - 260) + 'px';
    tip.style.top = (e.clientY - 40) + 'px';
    tip.textContent = `T+${hms(sec)} · ${fmtUtc(bridge.getTimestamp(Math.round(sec / st.stepIntervalSec)))}` +
                      (band ? ` · ${band.dataset.tip}` : '');
});
$('stepSlider').addEventListener('mouseleave', () => { $('tip').style.display = 'none'; });

$('btnTogglePanels').onclick = () => {
    const tight = document.body.classList.toggle('tight');
    $('btnTogglePanels').textContent = tight ? '展开面板' : '收起面板';
    $('btnTogglePanels').setAttribute('aria-expanded', String(!tight));
};

// 键盘：空格走带/暂停，左右单步，H 收起面板
document.addEventListener('keydown', (e) => {
    const st = getState();
    if (e.repeat) return;
    if (e.target.closest('button, input, select, a, [contenteditable]')) return;
    if (e.key.toLowerCase() === 'h' && !e.ctrlKey && !e.metaKey) { $('btnTogglePanels').click(); return; }
    if (!st.attached) return;
    if (e.code === 'Space') { e.preventDefault(); st.playing ? pause() : play(); }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        const idx = Math.max(0, Math.min(st.currentStep + (e.key === 'ArrowRight' ? 1 : -1), st.totalSteps - 1));
        st.currentStep = idx;
        st.simSeconds = idx * st.stepIntervalSec;
        showStep(idx);
    }
});

frame.addEventListener('load', () => {
    // 画面重新加载后桥是新的：外部驱动、姿态表、站址都没了，不能继续按旧状态走带
    if (getState().attached) {
        patch({ attached: false, playing: false });
        setRun('三维画面已重载，需重新接入', 'warn');
    }
    waitBridge();
});
// iframe 可能先于本模块完成加载，load 事件已错过则直接开始等
if (frame.contentWindow && frame.contentWindow.document.readyState === 'complete') waitBridge();

import { getState, patch } from './store.js?v=32';
import { initPanels, render as renderPanels, selectSat, setSpan, getSelectedSat, markAt,
         setView, satColor, scenarioSnapshot, exportRows } from './panels.js?v=32';
import { setStepSec, getStepSec, loadCategory, getValue } from './loader.js?v=32';

const displayCfg = await (await fetch('/sim/config/display.json')).json();

const $ = (id) => document.getElementById(id);
const frame = $('stage');
let sunEntry = null, dispEntry = null, bridge = null;
let station = { lat: 31.8206, lon: 117.2272, name: '合肥' };
const layers = { labels: true, trails: true, gtrack: false, links: false, terminator: true };

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
function setRun(text, cls) { setTag($('runTag'), text, cls); $('kvState').textContent = text; }
function setData(text, cls) { setTag($('dataTag'), text, cls); }

let toastTimer = null;
function toast(msg, bad) {
    const t = $('toast');
    t.textContent = msg;
    t.className = bad ? 'bad' : '';
    t.style.display = 'block';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.style.display = 'none'; }, 3200);
}

function download(name, text, mime) {
    const url = URL.createObjectURL(new Blob([text], { type: mime || 'text/plain;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// 等待 iframe 里的 StarTM 初始化出 __simbridge
function waitBridge(tries = 0) {
    const w = frame.contentWindow;
    if (w && w.__simbridge && w.__simbridge.version) {
        bridge = w.__simbridge;
        bridge.onPick = (meshIdx) => selectSat(meshIdx + 1);   // 画面里点星 → 联动参数台
        setData('三维画面已就绪', 'ok');
        return bridge;
    }
    if (tries > 300) { setRun('加载失败：三维画面未就绪', 'bad'); setData('未连接', 'bad'); return null; }
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

// 太阳方向、受光与点亮状态推给三维画面，使昼夜分界与发光面和数据一致
function pushSceneState(simSeconds) {
    if (!bridge) return;
    const e = Math.max(0, Math.min(Math.floor(simSeconds / (getStepSec() || 1)), 1e9));
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
            const on = Number(getValue(dispEntry, ep, sat, 'actual_strobe')) === 1;
            const ratio = sunEntry ? Number(getValue(sunEntry, ep, sat, 'sun_ratio')) : 1;
            bridge.setLight(sat - 1, on, Number.isFinite(ratio) ? ratio : 1);
        }
    }
}

function showStep(idx) {
    const st = getState();
    bridge.setStep(idx);
    $('tplus').innerHTML = `<span class="pre">T+</span>${hms(st.simSeconds)}`;
    $('kvTplus').textContent = hms(st.simSeconds);
    $('utcg').textContent = fmtUtc(bridge.getTimestamp(idx));
    $('stepSlider').value = idx;
    $('kvStep').textContent = `${idx + 1} / ${st.totalSteps}`;
    $('kvPct').textContent = st.totalSteps > 1
        ? (idx / (st.totalSteps - 1) * 100).toFixed(1) + ' %' : '--';
    pushSceneState(st.simSeconds);
    renderPanels(st.simSeconds);
}

function seekSeconds(sec) {
    const st = getState();
    if (!st.attached) return;
    const idx = Math.max(0, Math.min(Math.round(sec / st.stepIntervalSec), st.totalSteps - 1));
    st.currentStep = idx;
    st.simSeconds = idx * st.stepIntervalSec;
    showStep(idx);
}

// 相机模式：跟随把相机吊到选中星外侧，编队近景用 km 尺度的主星视角
function applyCam() {
    if (!bridge) return;
    const mode = $('camSel').value;
    const idx = getSelectedSat() - 1;
    if (mode === 'center') { bridge.setView('center'); bridge.follow && bridge.follow(null); return; }
    bridge.setView('third');
    bridge.selectSat && bridge.selectSat(idx);
    bridge.follow && bridge.follow(mode === 'follow' ? idx : null, 18);
}

// 顶栏三档视图：编队总览 / 单星查看 / 地面观察。切换不重置仿真时刻（方案 §4.2）
function applyView(view) {
    patch({ view });
    if (bridge) {
        const idx = getSelectedSat() - 1;
        if (view === 'ground') { bridge.setView('first'); bridge.follow && bridge.follow(null); }
        else if (view === 'satellite') {
            bridge.setView('third'); bridge.selectSat && bridge.selectSat(idx);
            bridge.follow && bridge.follow(idx, 18);
        } else { bridge.setView('third'); bridge.follow && bridge.follow(null); }
    }
    setView(view);
}

const LAYERS_NAME = { trails: '轨道轨迹', gtrack: '地面轨迹', links: '星间连线',
                      labels: '卫星标签', terminator: '晨昏线' };
function applyLayer(name, on) {
    layers[name] = on;
    if (!bridge || !bridge.setLayer) {
        if (on) toast(`「${LAYERS_NAME[name] || name}」图层待三维画面侧支持`);
        return;
    }
    // 三维侧没实现的层要说出来，不能按下去了却什么都没发生；关层不算失败，不提示
    if (on && bridge.setLayer(name, on) === false) toast(`「${LAYERS_NAME[name] || name}」这一层三维画面还没实现`);
}

let lastTick = performance.now();
function tick() {
    const st = getState();
    const now = performance.now();
    const dt = (now - lastTick) / 1000;
    lastTick = now;
    if (!st.attached || !st.playing || !bridge) return;
    st.simSeconds += st.rate * dt;          // 按真实经过时间 × 倍率推进，不按帧计数
    const idx = Math.min(Math.floor(st.simSeconds / st.stepIntervalSec), st.totalSteps - 1);
    if (idx !== st.currentStep) { st.currentStep = idx; showStep(idx); }
    else $('tplus').innerHTML = `<span class="pre">T+</span>${hms(st.simSeconds)}`;
    if (idx >= st.totalSteps - 1) { pause(); setRun('已完成', 'warn'); }
}

function play() {
    patch({ playing: true });
    lastTick = performance.now();
    $('btnPlay').classList.add('on');
    $('btnPlay').textContent = '⏸';
    $('btnPlay').setAttribute('aria-label', '暂停');
    if (bridge) bridge.resume();
    setRun(`运行中 ${getState().rate}×`, 'ok');
}
function pause() {
    patch({ playing: false });
    $('btnPlay').classList.remove('on');
    $('btnPlay').textContent = '▶';
    $('btnPlay').setAttribute('aria-label', '播放');
    if (bridge) bridge.pause();
    if (getState().attached) setRun('已暂停', 'warn');
}
function stepBy(d) {
    const st = getState();
    if (!st.attached) return;
    const idx = Math.max(0, Math.min(st.currentStep + d, st.totalSteps - 1));
    st.currentStep = idx; st.simSeconds = idx * st.stepIntervalSec;
    showStep(idx);
}

setInterval(tick, 100);

// ── 加载示例场景 ───────────────────────────────────
$('btnAttach').onclick = async () => {
    if (!bridge) { setRun('三维画面未就绪', 'bad'); return; }
    const t0 = performance.now();
    setRun('加载中…', 'warn');
    const timer = setInterval(() => setRun(`加载中 ${((performance.now() - t0) / 1000).toFixed(0)}s`, 'warn'), 500);
    bridge.setExternalMode(true);
    if (bridge.mode() !== 'csv') bridge.toggleCsvMode();   // 已是 CSV 就别再翻回 WS
    let ready = false;
    for (let i = 0; i < 60; i++) {
        await new Promise(r => setTimeout(r, 300));
        if (bridge.totalSteps() > 0 && bridge.getTimestamp(bridge.totalSteps() - 1)) { ready = true; break; }
    }
    clearInterval(timer);
    if (!ready) {
        setRun('加载失败：星历为空', 'bad'); setData('未连接', 'bad');
        toast('星历没读到，检查 /sim-data/projection/orbit_14col.csv 是否存在', true);
        return;
    }

    try {
        const st = (await (await fetch('/sim-data/meta.json')).json()).station;
        if (st) {
            station = { lat: st.lat_deg, lon: st.lon_deg, name: st.name || '站址' };
            $('obsLat').value = st.lat_deg; $('obsLon').value = st.lon_deg;
            $('kvObs').textContent = `${station.name} ${st.lat_deg}°N ${st.lon_deg}°E`;
            bridge.setStation(st.lat_deg, st.lon_deg);
        }
    } catch (e) { /* 站址缺失只影响地面观察读数，不阻塞回放 */ }
    try {
        bridge.setAttitudeTable(await loadAttitude());
        sunEntry = await loadCategory('sun_eclipse');
        dispEntry = await loadCategory('display');
    } catch (e) {
        setRun('加载失败：' + e.message, 'bad');
        toast('数据读取失败：' + e.message, true);
        return;
    }
    pushSceneState(0);
    bridge.rebuildView();
    Object.entries(layers).forEach(([n, on]) => applyLayer(n, on));

    const s = getState();
    s.totalSteps = bridge.totalSteps();
    s.stepIntervalSec = bridge.getStepIntervalSec();
    $('stepSlider').max = Math.max(0, s.totalSteps - 1);
    $('kvStepSec').textContent = `${s.stepIntervalSec} s`;
    $('kvSpan').textContent = `${hms(s.totalSteps * s.stepIntervalSec)} / ${s.stepIntervalSec} s`;
    $('kvTotal').textContent = hms(s.totalSteps * s.stepIntervalSec);
    patch({ attached: true, simSeconds: 0, currentStep: 0, playing: false });
    setStepSec(s.stepIntervalSec);
    try {
        await initPanels(displayCfg, {
            simSeconds: () => getState().simSeconds,
            onSelect: sat => {
                bridge && bridge.selectSat && bridge.selectSat(sat - 1);
                if ($('camSel').value === 'follow' && bridge) bridge.follow(sat - 1, 18);
                renderPanels(getState().simSeconds);
            },
            onSeek: seekSeconds,
            onAlarms: n => {
                $('alarmCount').textContent = n;
                $('alarmTag').className = 'tag ' + (n ? 'bad' : 'na');
            },
            onMissing: files => setData(`数据缺 ${files.join('、')}`, 'warn'),
            t0ms: () => { const t = bridge && bridge.getTimestamp(0); return t ? Date.parse(t.replace(/^(\d{4})(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)/, '$1-$2-$3T$4:$5:$6Z')) : 0; },
            station: () => station,
            orbitAt: (i) => (bridge.orbitAt ? bridge.orbitAt(i) : null),
        });
        setSpan(s.totalSteps * s.stepIntervalSec);
    } catch (e) {
        setRun('参数台初始化失败', 'bad');
        toast('参数台初始化失败：' + e.message, true);
        return;
    }
    showStep(0);
    if (bridge.frameDaylight) bridge.frameDaylight();   // 机位挪到昼侧，避免整面都是夜半球
    $('btnAttach').textContent = '重新加载';
    $('btnSave').disabled = false;
    $('btnExport').disabled = false;
    setRun('已就绪', 'ok');
    setData(`星历回放 ${s.totalSteps} 步 · ${s.stepIntervalSec} s`, 'ok');
    toast('示例场景已加载，按空格开始回放');
};

$('btnPlay').onclick = () => { getState().playing ? pause() : play(); };
$('btnStart').onclick = () => { if (getState().attached) { pause(); seekSeconds(0); setRun('已就绪', 'ok'); } };
$('btnBack').onclick = () => stepBy(-1);
$('btnFwd').onclick = () => stepBy(1);
$('rate').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-rate]');
    if (!b) return;
    [...$('rate').children].forEach(x => x.classList.remove('on'));
    b.classList.add('on');
    patch({ rate: Number(b.dataset.rate) });
    if (bridge) bridge.setRate(Number(b.dataset.rate));
    $('kvRate').textContent = b.dataset.rate + '×';
    if (getState().playing) setRun(`运行中 ${b.dataset.rate}×`, 'ok');
});
$('viewTabs').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-view]');
    if (b) applyView(b.dataset.view);
});
$('camSel').onchange = () => applyCam();
$('stepSlider').oninput = (e) => {
    const st = getState();
    if (!st.attached) return;
    const idx = Number(e.target.value);
    st.currentStep = idx;
    st.simSeconds = idx * st.stepIntervalSec;
    showStep(idx);
};

// 时间标尺悬停：把光标位置换成仿真时刻，并说明落在哪个窗口或事件上
$('stepSlider').addEventListener('mousemove', (e) => {
    const st = getState();
    if (!st.attached) return;
    const r = e.target.getBoundingClientRect();
    const sec = (e.clientX - r.left) / r.width * st.totalSteps * st.stepIntervalSec;
    const band = markAt(sec);
    const tip = $('tip');
    tip.style.display = 'block';
    tip.style.left = Math.min(e.clientX + 12, innerWidth - 340) + 'px';
    tip.style.top = (e.clientY - 40) + 'px';
    tip.textContent = `T+${hms(sec)} · ${fmtUtc(bridge.getTimestamp(Math.round(sec / st.stepIntervalSec)))}` +
                      (band ? ` · ${band}` : '');
});
$('stepSlider').addEventListener('mouseleave', () => { $('tip').style.display = 'none'; });

$('btnDaylight').onclick = () => { bridge && bridge.frameDaylight && bridge.frameDaylight(); };
$('btnReset').onclick = () => { $('camSel').value = 'third'; applyCam(); };
$('btnObs').onclick = () => {
    const lat = Number($('obsLat').value), lon = Number($('obsLon').value);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
        toast('经纬度超出范围：纬度 −90~90，经度 −180~180', true); return;
    }
    station = { lat, lon, name: '自定义' };
    $('kvObs').textContent = `${lat.toFixed(4)}°N ${lon.toFixed(4)}°E`;
    if (bridge) bridge.setStation(lat, lon);
    renderPanels(getState().simSeconds);
    toast('观察点已更新');
};

// 图层开关：三维侧不支持时明确告知，不做无声失败
const LAYERS = [['trails', '轨道轨迹'], ['gtrack', '地面轨迹'], ['links', '星间连线'],
                ['labels', '卫星标签'], ['terminator', '晨昏线']];
$('layers').innerHTML =
    `<div style="font:11px var(--cn);color:var(--dim);margin-bottom:2px">显示图层</div>` +
    LAYERS.map(([k, name]) =>
        `<button class="chip" data-layer="${k}" aria-pressed="${layers[k]}">` +
        `<span class="box"></span>${name}</button>`).join('') +
    `<div style="height:1px;background:var(--line);margin:5px 0"></div>` +
    getState().sats.map(s => `<span class="chip" style="cursor:default">` +
        `<span class="ln" style="--satc:${satColor(s)}"></span>TM0S${s}</span>`).join('');
$('layers').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-layer]');
    if (!b) return;
    const on = b.getAttribute('aria-pressed') !== 'true';
    b.setAttribute('aria-pressed', String(on));
    applyLayer(b.dataset.layer, on);
});

function togglePanel(which) {
    const cls = which === 'rail' ? 'rail-off' : 'console-off';
    const off = document.body.classList.toggle(cls);
    const btn = which === 'rail' ? $('btnRail') : $('btnConsole');
    btn.setAttribute('aria-pressed', String(!off));
    btn.style.color = off ? 'var(--dim)' : '';
}
$('btnRail').onclick = () => togglePanel('rail');
$('btnConsole').onclick = () => togglePanel('console');
$('btnFull').onclick = async () => {
    try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else await document.documentElement.requestFullscreen();
    } catch (e) { toast('全屏被浏览器拒绝：' + e.message, true); }
};

$('btnSave').onclick = () => {
    const name = `天幕场景_${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '')}.json`;
    download(name, JSON.stringify({ ...scenarioSnapshot(), 图层: layers }, null, 2), 'application/json');
    toast('场景已存为文件（浏览器下载，未存服务器）');
};
$('btnExport').onclick = () => {
    const sat = getSelectedSat();
    const { text, cols } = exportRows(sat);
    if (!cols) { toast('当前数据没有可导出的字段', true); return; }
    download(`TM0S${sat}_时间序列.csv`, '' + text, 'text/csv;charset=utf-8');
    toast(`已导出 TM0S${sat} 的 ${cols} 个字段（空值保持为空）`);
};

// 键盘：空格播放/暂停，左右单步，H 收起两侧
document.addEventListener('keydown', (e) => {
    const st = getState();
    if (e.repeat) return;
    if (e.target.closest('button, input, select, a, [contenteditable]')) return;
    if (e.key.toLowerCase() === 'h' && !e.ctrlKey && !e.metaKey) {
        togglePanel('rail'); togglePanel('console'); return;
    }
    if (!st.attached) return;
    if (e.code === 'Space') { e.preventDefault(); st.playing ? pause() : play(); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); stepBy(-1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); stepBy(1); }
});

frame.addEventListener('load', () => {
    // 画面重新加载后桥是新的：外部驱动、姿态表、站址都没了，不能继续按旧状态走带
    if (getState().attached) {
        patch({ attached: false, playing: false });
        setRun('三维画面已重载，需重新加载', 'warn');
    }
    waitBridge();
});
// iframe 可能先于本模块完成加载，load 事件已错过则直接开始等
if (frame.contentWindow && frame.contentWindow.document.readyState === 'complete') waitBridge();

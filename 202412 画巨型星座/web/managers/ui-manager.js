// ======================== UI 管理器 ========================
import { formatTimestamp, parseTimestamp, dateToJD } from '../modules/math-utils.js';

const DBG = {
    log: (...a) => console.log('[UI-MGR]', ...a)
};

/**
 * 创建 UI 管理器
 * 封装所有 UI 初始化逻辑，减少 app.js 行数
 */
export function createUiManager(appState, viewManager, playbackHandlers, orbitRingUpdater, modeManager) {
    const csvState = appState.csv.state;
    const interactionState = appState.interaction;
    const interpState = appState.interpolation;

    const { switchView } = viewManager;
    const { startPlay, stopPlay, changeSpeed, connectWs, isPlaying, seekToIndex } = playbackHandlers;

    /**
     * 初始化时间控制
     */
    function initTimeControls() {
        const startSelect = document.getElementById('startIdx');
        const endSelect = document.getElementById('endIdx');
        const slider = document.getElementById('timeSlider');

        // 兼容新界面：startIdx/endIdx 可能不存在
        if (startSelect) {
            startSelect.innerHTML = '';
            appState.csv.timeIndices.forEach((ts, idx) => {
                const opt = document.createElement('option');
                opt.value = idx;
                opt.textContent = formatTimestamp(ts);
                startSelect.appendChild(opt);
            });
            startSelect.addEventListener('change', () => {
                csvState.startIdx = parseInt(startSelect.value);
                if (csvState.currentTimeIdx < csvState.startIdx) {
                    csvState.currentTimeIdx = csvState.startIdx;
                    slider.value = csvState.currentTimeIdx;
                }
            });
        }

        if (endSelect) {
            endSelect.innerHTML = '';
            appState.csv.timeIndices.forEach((ts, idx) => {
                const opt = document.createElement('option');
                opt.value = idx;
                opt.textContent = formatTimestamp(ts);
                endSelect.appendChild(opt);
            });
            endSelect.value = appState.csv.timeIndices.length - 1;
            endSelect.addEventListener('change', () => {
                csvState.endIdx = parseInt(endSelect.value);
                if (csvState.currentTimeIdx > csvState.endIdx) {
                    csvState.currentTimeIdx = csvState.endIdx;
                    slider.value = csvState.currentTimeIdx;
                }
            });
        }

        slider.max = Math.max(0, appState.csv.timeIndices.length - 1);
        slider.addEventListener('input', () => {
            seekToIndex(parseInt(slider.value));
        });
    }

    /**
     * 初始化视角按钮
     */
    function initViewButtons() {
        const thirdBtn = document.getElementById('thirdViewBtn');
        const firstBtn = document.getElementById('firstViewBtn');
        const centerBtn = document.getElementById('centerViewBtn');

        if (thirdBtn) thirdBtn.addEventListener('click', () => switchView('third'));
        if (firstBtn) firstBtn.addEventListener('click', () => switchView('first'));
        if (centerBtn) centerBtn.addEventListener('click', () => switchView('center'));
    }

    /**
     * 初始化播放控制
     */
    function initPlaybackControls() {
        const playBtn = document.getElementById('playBtn');
        const stopBtn = document.getElementById('stopBtn');
        const speedSelect = document.getElementById('speed');

        if (playBtn) playBtn.addEventListener('click', startPlay);
        if (stopBtn) stopBtn.addEventListener('click', stopPlay);
        if (speedSelect) speedSelect.addEventListener('change', changeSpeed);
    }

    /**
     * 初始化锁定视角
     */
    function initLockView() {
        const btn = document.getElementById('lockViewBtn');
        if (!btn) return; // 新界面可能没有此按钮
        btn.addEventListener('click', () => {
            interactionState.isViewLocked = !interactionState.isViewLocked;
            if (interactionState.isViewLocked) {
                btn.textContent = '🔒 锁定视角';
                btn.classList.add('active');
            } else {
                btn.textContent = '🔓 解锁视角';
                btn.classList.remove('active');
            }
        });
    }

    /**
     * 初始化文件加载器
     */
    function initFileLoader() {
        const csvInput = document.getElementById('csvFileInput');
        if (!csvInput) return;
        csvInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            DBG.log(`加载文件: ${file.name}`);

            try {
                const text = await file.text();
                const lines = text.trim().split('\n');
                const grouped = {};

                for (let i = 1; i < lines.length; i++) {
                    const vals = lines[i].split(',');
                    if (vals.length < 14) continue;
                    const ts = vals[0];
                    const satId = parseInt(vals[1]);
                    if (isNaN(satId)) continue;

                    const sat = {
                        sat_id: satId, a: parseFloat(vals[2]), e: parseFloat(vals[3]),
                        i: parseFloat(vals[4]), OMG: parseFloat(vals[5]), omg: parseFloat(vals[6]),
                        f: parseFloat(vals[7]), X: parseFloat(vals[8]), Y: parseFloat(vals[9]),
                        Z: parseFloat(vals[10]), Vx: parseFloat(vals[11]), Vy: parseFloat(vals[12]),
                        Vz: parseFloat(vals[13])
                    };
                    if (!grouped[ts]) grouped[ts] = [];
                    grouped[ts].push(sat);
                }

                appState.csv.timeIndices = Object.keys(grouped).sort();
                appState.csv.satelliteData = appState.csv.timeIndices.map(ts => ({
                    timestamp: ts, sats: grouped[ts]
                }));
                csvState.endIdx = appState.csv.timeIndices.length - 1;
                csvState.startIdx = 0;
                csvState.currentTimeIdx = 0;

                const totalSatCountEl = document.getElementById('totalSatCount');
                if (totalSatCountEl) totalSatCountEl.textContent = appState.csv.satelliteData[0]?.sats?.length || 0;
                
                // 更新轨道环
                if (orbitRingUpdater) {
                    orbitRingUpdater();
                }
                
                initTimeControls();
                DBG.log(`CSV 加载完成: ${appState.csv.satelliteData.length} 帧`);
            } catch (err) {
                alert('CSV 解析失败: ' + err.message);
            }
        });
    }

    /**
     * 初始化所有 UI
     */
    function initAll() {
        initTimeControls();
        initPlaybackControls();
        initViewButtons();
        initLockView();
        initFileLoader();

        // 编队面板按钮已移至 index.html，无需在此初始化

        // 修复：默认隐藏 CSV 模式控件，因为系统默认运行在 WS 模式
        // 防止页面加载时的 UI 闪烁
        ['startIdx', 'endIdx', 'timeSlider'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.parentElement.style.display = 'none';
        });
        const bar = document.getElementById('time-bar-container');
        if (bar) bar.style.display = 'none';

        // 模式切换按钮 (从 app.js 迁移至此)
        const modeBtn = document.getElementById('modeToggle');
        if (modeBtn && modeManager) {
            modeBtn.addEventListener('click', () => {
                DBG.log('MODE', `切换模式: 当前 ${appState.currentMode}`);
                if (appState.currentMode === 'ws') modeManager.switchToCsv();
                else modeManager.switchToWs();
            });
        }
    }

    return { initAll };
}

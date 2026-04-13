// ======================== 模式管理器 ========================
import { parseTimestamp, dateToJD } from '../modules/math-utils.js';

const DBG = {
    log: (...a) => console.log('[MODE-MGR]', ...a),
    warn: (...a) => console.warn('[MODE-MGR]', ...a)
};

/**
 * 创建模式管理器
 */
export function createModeManager(appState, viewManager, playbackHandlers) {
    let currentMode = appState.currentMode;
    let currentView = appState.currentView;
    let csvState = appState.csv.state;
    let wsState = appState.ws;

    const { switchView } = viewManager;
    const { startCsvPlayback, stopCsvPlayback, connectWs, stopWs, updateWsStatus } = playbackHandlers;

    /**
     * 切换到 CSV 模式
     */
    function switchToCsv() {
        DBG.log('切换到 CSV 模式');
        currentMode = 'csv';
        appState.currentMode = 'csv';

        stopWs();
        if (wsState.connection && wsState.connection.readyState === WebSocket.OPEN) {
            wsState.connection.close();
        }
        wsState.connection = null;

        // 恢复 CSV UI
        document.getElementById('startIdx').parentElement.style.display = '';
        document.getElementById('endIdx').parentElement.style.display = '';
        document.getElementById('timeSlider').parentElement.style.display = '';
        const bar = document.getElementById('time-bar-container');
        if (bar) bar.style.display = '';
        document.getElementById('modeToggle').textContent = '🔄 切换到 WS 模式';
        updateWsStatus();

        // 重建场景
        if (appState.csv.satelliteData?.length > 0) {
            if (csvState.currentTimeIdx < 0 || csvState.currentTimeIdx >= appState.csv.satelliteData.length) {
                csvState.currentTimeIdx = 0;
            }

            const group = appState.csv.satelliteData[csvState.currentTimeIdx];
            if (!group?.sats?.length) {
                DBG.warn('无卫星数据，切到第三视角');
                switchView('third');
                return;
            }

            // 使用延迟切换确保 WS 循环完全停止
            setTimeout(() => {
                if (currentView === 'center') {
                    switchView('third');
                    setTimeout(() => {
                        switchView('center');
                        setTimeout(() => startCsvPlayback(true), 100);
                    }, 100);
                } else {
                    switchView(currentView);
                    setTimeout(() => startCsvPlayback(true), 100);
                }
            }, 200);
        } else {
            DBG.warn('无 CSV 数据，切到第三视角');
            switchView('third');
        }
    }

    /**
     * 切换到 WS 模式
     */
    function switchToWs() {
        DBG.log('切换到 WS 模式');

        // 修复：切换前必须停止 CSV 播放，防止双循环冲突
        stopCsvPlayback();

        currentMode = 'ws';
        appState.currentMode = 'ws';

        document.getElementById('startIdx').parentElement.style.display = 'none';
        document.getElementById('endIdx').parentElement.style.display = 'none';
        document.getElementById('timeSlider').parentElement.style.display = 'none';
        const bar = document.getElementById('time-bar-container');
        if (bar) bar.style.display = 'none';
        document.getElementById('modeToggle').textContent = '🔄 切换到 CSV 模式';
        connectWs(true);
    }

    return {
        switchToCsv,
        switchToWs,
        onWsConnected: () => {
            currentMode = 'ws';
            appState.currentMode = 'ws';
            // UI update is handled by playbackManager/UI manager
            console.log('[MODE-MGR] WS 连接成功');
        },
        onWsDisconnected: () => {
            currentMode = 'csv';
            appState.currentMode = 'csv';
            console.log('[MODE-MGR] WS 断开');
        },
        getCurrentMode: () => currentMode
    };
}

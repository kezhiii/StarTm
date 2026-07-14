// ======================== 模式管理器 ========================
import { parseTimestamp, dateToJD } from '../modules/math-utils.js';

/**
 * 创建模式管理器
 */
export function createModeManager(appState, viewManager, playbackHandlers) {
    const { switchView } = viewManager;
    const { startCsvPlayback, stopCsvPlayback, connectWs, stopWs, updateWsStatus, resumeWs, pauseWs } = playbackHandlers;

    /**
     * 切换到 CSV 模式
     */
    function switchToCsv() {
        console.log('[MODE-MGR] 切换到 CSV 模式');
        
        // 1. 停止 WS 播放（不断开连接）
        stopWs();
        
        // 2. 发送 PAUSE 命令到后端，保持连接
        pauseWs();
        
        // 3. 保留 WS 前端状态（关键修复：不清空队列，实现无缝恢复）
        const wsState = appState.ws;
        // wsState.dataQueue = [];  // 删除：不清空队列，保留已有数据
        wsState.lastStepData = null;
        wsState.playbackActive = false;
        wsState.connectionState = 'paused';
        updateWsStatus();
        console.log('[MODE-MGR] 切换到CSV，保留WS队列 ' + wsState.dataQueue.length + ' 帧');
        
        // 3. 更新模式状态
        appState.currentMode = 'csv';
        
        // 4. 清理插值状态
        const interpState = appState.interpolation;
        interpState.prevFrameData = null;
        interpState.currFrameData = null;
        interpState.currentInterpData = null;
        
        // 5. 恢复 CSV UI
        const timeRangeContainer = document.getElementById('timeRangeContainer');
        const modeToggleEl = document.getElementById('modeToggle');

        if (timeRangeContainer) timeRangeContainer.style.display = 'flex';
        // 修复：按钮显示当前模式，点击后切换到另一模式
        if (modeToggleEl) modeToggleEl.innerHTML = '<span class="mode-icon">📄</span><span class="mode-text">CSV 回放</span>';
        updateWsStatus();

        // 6. 验证 CSV 数据并重建场景
        const csvState = appState.csv.state;
        if (appState.csv.satelliteData?.length > 0) {
            // 确保时间索引有效
            if (csvState.currentTimeIdx < 0 || csvState.currentTimeIdx >= appState.csv.satelliteData.length) {
                csvState.currentTimeIdx = 0;
            }

            const group = appState.csv.satelliteData[csvState.currentTimeIdx];
            if (!group?.sats?.length) {
                console.warn('[MODE-MGR] 无 CSV 数据，切到第三视角');
                switchView('third');
                return;
            }

            // 重置地球自转参数
            const earthRotationState = appState.earthRotation;
            const d = parseTimestamp(group.timestamp);
            earthRotationState.startJD = dateToJD(d.year, d.month, d.day, d.hour, d.minute, d.second);
            earthRotationState.startTime = performance.now();
            earthRotationState.speedFactor = 1;

            // 简化切换逻辑：直接切换视角并启动播放
            const currentView = appState.currentView;
            switchView(currentView);
            
            // 等待视角切换完成后再启动播放
            setTimeout(() => {
                startCsvPlayback(true);
            }, 150);
        } else {
            console.warn('[MODE-MGR] 无 CSV 数据，切到第三视角');
            switchView('third');
        }
    }

    /**
     * 切换到 WS 模式
     */
    function switchToWs() {
        console.log('[MODE-MGR] 切换到 WS 模式');

        // 1. 停止 CSV 播放
        stopCsvPlayback();
        
        // 2. 清理 CSV 播放状态
        const csvState = appState.csv.state;
        csvState.isPlaying = false;
        if (csvState.playbackAnimId) {
            cancelAnimationFrame(csvState.playbackAnimId);
            csvState.playbackAnimId = null;
        }

        // 3. 更新模式状态
        appState.currentMode = 'ws';

        // 4. 隐藏 CSV UI
        const timeRangeContainer = document.getElementById('timeRangeContainer');
        const modeToggleEl = document.getElementById('modeToggle');

        if (timeRangeContainer) timeRangeContainer.style.display = 'none';
        if (modeToggleEl) modeToggleEl.innerHTML = '<span class="mode-icon">📡</span><span class="mode-text">WS 实时</span>';
        
        // 5. 恢复 WS 连接或新建连接
        const wsState = appState.ws;
        if (wsState.connection && wsState.connection.readyState === WebSocket.OPEN) {
            // 连接仍存在，发送 RESUME 命令恢复数据推送
            console.log('[MODE-MGR] WS 连接仍存在，发送 RESUME 恢复推送');
            resumeWs();
        } else {
            // 连接已断开，需要重新连接
            console.log('[MODE-MGR] WS 连接已断开，重新连接');
            connectWs(true);
        }
    }

    return {
        switchToCsv,
        switchToWs,
        onWsConnected: () => {
            appState.currentMode = 'ws';
            console.log('[MODE-MGR] WS 连接成功');
        },
        onWsDisconnected: () => {
            // WS 断开时不自动切换模式，由用户决定
            console.log('[MODE-MGR] WS 断开');
        },
        getCurrentMode: () => appState.currentMode
    };
}

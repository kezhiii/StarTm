// ======================== 统一播放控制器 ========================
import { startCsvPlayback, stopCsvPlayback } from './modes/csv-mode.js';
import { connectWebSocket, runWsPlayback, stopWsPlayback, sendWsCommand } from './modes/ws-mode.js';

/**
 * 创建播放控制器
 */
export function createPlaybackController(appState, updateCallbacks) {
    return {
        /**
         * 播放/继续
         */
        play() {
            const { ws, csv } = appState;
            
            // 如果 WS 已连接并正在播放，不启动任何播放
            if (ws.connection && ws.connection.readyState === WebSocket.OPEN && ws.playbackActive) {
                return;
            }
            
            // 停止所有可能的播放
            stopWsPlayback(appState);
            if (csv.state.isPlaying) stopCsvPlayback(appState);

            // 如果 WS 正在连接中，等待连接完成
            if (ws.connection && ws.connection.readyState === WebSocket.CONNECTING) {
                ws.autoPlayOnConnect = true;
                if (updateCallbacks.onStatusUpdate) {
                    updateCallbacks.onStatusUpdate(appState);
                }
                return;
            }

            if (appState.currentMode === 'ws') {
                if (ws.connection && ws.connection.readyState === WebSocket.OPEN) {
                    sendWsCommand(appState, 'resume');
                    ws.connectionState = 'playing';
                    runWsPlayback(appState, updateCallbacks);
                    if (updateCallbacks.onStatusUpdate) {
                        updateCallbacks.onStatusUpdate(appState);
                    }
                    return;
                }
                // 重连
                ws.dataQueue = [];
                ws.currentTime = 0;
                ws.playbackActive = false;
                ws.connection = null;
                ws.autoPlayOnConnect = true;
                connectWebSocket(appState, updateCallbacks, true);
                return;
            }
            
            startCsvPlayback(appState, updateCallbacks);
        },

        /**
         * 停止播放
         */
        stop() {
            const { ws, csv } = appState;
            
            stopWsPlayback(appState);
            if (csv.state.isPlaying) stopCsvPlayback(appState);

            // 重置地球自转状态
            appState.earthRotation.startTime = null;
            appState.earthRotation.startJD = null;
            appState.earthRotation.speedFactor = 1;

            // 更新 UI 状态
            const slider = document.getElementById('timeSlider');
            if (slider && appState.currentMode === 'csv') {
                slider.value = csv.state.currentTimeIdx;
            }
            
            const playBtn = document.getElementById('playBtn');
            if (playBtn) playBtn.textContent = '▶ 播放';

            if (appState.currentMode === 'ws' && ws.connection && ws.connection.readyState === WebSocket.OPEN) {
                sendWsCommand(appState, 'pause');
                ws.connectionState = 'paused';
                if (updateCallbacks.onStatusUpdate) {
                    updateCallbacks.onStatusUpdate(appState);
                }
            }
        },

        /**
         * 切换模式 (CSV <-> WS)
         */
        toggleMode() {
            if (appState.currentMode === 'ws') {
                // 切换到 CSV 模式
                appState.currentMode = 'csv';
                
                // 通知 app.js 同步全局变量
                if (updateCallbacks.onModeChange) {
                    updateCallbacks.onModeChange('csv');
                }
                
                stopWsPlayback(appState);

                if (appState.ws.connection && appState.ws.connection.readyState === WebSocket.OPEN) {
                    appState.ws.connection.close();
                }
                appState.ws.connection = null;
                
                // 恢复 CSV UI 元素
                const startIdxParent = document.getElementById('startIdx')?.parentElement;
                const endIdxParent = document.getElementById('endIdx')?.parentElement;
                const sliderParent = document.getElementById('timeSlider')?.parentElement;
                const barContainer = document.getElementById('time-bar-container');
                
                if (startIdxParent) startIdxParent.style.display = '';
                if (endIdxParent) endIdxParent.style.display = '';
                if (sliderParent) sliderParent.style.display = '';
                if (barContainer) barContainer.style.display = '';
                
                const modeBtn = document.getElementById('modeToggle');
                if (modeBtn) modeBtn.textContent = '🔄 切换到 WS 模式';
                
                if (updateCallbacks.onStatusUpdate) {
                    updateCallbacks.onStatusUpdate(appState);
                }
            } else {
                // 切换到 WS 模式
                appState.currentMode = 'ws';
                
                // 通知 app.js 同步全局变量
                if (updateCallbacks.onModeChange) {
                    updateCallbacks.onModeChange('ws');
                }
                
                connectWebSocket(appState, updateCallbacks, true);
                const modeBtn = document.getElementById('modeToggle');
                if (modeBtn) modeBtn.textContent = '🔄 切换到 CSV 模式';
            }
        },

        /**
         * 检查是否正在播放
         */
        isPlaying() {
            return appState.ws.playbackActive || appState.csv.state.isPlaying;
        }
    };
}

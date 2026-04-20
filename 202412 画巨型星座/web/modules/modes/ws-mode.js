// ======================== WebSocket 实时模式模块 ========================
import { parseTimestamp, dateToJD, formatTimestamp } from '../math-utils.js';
import { WS_MAX_QUEUE_SIZE } from '../config.js';
import { updateWsStatus } from '../../core/ws-utils.js';

/**
 * 连接 WebSocket 服务器
 */
export function connectWebSocket(appState, updateCallbacks, autoPlay = false) {
    const { ws } = appState;
    
    if (ws.connection && ws.connection.readyState !== WebSocket.CLOSED) return;
    
    ws.dataQueue = [];
    ws.currentTime = 0;
    ws.playbackActive = false;
    ws.lastStepData = null;
    ws.autoPlayOnConnect = autoPlay;
    ws.connectionState = 'connecting';
    
    if (updateCallbacks.onStatusUpdate) {
        updateCallbacks.onStatusUpdate(appState);
    }
    
    const clientId = 'web_' + Date.now() + '_' + Math.floor(Math.random() * 1000000);
    ws.connection = new WebSocket(`ws://127.0.0.1:8000/ws/${clientId}`);
    
    ws.connection.onopen = () => {
        ws.connectionState = 'buffering';
        appState.currentMode = 'ws';
        
        // 通知 app.js 同步全局变量
        if (updateCallbacks.onModeChange) {
            updateCallbacks.onModeChange('ws');
        }

        // 隐藏 CSV UI 元素
        const timeRangeContainer = document.getElementById('timeRangeContainer');
        const sliderParent = document.getElementById('timeSlider')?.parentElement;
        const barContainer = document.getElementById('time-bar-container');

        if (timeRangeContainer) timeRangeContainer.style.display = 'none';
        if (sliderParent) sliderParent.style.display = 'none';
        if (barContainer) barContainer.style.display = 'none';
        
        // 更新模式切换按钮
        const modeBtn = document.getElementById('modeToggle');
        if (modeBtn) modeBtn.innerHTML = '<span class="mode-icon">📡</span><span class="mode-text">WS 实时</span>';
        
        if (updateCallbacks.onStatusUpdate) {
            updateCallbacks.onStatusUpdate(appState);
        }

        // 初始化地球自转基准时间
        appState.earthRotation.startTime = performance.now();

        // 触发过渡动画回调
        if (updateCallbacks.onTransition) {
            updateCallbacks.onTransition('third');
        }
    };
    
    ws.connection.onmessage = (event) => {
        let msg;
        try {
            msg = JSON.parse(event.data);
        } catch (e) {
            console.error('WS 数据解析失败:', e);
            return;
        }
        
        // 处理协议响应
        if (msg.type === 'protocol_response') {
            console.log('[WS] 收到协议响应:', msg.cmd, msg.data);
            if (msg.cmd === 'light_control_ok') {
                console.log('[WS] constellationPanel:', appState.constellationPanel);
                if (appState.constellationPanel) {
                    appState.constellationPanel.handleLightResponse(msg.data);
                } else {
                    console.warn('[WS] constellationPanel 未初始化');
                }
            } else if (msg.cmd === 'light_control_error') {
                console.error('[CONSTELLATION] 灯光控制失败:', msg.data);
            }
            return;
        }
        
        if (msg.type === 'data' && Array.isArray(msg.data) && msg.data.length > 0) {
            // 验证数据格式
            const isValid = msg.data.every(d => Array.isArray(d) && d.length >= 14);
            if (!isValid) {
                console.warn('WS 数据格式错误，跳过本批次');
                return;
            }
            
            // 添加到队列
            for (let i = 0; i < msg.data.length; i++) {
                ws.dataQueue.push(msg.data[i]);
            }
            
            // 防止队列溢出
            while (ws.dataQueue.length > WS_MAX_QUEUE_SIZE) {
                ws.dataQueue.shift();
            }
            
            // 首次数据到达且自动播放已启用
            if (msg.is_first && !ws.playbackActive && ws.autoPlayOnConnect) {
                ws.connectionState = 'playing';
                ws.autoPlayOnConnect = false;
                runWsPlayback(appState, updateCallbacks);
            }
            
            // 如果播放活跃但计时器已停止
            if (ws.playbackActive && !ws.playbackTimer) {
                runWsPlayback(appState, updateCallbacks);
            }
            
            if (updateCallbacks.onStatusUpdate) {
                updateCallbacks.onStatusUpdate(appState);
            }
        }
    };
    
    ws.connection.onclose = () => {
        ws.connectionState = 'disconnected';
        appState.currentMode = 'csv';
        
        // 通知 app.js 同步全局变量
        if (updateCallbacks.onModeChange) {
            updateCallbacks.onModeChange('csv');
        }
        
        ws.playbackActive = false;
        ws.connection = null;
        stopWsPlayback(appState);
        
        if (appState.csv.state.isPlaying) {
            if (updateCallbacks.onStopCsv) {
                updateCallbacks.onStopCsv(appState);
            }
        }
        
        // 恢复 CSV UI 元素
        const timeRangeContainer = document.getElementById('timeRangeContainer');
        const sliderParent = document.getElementById('timeSlider')?.parentElement;
        const barContainer = document.getElementById('time-bar-container');

        if (timeRangeContainer) timeRangeContainer.style.display = 'flex';
        if (sliderParent) sliderParent.style.display = '';
        if (barContainer) barContainer.style.display = '';

        // 触发过渡动画
        if (updateCallbacks.onTransition) {
            updateCallbacks.onTransition('third');
        }
    };
    
    ws.connection.onerror = () => {
        ws.connectionState = 'disconnected';
        if (updateCallbacks.onStatusUpdate) {
            updateCallbacks.onStatusUpdate(appState);
        }
        
        // 延迟清理并重连
        setTimeout(() => {
            if (ws.connection && ws.connection.readyState === WebSocket.CLOSED) {
                ws.connection = null;
            }
            if (!ws.connection) {
                connectWebSocket(appState, updateCallbacks, ws.autoPlayOnConnect);
            }
        }, 3000);
    };
}

/**
 * 运行 WS 播放
 */
export function runWsPlayback(appState, updateCallbacks) {
    const { ws } = appState;
    if (ws.playbackActive) return;
    
    ws.playbackActive = true;

    // 重置插值状态
    appState.interpolation.prevFrameData = null;
    appState.interpolation.currFrameData = null;
    appState.interpolation.currentInterpData = null;

    // WS模式：地球自转与时间戳1:1同步
    appState.earthRotation.speedFactor = 1;
    appState.earthRotation.startTime = performance.now();

    function tick() {
        if (!ws.playbackActive) return;
        
        if (ws.dataQueue.length === 0) {
            ws.playbackTimer = setTimeout(tick, 100);
            return;
        }
        
        const stepData = ws.dataQueue.shift();
        appState.interpolation.prevFrameData = appState.interpolation.currFrameData;
        appState.interpolation.currFrameData = stepData;
        ws.lastStepData = stepData;

        // 初始化地球自转基准时间
        if (appState.earthRotation.startTime === null && stepData && stepData.length > 0) {
            appState.earthRotation.startTime = performance.now();
            const d = parseTimestamp(stepData[0][0]);
            appState.earthRotation.startJD = dateToJD(d.year, d.month, d.day, d.hour, d.minute, d.second);
        }

        // 触发插值回调
        if (updateCallbacks.onInterpolation) {
            updateCallbacks.onInterpolation();
        }
        
        // 更新时间显示
        if (stepData && stepData.length > 0) {
            const timeDisplay = document.getElementById('timeDisplay');
            if (timeDisplay) timeDisplay.textContent = formatTimestamp(stepData[0][0]);
        }
        
        ws.playbackTimer = setTimeout(tick, 1000);
    }
    tick();
}

/**
 * 停止 WS 播放
 */
export function stopWsPlayback(appState) {
    const { ws } = appState;
    ws.playbackActive = false;
    if (ws.playbackTimer) {
        clearTimeout(ws.playbackTimer);
        clearInterval(ws.playbackTimer);
        ws.playbackTimer = null;
    }
}

/**
 * 发送 WS 命令
 */
export function sendWsCommand(appState, cmd) {
    const { ws } = appState;
    if (ws.connection && ws.connection.readyState === WebSocket.OPEN) {
        ws.connection.send(JSON.stringify({ type: 'command', cmd }));
    }
}

// 注意：updateWsStatus 已从 ws-utils.js 导入，此处的本地实现已移除以避免重复

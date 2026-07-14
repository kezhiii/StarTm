// ======================== WebSocket 工具函数 ========================


const DBG = {
    warn: (...a) => console.warn('[WS-UTIL]', ...a)
};

/**
 * 发送 WebSocket 命令
 */
export function sendWsCommand(connection, cmd) {
    if (connection && connection.readyState === WebSocket.OPEN) {
        connection.send(JSON.stringify({ type: 'command', cmd }));
    }
}

/**
 * 更新 WebSocket 状态 UI
 */
export function updateWsStatus(wsState) {
    const statusDot = document.getElementById('ws-dot');
    const statusText = document.getElementById('ws-status');
    if (!statusDot || !statusText) return;
    statusDot.className = 'status-dot ' + wsState.connectionState;
    const texts = {
        disconnected: '未连接',
        connecting: '连接中...',
        buffering: '计算中...',
        playing: '实时播放',
        paused: '已暂停'
    };
    statusText.textContent = texts[wsState.connectionState] || '未知';
}

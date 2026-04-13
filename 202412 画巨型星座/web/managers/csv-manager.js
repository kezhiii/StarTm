// ======================== CSV 数据管理器 ========================
import { parseTimestamp, dateToJD, formatTimestamp } from '../modules/math-utils.js';

const DBG = {
    log: (...a) => console.log('[CSV-MGR]', ...a),
    warn: (...a) => console.warn('[CSV-MGR]', ...a),
    error: (...a) => console.error('[CSV-MGR]', ...a)
};

/**
 * 创建 CSV 管理器
 * @param {Object} appState - 应用状态
 * @param {Object} lightManager - 灯光管理器
 * @param {Object} constellationPanel - 星座面板
 */
export function createCsvManager(appState, lightManager, constellationPanel) {
    const csvState = appState.csv.state;

    /**
     * 加载 CSV 文件
     */
    async function loadCSV(filePath = '/Output/propagation_result.csv') {
        DBG.log('尝试加载 CSV 文件:', filePath);
        try {
            const response = await fetch(filePath);
            if (!response.ok) {
                console.log(`${filePath} 不存在，请使用文件选择器加载 CSV 文件`);
                return null;
            }
            const text = await response.text();
            const lines = text.trim().split('\n');
            const grouped = {};
            for (let i = 1; i < lines.length; i++) {
                const vals = lines[i].split(',');
                if (vals.length < 14) continue;
                const ts = vals[0];
                const satId = parseInt(vals[1]);
                if (isNaN(satId)) continue;
                const sat = {
                    sat_id: satId,
                    a: parseFloat(vals[2]), e: parseFloat(vals[3]), i: parseFloat(vals[4]),
                    OMG: parseFloat(vals[5]), omg: parseFloat(vals[6]), f: parseFloat(vals[7]),
                    X: parseFloat(vals[8]), Y: parseFloat(vals[9]), Z: parseFloat(vals[10]),
                    Vx: parseFloat(vals[11]), Vy: parseFloat(vals[12]), Vz: parseFloat(vals[13])
                };
                if (!grouped[ts]) grouped[ts] = [];
                grouped[ts].push(sat);
            }
            appState.csv.timeIndices = Object.keys(grouped).sort();
            appState.csv.satelliteData = appState.csv.timeIndices.map(ts => ({
                timestamp: ts, sats: grouped[ts]
            }));
            csvState.endIdx = appState.csv.timeIndices.length - 1;

            // 初始化灯光管理器
            const satCount = appState.csv.satelliteData[0]?.sats?.length || 22;
            if (lightManager) {
                lightManager.init(satCount);
                console.log(`[LIGHT] 已初始化 ${satCount} 颗卫星的灯光状态`);
            }

            // 更新编队面板
            if (constellationPanel) {
                constellationPanel.render();
            }

            console.log(`CSV加载完成: ${appState.csv.satelliteData.length} 个时间点, ${satCount} 颗卫星`);
            return appState.csv.satelliteData;
        } catch (e) {
            console.log(`${filePath} 加载失败，请使用文件选择器加载 CSV 文件`);
            return null;
        }
    }

    /**
     * 清理 WS 连接（加载 CSV 后调用）
     */
    function clearWsConnection() {
        const wsState = appState.ws;
        if (wsState.connection && wsState.connection.readyState !== WebSocket.CLOSED) {
            DBG.log('清理可能的 WS 连接');
            wsState.connection.onclose = null;
            wsState.connection.close();
            wsState.connection = null;
        }
        wsState.playbackActive = false;
        if (wsState.playbackAnimId) {
            cancelAnimationFrame(wsState.playbackAnimId);
            wsState.playbackAnimId = null;
        }
    }

    return {
        loadCSV,
        clearWsConnection
    };
}

// ======================== CSV 数据管理器 ========================
import { parseTimestamp, dateToJD, formatTimestamp } from '../modules/math-utils.js';

const DBG = {
    log: (...a) => console.log('[CSV-MGR]', ...a),
    warn: (...a) => console.warn('[CSV-MGR]', ...a),
    error: (...a) => console.error('[CSV-MGR]', ...a)
};

// CSV 数据列索引（与后端 compact 格式对应）
const COL = { sat_id: 0, a: 1, e: 2, i: 3, OMG: 4, omg: 5, f: 6, X: 7, Y: 8, Z: 9, Vx: 10, Vy: 11, Vz: 12 };
const CSV_API_URL = '/api/csv-data';

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
     * 优先从后端 API 获取预处理的 JSON 数据，失败时回退到前端解析 CSV 文本
     */
    async function loadCSV(filePath = '/Output/test_1.csv') {
        DBG.log('尝试加载 CSV 文件:', filePath);
        
        // 策略 1: 尝试从后端 API 获取预处理数据（推荐）
        try {
            const apiData = await loadFromApi();
            if (apiData) return apiData;
        } catch (e) {
            DBG.warn('后端 API 不可用，回退到前端解析');
        }
        
        // 策略 2: 回退到前端解析 CSV 文本
        return loadFromCsvText(filePath);
    }
    
    /**
     * 从后端 API 加载预处理数据
     */
    async function loadFromApi() {
        DBG.log('正在从后端 API 获取 CSV 数据...');
        const startMs = performance.now();
        
        const response = await fetch(CSV_API_URL);
        if (!response.ok) {
            DBG.warn(`API 返回 ${response.status}，回退到前端解析`);
            return null;
        }
        
        const apiResponse = await response.json();
        if (apiResponse.error) {
            DBG.warn(`API 错误: ${apiResponse.error}`);
            return null;
        }
        
        // 解析后端紧凑格式数据
        parseCompactApiData(apiResponse, appState);
        
        const loadMs = performance.now() - startMs;
        const meta = apiResponse.meta;
        DBG.log(`API 加载完成: ${meta.total_timestamps} 个时间点, ${meta.sat_count} 颗卫星, 耗时 ${loadMs.toFixed(0)}ms`);
        
        // 初始化灯光管理器
        if (lightManager) {
            lightManager.init(meta.sat_count);
            DBG.log(`[LIGHT] 已初始化 ${meta.sat_count} 颗卫星的灯光状态`);
        }
        
        // 更新编队面板
        if (constellationPanel) {
            constellationPanel.render();
        }
        
        return appState.csv.satelliteData;
    }
    
    /**
     * 解析后端紧凑格式数据
     * 后端格式: data[frame][sat] = [sat_id, a, e, i, OMG, omg, f, X, Y, Z, Vx, Vy, Vz]
     * 前端格式: data[i] = { timestamp, sats: [{sat_id, a, e, ...}, ...] }
     */
    function parseCompactApiData(apiResponse, appState) {
        const { timestamps, data } = apiResponse;
        appState.csv.timeIndices = timestamps;
        appState.csv.satelliteData = timestamps.map((ts, i) => ({
            timestamp: ts,
            sats: data[i].map(satArray => ({
                sat_id: satArray[COL.sat_id],
                a: satArray[COL.a],
                e: satArray[COL.e],
                i: satArray[COL.i],
                OMG: satArray[COL.OMG],
                omg: satArray[COL.omg],
                f: satArray[COL.f],
                X: satArray[COL.X],
                Y: satArray[COL.Y],
                Z: satArray[COL.Z],
                Vx: satArray[COL.Vx],
                Vy: satArray[COL.Vy],
                Vz: satArray[COL.Vz]
            }))
        }));
        csvState.startIdx = 0;
        csvState.currentTimeIdx = 0;
        csvState.endIdx = timestamps.length - 1;
    }

    /**
     * 从前端解析 CSV 文本（回退方案）
     */
    async function loadFromCsvText(filePath) {
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
            csvState.startIdx = 0;
            csvState.currentTimeIdx = 0;
            csvState.endIdx = appState.csv.timeIndices.length - 1;

            // 初始化灯光管理器
            const satCount = appState.csv.satelliteData[0]?.sats?.length || 22;
            if (lightManager) {
                lightManager.init(satCount);
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

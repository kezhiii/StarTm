// ======================== CSV 数据模式模块 ========================
import { parseTimestamp, dateToJD, formatTimestamp } from '../math-utils.js';

/**
 * 从 URL 加载 CSV 数据
 */
export async function loadCSV(appState) {
    try {
        const response = await fetch('/Output/propagation_result.csv');
        if (!response.ok) {
            console.log('propagation_result.csv 不存在，请使用文件选择器加载 CSV 文件');
            return;
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
                a: parseFloat(vals[2]), e: parseFloat(vals[3]),
                i: parseFloat(vals[4]), OMG: parseFloat(vals[5]),
                omg: parseFloat(vals[6]), f: parseFloat(vals[7]),
                X: parseFloat(vals[8]), Y: parseFloat(vals[9]),
                Z: parseFloat(vals[10]),
                Vx: parseFloat(vals[11]), Vy: parseFloat(vals[12]),
                Vz: parseFloat(vals[13])
            };
            if (!grouped[ts]) grouped[ts] = [];
            grouped[ts].push(sat);
        }
        appState.csv.timeIndices = Object.keys(grouped).sort();
        appState.csv.satelliteData = appState.csv.timeIndices.map(ts => ({
            timestamp: ts,
            sats: grouped[ts]
        }));
        appState.csv.state.endIdx = appState.csv.timeIndices.length - 1;
        console.log(`CSV加载完成: ${appState.csv.satelliteData.length} 个时间点, ${appState.csv.satelliteData[0]?.sats.length || 0} 颗卫星`);
    } catch (e) {
        console.log('propagation_result.csv 加载失败，请使用文件选择器加载 CSV 文件');
    }
}

/**
 * 从文件对象加载 CSV
 */
export async function loadCSVFromFile(file, appState, updateCallbacks) {
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
                sat_id: satId,
                a: parseFloat(vals[2]), e: parseFloat(vals[3]),
                i: parseFloat(vals[4]), OMG: parseFloat(vals[5]),
                omg: parseFloat(vals[6]), f: parseFloat(vals[7]),
                X: parseFloat(vals[8]), Y: parseFloat(vals[9]),
                Z: parseFloat(vals[10]),
                Vx: parseFloat(vals[11]), Vy: parseFloat(vals[12]),
                Vz: parseFloat(vals[13])
            };
            if (!grouped[ts]) grouped[ts] = [];
            grouped[ts].push(sat);
        }
        appState.csv.timeIndices = Object.keys(grouped).sort();
        appState.csv.satelliteData = appState.csv.timeIndices.map(ts => ({
            timestamp: ts,
            sats: grouped[ts]
        }));
        appState.csv.state.endIdx = appState.csv.timeIndices.length - 1;
        appState.csv.state.startIdx = 0;
        appState.csv.state.currentTimeIdx = 0;
        
        // 触发更新回调
        if (updateCallbacks.onDataLoaded) {
            updateCallbacks.onDataLoaded(appState);
        }
        
        return {
            timePoints: appState.csv.satelliteData.length,
            satCount: appState.csv.satelliteData[0]?.sats.length || 0
        };
    } catch (err) {
        throw new Error('CSV解析失败: ' + err.message);
    }
}

/**
 * 启动 CSV 播放
 */
export function startCsvPlayback(appState, updateCallbacks) {
    const { csv } = appState;
    if (csv.state.isPlaying) return;
    if (!csv.satelliteData || csv.satelliteData.length === 0) {
        console.error("无可用卫星数据，请先加载 CSV 文件");
        return;
    }
    csv.state.isPlaying = true;

    // 重置插值状态
    appState.interpolation.prevFrameData = null;
    appState.interpolation.currFrameData = null;
    appState.interpolation.currentInterpData = null;

    const speed = parseInt(document.getElementById('speed')?.value || '10', 10);
    const intervalMs = Math.max(100 / speed, 16);

    // 计算CSV帧时间间隔（秒）
    let frameIntervalSec = 60;  // 默认1分钟
    if (csv.timeIndices.length >= 2) {
        const d1 = parseTimestamp(csv.timeIndices[0]);
        const d2 = parseTimestamp(csv.timeIndices[1]);
        const jd1 = dateToJD(d1.year, d1.month, d1.day, d1.hour, d1.minute, d1.second);
        const jd2 = dateToJD(d2.year, d2.month, d2.day, d2.hour, d2.minute, d2.second);
        frameIntervalSec = Math.abs((jd2 - jd1) * 86400);
    }

    // 速度因子
    const framesPerSec = 1000 / intervalMs;
    appState.earthRotation.speedFactor = framesPerSec * frameIntervalSec;

    // 重置地球自转基准时间
    appState.earthRotation.startTime = performance.now();
    const groupData = csv.satelliteData[csv.state.currentTimeIdx];
    if (groupData) {
        const d = parseTimestamp(groupData.timestamp);
        appState.earthRotation.startJD = dateToJD(d.year, d.month, d.day, d.hour, d.minute, d.second);
    }

    csv.state.interval = setInterval(() => {
        if (csv.state.currentTimeIdx >= csv.state.endIdx) {
            csv.state.currentTimeIdx = csv.state.startIdx;
        } else {
            csv.state.currentTimeIdx++;
        }
        
        // 更新时间滑块
        const slider = document.getElementById('timeSlider');
        if (slider) slider.value = csv.state.currentTimeIdx;

        const groupData = csv.satelliteData[csv.state.currentTimeIdx];
        if (!groupData) return;
        
        const timestamp = groupData.timestamp;
        const frameData = groupData.sats.map(sat => [
            timestamp, sat.sat_id, sat.a, sat.e, sat.i, sat.OMG, sat.omg, sat.f,
            sat.X, sat.Y, sat.Z, sat.Vx, sat.Vy, sat.Vz
        ]);
        
        appState.interpolation.prevFrameData = appState.interpolation.currFrameData;
        appState.interpolation.currFrameData = frameData;
        
        // 触发插值回调
        if (updateCallbacks.onInterpolation) {
            updateCallbacks.onInterpolation(intervalMs);
        }
        
        // 触发视图更新回调
        if (updateCallbacks.onViewUpdate) {
            updateCallbacks.onViewUpdate(appState);
        }

        // 更新时间显示
        const timeDisplay = document.getElementById('timeDisplay');
        if (timeDisplay) timeDisplay.textContent = formatTimestamp(timestamp);
    }, intervalMs);
}

/**
 * 停止 CSV 播放
 */
export function stopCsvPlayback(appState) {
    const { csv } = appState;
    csv.state.isPlaying = false;
    if (csv.state.interval) {
        clearInterval(csv.state.interval);
        csv.state.interval = null;
    }
}

/**
 * 更新当前视图 (CSV 模式)
 */
export function updateCurrentView(appState, updateCallbacks) {
    const { csv } = appState;
    if (updateCallbacks.onUpdateView) {
        updateCallbacks.onUpdateView(appState);
    }
    
    // 更新时间条
    const progress = csv.timeIndices.length > 1 
        ? (csv.state.currentTimeIdx / (csv.timeIndices.length - 1)) * 100 
        : 0;
    const bar = document.getElementById('time-bar');
    if (bar) bar.style.width = progress + '%';
}

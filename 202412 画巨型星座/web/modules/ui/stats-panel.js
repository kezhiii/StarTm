// ======================== 统计面板模块 ========================
import { RE_KM } from '../config.js';
import { parseTimestamp, dateToJD, eciToEcef, ecefToLocal, formatTimestamp } from '../math-utils.js';

let visibilityCache = null;
let visibilityCacheKey = null;

/**
 * 计算可见性窗口
 */
export function calculateVisibilityWindows(appState) {
    const { interaction, csv } = appState;
    const cacheKey = `${interaction.currentLat}-${interaction.currentLon}-${csv.satelliteData.length}-${csv.satelliteData[0]?.timestamp || ''}`;
    if (visibilityCache && visibilityCacheKey === cacheKey) {
        return visibilityCache;
    }
    const windows = {};
    const nSats = csv.satelliteData[0]?.sats.length || 0;
    for (let satId = 0; satId < nSats; satId++) {
        windows[satId] = [];
        let inWindow = false, windowStart = null;
        for (let t = 0; t < csv.satelliteData.length; t++) {
            const sat = csv.satelliteData[t].sats[satId];
            if (!sat) continue;
            const d = parseTimestamp(csv.satelliteData[t].timestamp);
            const gmst = dateToJD(d.year, d.month, d.day, d.hour, d.minute, d.second);
            const ecef = eciToEcef(sat.X, sat.Y, sat.Z, gmst);
            const local = ecefToLocal(ecef.x, ecef.y, ecef.z, interaction.currentLat, interaction.currentLon);
            if (local.el >= 0) {
                if (!inWindow) { inWindow = true; windowStart = t; }
            } else {
                if (inWindow) {
                    windows[satId].push({
                        start: csv.satelliteData[windowStart].timestamp,
                        end: csv.satelliteData[t].timestamp,
                        duration: t - windowStart
                    });
                    inWindow = false;
                }
            }
        }
        if (inWindow) {
            windows[satId].push({
                start: csv.satelliteData[windowStart].timestamp,
                end: csv.satelliteData[csv.satelliteData.length - 1].timestamp,
                duration: csv.satelliteData.length - 1 - windowStart
            });
        }
    }
    visibilityCache = windows;
    visibilityCacheKey = cacheKey;
    return windows;
}

/**
 * 更新统计面板
 */
export function updateStatsPanel(appState) {
    if (appState.currentMode === 'ws') {
        document.getElementById('stats-content').innerHTML = '<div>WS 模式下统计面板暂不可用</div><div>请使用 CSV 模式查看统计信息</div>';
        return;
    }
    if (!appState.csv.satelliteData.length) return;
    const data = appState.csv.satelliteData[appState.csv.state.currentTimeIdx];
    if (!data) return;
    const alts = data.sats.map(s => Math.sqrt(s.X**2 + s.Y**2 + s.Z**2) - RE_KM);
    const minAlt = alts.length > 0 ? Math.min(...alts) : 0;
    const maxAlt = alts.length > 0 ? Math.max(...alts) : 0;
    let minDist = Infinity, maxDist = 0;
    for (let i = 0; i < data.sats.length; i++) {
        for (let j = i + 1; j < data.sats.length; j++) {
            const dx = data.sats[i].X - data.sats[j].X;
            const dy = data.sats[i].Y - data.sats[j].Y;
            const dz = data.sats[i].Z - data.sats[j].Z;
            const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
            minDist = Math.min(minDist, dist);
            maxDist = Math.max(maxDist, dist);
        }
    }
    const windows = calculateVisibilityWindows(appState);
    const totalVisMin = Object.values(windows).reduce((sum, w) => sum + w.reduce((s, win) => s + win.duration, 0), 0);
    document.getElementById('stats-content').innerHTML = `<div><strong>当前时刻:</strong> ${formatTimestamp(data.timestamp)}</div><div><strong>卫星总数:</strong> ${data.sats.length}</div><div><strong>高度范围:</strong> ${minAlt.toFixed(1)} ~ ${maxAlt.toFixed(1)} km</div><div><strong>平均高度:</strong> ${(alts.length > 0 ? alts.reduce((a, b) => a + b, 0) / alts.length : 0).toFixed(1)} km</div><div><strong>编队间距:</strong> ${minDist === Infinity ? 0 : minDist.toFixed(2)} ~ ${maxDist.toFixed(2)} km</div><div><strong>可见卫星:</strong> ${document.getElementById('visibleCount').textContent} / ${data.sats.length}</div><div><strong>总可见时间:</strong> ${totalVisMin} 分钟</div><hr style="margin: 10px 0; border-color: #333;"><div><strong>快捷键:</strong></div><div>空格 = 播放/暂停</div><div>1/2/3 = 切换视角</div><div>←/→ = 上一帧/下一帧</div>`;
}

/**
 * 初始化统计面板
 */
export function initStatsPanel(updateCallback) {
    const statsBtn = document.getElementById('statsBtn');
    const closeBtn = document.getElementById('closeStatsBtn');
    if (statsBtn) statsBtn.addEventListener('click', () => {
        document.getElementById('stats-panel').classList.remove('hidden');
        if (updateCallback) updateCallback();
    });
    if (closeBtn) closeBtn.addEventListener('click', () => {
        document.getElementById('stats-panel').classList.add('hidden');
    });
}

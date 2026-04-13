// ======================== 位置控制模块 ========================
import { parseTimestamp, dateToJD } from '../math-utils.js';

/**
 * 初始化位置控制
 */
export function initLocationControls(appState, updateCallbacks) {
    const applyBtn = document.getElementById('apply');
    const latInput = document.getElementById('lat');
    const lonInput = document.getElementById('lon');

    if (!applyBtn || !latInput || !lonInput) return;

    applyBtn.addEventListener('click', () => {
        appState.interaction.currentLat = parseFloat(latInput.value);
        appState.interaction.currentLon = parseFloat(lonInput.value);

        // 确保地球自转基准时间已初始化（WS 模式）
        if (appState.currentMode === 'ws' && appState.ws.lastStepData) {
            if (appState.earthRotation.startJD === null) {
                const d = parseTimestamp(appState.ws.lastStepData[0][0]);
                appState.earthRotation.startJD = dateToJD(d.year, d.month, d.day, d.hour, d.minute, d.second);
            }
        }

        if (updateCallbacks.onLocationChange) {
            updateCallbacks.onLocationChange(appState);
        }
    });

    return {
        setLocation(lat, lon) {
            appState.interaction.currentLat = lat;
            appState.interaction.currentLon = lon;
            if (latInput) latInput.value = lat;
            if (lonInput) lonInput.value = lon;
        }
    };
}

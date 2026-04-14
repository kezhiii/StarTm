// ======================== 统一播放控制器 ========================
import { parseTimestamp, dateToJD, formatTimestamp } from './math-utils.js';
import { interpolateSatellites, updateSatellitesThirdPersonInterp, updateSatellitesFirstPersonInterp, updateSatellitesCenterPersonInterp } from './interpolation.js';

const DBG = {
    log: (m, ...a) => console.log(`[PLAYBACK]`, ...a),
    error: (m, ...a) => console.error(`[PLAYBACK]`, ...a)
};

/**
 * 启动 CSV 播放
 */
export function startCsvPlayback(appState, getCurrentViewFn, intervalMsOverride) {
    const data = appState.csv.satelliteData;
    const state = appState.csv.state;
    const times = appState.csv.timeIndices;

    if (state.isPlaying) return;
    if (!data || data.length === 0) {
        DBG.error('无可用卫星数据');
        return;
    }
    state.isPlaying = true;

    // 计算 CSV 帧间隔
    let frameIntervalSec = 60;
    if (times.length >= 2) {
        const d1 = parseTimestamp(times[0]);
        const d2 = parseTimestamp(times[1]);
        frameIntervalSec = Math.abs((dateToJD(d2.year, d2.month, d2.day, d2.hour, d2.minute, d2.second) -
                                      dateToJD(d1.year, d1.month, d1.day, d1.hour, d1.minute, d1.second)) * 86400);
    }

    const speedEl = document.getElementById('speed');
    const intervalMs = intervalMsOverride || (speedEl ? parseInt(speedEl.value, 10) : 1000 / 30);
    const framesPerSec = 1000 / intervalMs;
    appState.earthRotation.speedFactor = framesPerSec * frameIntervalSec;

    // 重置状态
    appState.earthRotation.startTime = performance.now();
    appState.interpolation.prevFrameData = null;
    appState.interpolation.currFrameData = null;
    appState.interpolation.currentInterpData = null;

    const groupData = data[state.currentTimeIdx];
    if (groupData) {
        const d = parseTimestamp(groupData.timestamp);
        appState.earthRotation.startJD = dateToJD(d.year, d.month, d.day, d.hour, d.minute, d.second);
        appState.interpolation.currFrameData = groupData.sats.map(sat => [
            groupData.timestamp, sat.sat_id, sat.a, sat.e, sat.i, sat.OMG, sat.omg, sat.f,
            sat.X, sat.Y, sat.Z, sat.Vx, sat.Vy, sat.Vz
        ]);
    }

    DBG.log(`CSV 播放开始: ${data.length}帧, ${intervalMs}ms/帧`);

    let lastFrameTime = performance.now();
    let accumulator = 0;

    function playbackLoop(now) {
        if (!state.isPlaying) return;

        const delta = now - lastFrameTime;
        lastFrameTime = now;
        accumulator += delta;

        while (accumulator >= intervalMs) {
            accumulator -= intervalMs;
            if (state.currentTimeIdx >= state.endIdx) state.currentTimeIdx = state.startIdx;
            else state.currentTimeIdx++;

            const currentGroup = data[state.currentTimeIdx];
            if (currentGroup) {
                appState.interpolation.prevFrameData = appState.interpolation.currFrameData;
                appState.interpolation.currFrameData = currentGroup.sats.map(sat => [
                    currentGroup.timestamp, sat.sat_id, sat.a, sat.e, sat.i, sat.OMG, sat.omg, sat.f,
                    sat.X, sat.Y, sat.Z, sat.Vx, sat.Vy, sat.Vz
                ]);
            }

            const timeSlider = document.getElementById('timeSlider');
            if (timeSlider) timeSlider.value = state.currentTimeIdx;
            const bar = document.getElementById('time-bar');
            if (bar) bar.style.width = (times.length > 1 ? (state.currentTimeIdx / (times.length - 1)) * 100 : 0) + '%';
        }

        const interpData = interpolateSatellites(
            appState.interpolation.prevFrameData,
            appState.interpolation.currFrameData,
            accumulator / intervalMs
        );
        appState.interpolation.currentInterpData = interpData;

        const currentView = getCurrentViewFn();
        if (currentView === 'third') {
            updateSatellitesThirdPersonInterp(interpData, appState.sceneObjects, appState.interaction);
        } else if (currentView === 'first') {
            updateSatellitesFirstPersonInterp(interpData, appState);
        } else {
            // 由 app.js 传入相机更新函数
            if (playbackLoop.updateCameraFn) {
                updateSatellitesCenterPersonInterp(interpData, appState, playbackLoop.camera, playbackLoop.cameraPanOffset, playbackLoop.updateCameraFn);
            }
        }

        state.playbackAnimId = requestAnimationFrame(playbackLoop);
    }

    // 存储相机引用供插值使用
    playbackLoop.updateCameraFn = null;
    playbackLoop.camera = null;
    playbackLoop.cameraPanOffset = null;

    state.playbackAnimId = requestAnimationFrame(playbackLoop);
    return playbackLoop;
}

/**
 * 停止 CSV 播放
 */
export function stopCsvPlayback(appState) {
    const state = appState.csv.state;
    state.isPlaying = false;
    if (state.playbackAnimId) {
        cancelAnimationFrame(state.playbackAnimId);
        state.playbackAnimId = null;
    }
    DBG.log('CSV 播放停止');
}

/**
 * 创建播放控制器
 */
export function createPlaybackController(appState, getCurrentViewFn) {
    let wsConnectFn = null;
    let wsRunPlaybackFn = null;
    let wsStopPlaybackFn = null;
    let wsSendCmdFn = null;

    return {
        setWsHandlers(connect, runPlayback, stopPlayback, sendCmd) {
            wsConnectFn = connect;
            wsRunPlaybackFn = runPlayback;
            wsStopPlaybackFn = stopPlayback;
            wsSendCmdFn = sendCmd;
        },

        setCameraUpdateFn(updateCameraFn, camera, cameraPanOffset) {
            // 设置主星视角相机更新函数
        },

        startCsvPlayback(resetState = true, intervalMsOverride) {
            if (resetState) {
                startCsvPlayback(appState, getCurrentViewFn, intervalMsOverride);
            } else {
                // 速度切换：保持状态只改间隔
                const speedEl = document.getElementById('speed');
                const intervalMs = intervalMsOverride || (speedEl ? parseInt(speedEl.value, 10) : 1000 / 30);
                startCsvPlayback(appState, getCurrentViewFn, intervalMs);
            }
        },

        stopCsvPlayback() {
            stopCsvPlayback(appState);
        },

        play() {
            const { ws, csv } = appState;
            if (ws.connection && ws.connection.readyState === WebSocket.OPEN && ws.playbackActive) return;

            this.stop();

            if (ws.connection && ws.connection.readyState === WebSocket.CONNECTING) {
                ws.autoPlayOnConnect = true;
                return;
            }

            if (appState.currentMode === 'ws') {
                if (ws.connection && ws.connection.readyState === WebSocket.OPEN) {
                    wsSendCmdFn?.('resume');
                    ws.connectionState = 'playing';
                    wsRunPlaybackFn?.();
                    return;
                }
                ws.dataQueue = [];
                ws.playbackActive = false;
                ws.connection = null;
                ws.autoPlayOnConnect = true;
                wsConnectFn?.(true);
                return;
            }

            startCsvPlayback(appState, getCurrentViewFn);
        },

        stop() {
            const { ws, csv } = appState;
            wsStopPlaybackFn?.();
            if (csv.state.isPlaying) stopCsvPlayback(appState);

            appState.earthRotation.startTime = null;
            appState.earthRotation.startJD = null;
            appState.earthRotation.speedFactor = 1;

            const slider = document.getElementById('timeSlider');
            if (slider && appState.currentMode === 'csv') slider.value = csv.state.currentTimeIdx;
            const playBtn = document.getElementById('playBtn');
            if (playBtn) playBtn.textContent = '▶ 播放';

            if (appState.currentMode === 'ws' && ws.connection && ws.connection.readyState === WebSocket.OPEN) {
                wsSendCmdFn?.('pause');
                ws.connectionState = 'paused';
            }
        },

        changeSpeed() {
            if (appState.currentMode === 'ws') return;
            if (!appState.csv.state.isPlaying) return;

            const speedEl = document.getElementById('speed');
            const intervalMs = speedEl ? parseInt(speedEl.value, 10) : 1000 / 30;
            if (appState.csv.state.playbackAnimId) {
                cancelAnimationFrame(appState.csv.state.playbackAnimId);
            }
            appState.csv.state.isPlaying = false;
            startCsvPlayback(appState, getCurrentViewFn, intervalMs);
        },

        isPlaying() {
            return appState.ws.playbackActive || appState.csv.state.isPlaying;
        }
    };
}

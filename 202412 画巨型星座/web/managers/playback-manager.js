// ======================== 播放管理器 ========================
import * as THREE from 'three';
import { parseTimestamp, dateToJD, formatTimestamp, calcGMST } from '../modules/math-utils.js';
import { latLonToSurface3D } from '../modules/earth-rotation.js';
import { interpolateSatellites, updateSatellitesThirdPersonInterp, updateSatellitesFirstPersonInterp, updateSatellitesCenterPersonInterp } from '../modules/interpolation.js';
import { sendWsCommand as sendWsCmd, updateWsStatus as updateWsSts } from '../core/ws-utils.js';
import { updateSatellitesThirdPersonWs } from '../modules/views/third-person.js';
import { updateSatellitesFirstPersonWs } from '../modules/views/first-person.js';
import { updateSatellitesCenterPersonWs } from '../modules/views/center-person.js';

const DBG = {
    log: (...a) => console.log('[PLAYBACK]', ...a),
    warn: (...a) => console.warn('[PLAYBACK]', ...a),
    error: (...a) => console.error('[PLAYBACK]', ...a)
};

const WS_MAX_QUEUE_SIZE = 3600;

// CSV 播放循环状态（模块级，以便 changeSpeed 时保持状态）
let csvPlaybackState = {
    lastFrameTime: 0,
    accumulator: 0,
    intervalMs: 1000 / 30, // 默认 30fps
    loopRunning: false,
    wasPaused: false, // 标记是否是从暂停恢复
    pausedSimulatedTime: 0, // 暂停时刻的模拟时间（用于恢复地球自转）
    pausedStartJD: null // 暂停时刻的 startJD
};

/**
 * 创建播放管理器
 */
// Added cameraPanOffset parameter
export function createPlaybackManager(appState, engine, viewManager, modules, cameraPanOffset) {
    const csvState = appState.csv.state;
    const wsState = appState.ws;
    const interpState = appState.interpolation;
    const earthRotationState = appState.earthRotation;
    const { scene, camera, render } = engine;

    /**
     * 启动 CSV 播放
     */
    function startCsvPlayback(resetState = true, intervalMsOverride) {
        const data = appState.csv.satelliteData;
        const times = appState.csv.timeIndices;

        if (csvState.isPlaying) return;
        if (!data || data.length === 0) {
            DBG.error('无可用数据');
            return;
        }
        csvState.isPlaying = true;

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
        earthRotationState.speedFactor = framesPerSec * frameIntervalSec;

        DBG.log(`CSV 播放启动: resetState=${resetState}, 当前时间索引=${csvState.currentTimeIdx}`);

        if (resetState) {
            earthRotationState.startTime = performance.now();
            interpState.prevFrameData = null;
            interpState.currFrameData = null;
            interpState.currentInterpData = null;

            const groupData = data[csvState.currentTimeIdx];
            if (groupData) {
                const d = parseTimestamp(groupData.timestamp);
                earthRotationState.startJD = dateToJD(d.year, d.month, d.day, d.hour, d.minute, d.second);
                interpState.currFrameData = groupData.sats.map(sat => [
                    groupData.timestamp, sat.sat_id, sat.a, sat.e, sat.i, sat.OMG, sat.omg, sat.f,
                    sat.X, sat.Y, sat.Z, sat.Vx, sat.Vy, sat.Vz
                ]);
            }

            csvPlaybackState.lastFrameTime = performance.now();
            csvPlaybackState.accumulator = 0;
            csvPlaybackState.pausedSimulatedTime = 0;
            DBG.log(`  -> 重置状态: accumulator=0`);
        } else {
            // 暂停恢复或速度切换：保持 accumulator
            DBG.log(`  -> 保持状态: accumulator=${csvPlaybackState.accumulator.toFixed(2)}ms, intervalMs=${csvPlaybackState.intervalMs}ms`);
            DBG.log(`  wasPaused=${csvPlaybackState.wasPaused}, pausedSimulatedTime=${csvPlaybackState.pausedSimulatedTime.toFixed(0)}`);
            DBG.log(`  当前 startTime=${earthRotationState.startTime}, startJD=${earthRotationState.startJD}, speedFactor=${earthRotationState.speedFactor.toFixed(1)}`);

            const now = performance.now();
            const currentSpeedFactor = earthRotationState.speedFactor;

            if (csvPlaybackState.wasPaused) {
                // 关键：恢复 startJD（否则 earth-rotation.js 不会更新）
                if (csvPlaybackState.pausedStartJD !== null) {
                    earthRotationState.startJD = csvPlaybackState.pausedStartJD;
                    DBG.log(`  -> 恢复 pausedStartJD=${earthRotationState.startJD.toFixed(4)}`);
                }

                if (csvPlaybackState.pausedSimulatedTime > 0 && currentSpeedFactor > 0) {
                    earthRotationState.startTime = now - csvPlaybackState.pausedSimulatedTime / currentSpeedFactor;
                    DBG.log(`  -> 暂停恢复成功: startTime=${earthRotationState.startTime.toFixed(0)}, startJD=${earthRotationState.startJD}`);
                } else {
                    // 备用方案：pausedSimulatedTime=0，重置 startTime
                    earthRotationState.startTime = now;
                    csvPlaybackState.pausedSimulatedTime = 0;
                    DBG.log(`  -> 暂停恢复: pausedSimulatedTime=0，重置 startTime`);
                }

                // 清除暂停标记
                csvPlaybackState.wasPaused = false;
            }
        }

        // 更新模块级播放状态
        csvPlaybackState.intervalMs = intervalMs;
        csvPlaybackState.loopRunning = true;

        if (!resetState) {
            // 速度切换/暂停恢复时：重置lastFrameTime避免巨大的delta
            csvPlaybackState.lastFrameTime = performance.now();
        }

        let lastFrameTime = csvPlaybackState.lastFrameTime;
        let accumulator = csvPlaybackState.accumulator;

        function playbackLoop(now) {
            csvPlaybackState.loopRunning = true;
            if (!csvState.isPlaying) return;

            const delta = now - lastFrameTime;
            lastFrameTime = now;
            accumulator += delta;

            // 关键修复：限制 accumulator 最大值，防止浏览器标签页后台运行后返回时一次性处理大量帧导致卡顿
            const maxAccumulator = intervalMs * 10; // 最大10帧
            if (accumulator > maxAccumulator) {
                accumulator = maxAccumulator;
            }

            while (accumulator >= intervalMs) {
                accumulator -= intervalMs;
                if (csvState.currentTimeIdx >= csvState.endIdx) {
                    csvState.currentTimeIdx = csvState.startIdx;
                    // 关键修复：时间索引回绕时，重置地球自转参数到初始时间
                    const firstGroup = data[csvState.startIdx];
                    if (firstGroup) {
                        const d = parseTimestamp(firstGroup.timestamp);
                        earthRotationState.startJD = dateToJD(d.year, d.month, d.day, d.hour, d.minute, d.second);
                        earthRotationState.startTime = performance.now();
                        DBG.log(`CSV 时间回绕: 重置 startJD=${earthRotationState.startJD.toFixed(4)}`);
                    }
                } else {
                    csvState.currentTimeIdx++;
                }

                const currentGroup = data[csvState.currentTimeIdx];
                if (currentGroup) {
                    interpState.prevFrameData = interpState.currFrameData;
                    interpState.currFrameData = currentGroup.sats.map(sat => [
                        currentGroup.timestamp, sat.sat_id, sat.a, sat.e, sat.i, sat.OMG, sat.omg, sat.f,
                        sat.X, sat.Y, sat.Z, sat.Vx, sat.Vy, sat.Vz
                    ]);
                }

                const timeSlider = document.getElementById('timeSlider');
                if (timeSlider) timeSlider.value = csvState.currentTimeIdx;
                const bar = document.getElementById('time-bar');
                if (bar) bar.style.width = (times.length > 1 ? (csvState.currentTimeIdx / (times.length - 1)) * 100 : 0) + '%';
            }

            // 保存状态以便速度切换时保持
            csvPlaybackState.lastFrameTime = lastFrameTime;
            csvPlaybackState.accumulator = accumulator;

            const progress = accumulator / intervalMs;
            const interpData = interpolateSatellites(
                interpState.prevFrameData,
                interpState.currFrameData,
                progress
            );
            interpState.currentInterpData = interpData;
            interpState.currentProgress = progress; // 保存进度供月球插值使用

            const currentView = appState.currentView;
            if (currentView === 'third') {
                updateSatellitesThirdPersonInterp(interpData, appState.sceneObjects, appState.interaction, appState);
            } else if (currentView === 'first') {
                updateSatellitesFirstPersonInterp(interpData, appState);
            } else {
                updateSatellitesCenterPersonInterp(interpData, appState, camera, cameraPanOffset, modules.updateCenterPersonCamera);
            }

            csvState.playbackAnimId = requestAnimationFrame(playbackLoop);
        }

        csvState.playbackAnimId = requestAnimationFrame(playbackLoop);
    }

    /**
     * 停止 CSV 播放
     */
    function stopCsvPlayback() {
        DBG.log(`CSV 停止: currentTimeIdx=${csvState.currentTimeIdx}, accumulator=${csvPlaybackState.accumulator.toFixed(2)}ms`);
        csvState.isPlaying = false;
        csvPlaybackState.wasPaused = true;
        if (csvState.playbackAnimId) {
            cancelAnimationFrame(csvState.playbackAnimId);
            csvState.playbackAnimId = null;
        }
        csvPlaybackState.loopRunning = false;
    }

    /**
     * 跳转到指定时间索引
     */
    function seekToIndex(newIdx) {
        // WS 模式下不支持时间轴拖动（实时数据无历史）
        if (appState.currentMode === 'ws') {
            DBG.warn('WS 模式下不支持时间轴拖动');
            return;
        }

        const data = appState.csv.satelliteData;
        if (!data || !data[newIdx]) return;

        csvState.currentTimeIdx = newIdx;

        const groupData = data[newIdx];
        
        // 关键修复：暂停状态下拖动时间轴时，prevFrameData = currFrameData
        // 否则恢复播放时 prevFrameData 是旧位置（如100），currFrameData 是新位置（如498）
        // interpolate(data[100], data[498], progress) 会导致卫星跳跃
        if (csvState.isPlaying) {
            // 播放中：prevFrameData 保持旧 currFrameData，插值连续
            interpState.prevFrameData = interpState.currFrameData;
        } else {
            // 暂停中：prevFrameData = currFrameData，恢复播放时不跳跃
            interpState.prevFrameData = null;
        }
        
        interpState.currFrameData = groupData.sats.map(sat => [
            groupData.timestamp, sat.sat_id, sat.a, sat.e, sat.i, sat.OMG, sat.omg, sat.f,
            sat.X, sat.Y, sat.Z, sat.Vx, sat.Vy, sat.Vz
        ]);
        
        // 暂停状态下，prevFrameData 应该等于 currFrameData
        if (!csvState.isPlaying) {
            interpState.prevFrameData = interpState.currFrameData;
        }

        // 重置累加器
        csvPlaybackState.accumulator = 0;

        // 设置基准时间为新时间戳
        const times = appState.csv.timeIndices;
        let frameIntervalSec = 60;
        if (times.length >= 2) {
            const d1 = parseTimestamp(times[0]);
            const d2 = parseTimestamp(times[1]);
            frameIntervalSec = Math.abs((dateToJD(d2.year, d2.month, d2.day, d2.hour, d2.minute, d2.second) -
                                          dateToJD(d1.year, d1.month, d1.day, d1.hour, d1.minute, d1.second)) * 86400);
        }
        const speedEl = document.getElementById('speed');
        const intervalMs = speedEl ? parseInt(speedEl.value, 10) : 1000 / 30;
        const framesPerSec = 1000 / intervalMs;
        earthRotationState.speedFactor = framesPerSec * frameIntervalSec;

        const d = parseTimestamp(groupData.timestamp);
        const newStartJD = dateToJD(d.year, d.month, d.day, d.hour, d.minute, d.second);

        // 关键修复：根据播放状态决定是否设置 startTime
        if (csvState.isPlaying) {
            // 播放状态：设置 startTime 让地球继续自转
            earthRotationState.startJD = newStartJD;
            earthRotationState.startTime = performance.now();
            csvPlaybackState.pausedSimulatedTime = 0;
            csvPlaybackState.pausedStartJD = newStartJD;
        } else {
            // 停止状态：不设置 startTime，直接手动设置地球旋转到正确位置
            earthRotationState.startJD = null;
            earthRotationState.startTime = null;
            // 直接更新地球旋转到当前时间戳对应的GMST
            const gmst = calcGMST(newStartJD);
            const { sceneObjects, interaction } = appState;
            if (sceneObjects.earth && sceneObjects.earth.parent) {
                sceneObjects.earth.rotation.y = gmst;
            }
            if (sceneObjects.earthRef && sceneObjects.earthRef.parent) {
                sceneObjects.earthRef.rotation.y = gmst;
            }
            if (sceneObjects.groundStationMarker3D && sceneObjects.earth && sceneObjects.earth.parent) {
                const gsPos = latLonToSurface3D(interaction.currentLat, interaction.currentLon);
                gsPos.applyAxisAngle(new THREE.Vector3(0, 1, 0), gmst);
                sceneObjects.groundStationMarker3D.position.copy(gsPos);
            }
            
            // 关键修复：暂停状态下拖动时间轴，更新 pausedStartJD
            // 否则点击播放时地球会跳变回暂停时刻的状态
            csvPlaybackState.pausedStartJD = newStartJD;
            csvPlaybackState.pausedSimulatedTime = 0;
            DBG.log(`seekToIndex(停止): 更新 pausedStartJD=${newStartJD.toFixed(4)}`);
        }

        csvPlaybackState.lastFrameTime = performance.now();

        // 注意：不清除 wasPaused，保持暂停状态
        // 这样点击播放时会走 startCsvPlayback(false) 分支，不会重置累积器

        DBG.log(`seekToIndex: 帧 ${newIdx} [${formatTimestamp(groupData.timestamp)}], speedFactor=${earthRotationState.speedFactor.toFixed(1)}`);

        // 更新滑块和时间条
        const slider = document.getElementById('timeSlider');
        if (slider) slider.value = newIdx;
        const bar = document.getElementById('time-bar');
        if (bar) bar.style.width = (appState.csv.timeIndices.length > 1 ? (newIdx / (appState.csv.timeIndices.length - 1)) * 100 : 0) + '%';

        // 同步更新时间显示
        const timeDisplay = document.getElementById('timeDisplay');
        if (timeDisplay) {
            timeDisplay.textContent = formatTimestamp(groupData.timestamp);
        }

        // 关键修复：更新卫星位置（即使播放已停止）
        const currentView = appState.currentView;
        if (interpState.currFrameData) {
            const interpData = interpolateSatellites(
                interpState.prevFrameData,
                interpState.currFrameData,
                0 // 使用当前帧数据（progress=0）
            );
            interpState.currentInterpData = interpData;

            if (currentView === 'third') {
                updateSatellitesThirdPersonInterp(interpData, appState.sceneObjects, appState.interaction, appState);
            } else if (currentView === 'first') {
                updateSatellitesFirstPersonInterp(interpData, appState);
            } else {
                updateSatellitesCenterPersonInterp(interpData, appState, camera, cameraPanOffset, modules.updateCenterPersonCamera);
            }
        }

        DBG.log(`跳转到帧 ${newIdx} [${formatTimestamp(groupData.timestamp)}]`);
    }

    /**
     * 启动 WS 播放
     */
    function runWsPlayback() {
        if (wsState.playbackActive) return;
        wsState.playbackActive = true;
        DBG.log('WS 播放启动');

        interpState.prevFrameData = null;
        interpState.currFrameData = null;
        interpState.currentInterpData = null;
        earthRotationState.speedFactor = 1;

        // 关键修复：在播放启动时设置一次地球自转参数，而不是在循环中重复设置
        // 防止在播放过程中如果 startTime 被清空(如视角切换)导致基准时间不断重置
        if (wsState.dataQueue.length > 0) {
            earthRotationState.startTime = performance.now();
            const d = parseTimestamp(wsState.dataQueue[0][0][0]);
            earthRotationState.startJD = dateToJD(d.year, d.month, d.day, d.hour, d.minute, d.second);
            DBG.log(`WS 地球自转参数初始化: startJD=${earthRotationState.startJD.toFixed(4)}`);
            
            // 新增：立即使用队列中的首帧更新视图，避免等待第一帧时的空白期
            // 立即使用队列中的首帧更新视图，避免等待第一帧时的空白期
            const firstFrame = wsState.dataQueue[0];
            if (firstFrame) {
                if (appState.currentView === 'third') {
                    updateSatellitesThirdPersonWs(firstFrame, appState.sceneObjects, appState.interaction);
                } else if (appState.currentView === 'first') {
                    updateSatellitesFirstPersonWs(firstFrame, appState);
                } else if (appState.currentView === 'center') {
                    updateSatellitesCenterPersonWs(firstFrame, appState, camera, cameraPanOffset);
                }
            }
        }

        // 请求-响应模式：前端驱动，按需请求数据
        // 启动时已收到10帧，队列≤5帧时请求30帧
        const REQUEST_THRESHOLD = 5;   // 触发阈值：5帧
        const REQUEST_COUNT = 30;        // 请求数量：30帧
        const BASE_INTERVAL = 1000;    // 基础间隔：1.0秒（1fps播放）
        
        // 请求后端数据
        function requestMoreData() {
            if (wsState.connection && wsState.connection.readyState === WebSocket.OPEN) {
                const requestMsg = JSON.stringify({
                    type: 'request_data',
                    request_count: REQUEST_COUNT
                });
                wsState.connection.send(requestMsg);
                DBG.log(`[WS] 队列剩余${wsState.dataQueue.length}帧≤${REQUEST_THRESHOLD}，请求${REQUEST_COUNT}帧`);
            }
        }
        
        // 使用递归 setTimeout，固定1秒间隔播放
        // 关键修复：添加调试日志，监控实际播放速度
        let lastDebugTime = performance.now();
        let frameCount = 0;
        
        function scheduleNextFrame() {
            if (!wsState.playbackActive) return;
            
            // 调试：监控实际播放速度
            frameCount++;
            const now = performance.now();
            const elapsed = now - lastDebugTime;
            if (elapsed >= 10000) {  // 每10秒打印一次统计
                const actualFps = (frameCount / elapsed * 1000).toFixed(2);
                DBG.log(`[WS-DEBUG] 过去10秒: ${frameCount}帧, 实际FPS: ${actualFps}, 预期FPS: 1.00`);
                frameCount = 0;
                lastDebugTime = now;
            }
            
            // 帧消费逻辑
            if (wsState.dataQueue.length > 0) {
                const stepData = wsState.dataQueue.shift();
                
                // 关键诊断：记录帧切换信息
                if (interpState.currFrameData && stepData) {
                    const prevTime = interpState.currFrameData[0]?.[0] || '?';
                    const currTime = stepData[0]?.[0] || '?';
                    DBG.log(`帧切换: ${prevTime} → ${currTime} (队列${wsState.dataQueue.length}帧)`);
                }
                
                interpState.prevFrameData = interpState.currFrameData;
                interpState.currFrameData = stepData;
                wsState.lastStepData = stepData;
                
                // 记录当前播放帧的时间戳（用于灯光计划）
                if (stepData && stepData.length > 0 && stepData[0].length > 0) {
                    wsState.currentPlaybackTimestamp = stepData[0][0];
                }
                
                // 前端自主执行灯光计划
                if (appState.lightScheduleManager && stepData && stepData.length > 0) {
                    const timestamp = stepData[0][0];
                    if (timestamp && timestamp.length === 14) {
                        appState.lightScheduleManager.checkAndExecute(timestamp);
                    }
                }
                
                // 关键修复：帧切换时重置渲染累积器，开始新的插值周期
                wsState.renderAccumulator = 0;
                wsState.renderLastTime = performance.now();
                
                if (stepData?.length > 0) {
                    const timeDisplay = document.getElementById('timeDisplay');
                    if (timeDisplay) timeDisplay.textContent = formatTimestamp(stepData[0][0]);
                }
                
                // 队列恢复时清除警告标记
                if (wsState._queueEmptyWarned) {
                    DBG.log('WS 数据队列恢复，继续播放');
                    wsState._queueEmptyWarned = false;
                }
                
                // 关键：队列≤5帧时，主动请求更多数据
                if (wsState.dataQueue.length <= REQUEST_THRESHOLD) {
                    requestMoreData();
                }
            } else {
                // 队列为空时，立即请求数据
                if (!wsState._queueEmptyWarned) {
                    DBG.warn('WS 数据队列空，立即请求数据...');
                    wsState._queueEmptyWarned = true;
                }
                requestMoreData();
            }
            
            // 调度下一帧（固定1秒间隔）
            wsState.playbackTimer = setTimeout(scheduleNextFrame, BASE_INTERVAL);
        }
        
        // 启动播放循环（启动时已收到10帧，先播放）
        scheduleNextFrame();
        
        // 动画循环用于插值渲染，基于时间动态计算进度（与CSV模式一致）
        // 初始化渲染时间追踪变量到 wsState，便于帧切换时重置
        wsState.renderLastTime = performance.now();
        wsState.renderAccumulator = 0;
        const RENDER_INTERVAL = 1000; // 1秒1帧，与播放速率一致
        
        function renderLoop(now) {
            if (!wsState.playbackActive) return;
            
            // 计算时间差和累积（使用 wsState 上的变量）
            const delta = now - wsState.renderLastTime;
            wsState.renderLastTime = now;
            wsState.renderAccumulator += delta;
            
            // 限制最大值，防止后台切换回来后的突变
            if (wsState.renderAccumulator > RENDER_INTERVAL * 2) {
                wsState.renderAccumulator = RENDER_INTERVAL * 2;
            }
            
            // 计算动态进度 (0-1)
            const progress = Math.min(wsState.renderAccumulator / RENDER_INTERVAL, 1.0);

            if (interpState.currFrameData) {
                const interpData = interpolateSatellites(
                    interpState.prevFrameData,
                    interpState.currFrameData,
                    progress  // 动态进度，实现平滑插值
                );
                interpState.currentInterpData = interpData;
                interpState.currentProgress = progress;

                const currentView = appState.currentView;
                if (currentView === 'third') {
                    updateSatellitesThirdPersonInterp(interpData, appState.sceneObjects, appState.interaction, appState);
                } else if (currentView === 'first') {
                    updateSatellitesFirstPersonInterp(interpData, appState);
                } else {
                    updateSatellitesCenterPersonInterp(interpData, appState, camera, cameraPanOffset, modules.updateCenterPersonCamera);
                }
            }

            wsState.playbackAnimId = requestAnimationFrame(renderLoop);
        }

        wsState.playbackAnimId = requestAnimationFrame(renderLoop);
    }

    /**
     * 停止 WS 播放
     */
    function stopWsPlayback() {
        DBG.log('WS 停止');
        wsState.playbackActive = false;
        // 关键修复：清除 requestAnimationFrame 动画循环
        if (wsState.playbackAnimId) {
            cancelAnimationFrame(wsState.playbackAnimId);
            wsState.playbackAnimId = null;
        }
        // 关键修复：清除 setTimeout 定时器（自适应间隔模式）
        if (wsState.playbackTimer) {
            clearTimeout(wsState.playbackTimer);
            wsState.playbackTimer = null;
        }
        // 重置自适应间隔参数
        wsState.currentInterval = 1000;
        wsState.highQueueDuration = 0;
        // 关键修复：重置未统计帧计数器
        wsState._framesReceivedSinceLastCheck = 0;
        // 关键修复：重置渲染累积器
        wsState.renderAccumulator = 0;
        wsState.renderLastTime = performance.now();
    }

    /**
     * 暂停 WS 推送（不断开连接）
     */
    function pauseWs() {
        if (wsState.connection && wsState.connection.readyState === WebSocket.OPEN) {
            sendWsCmd(wsState.connection, 'pause');
            DBG.log('WS 暂停推送（保持连接）');
        }
    }

    /**
     * 恢复 WS 推送（复用已有连接）
     */
    function resumeWs() {
        if (wsState.connection && wsState.connection.readyState === WebSocket.OPEN) {
            sendWsCmd(wsState.connection, 'resume');
            wsState.connectionState = 'playing';
            // 关键修复：保留现有队列，不清空，实现无缝恢复
            // wsState.dataQueue = [];  // 删除：恢复时不清空队列，继续播放已有数据
            wsState.lastStepData = null;
            wsState.autoPlayOnConnect = false;
            // 关键修复：先重置为 false，让 runWsPlayback 能正常启动
            wsState.playbackActive = false;
            // updateWsSts(wsState);
            runWsPlayback();
            DBG.log('WS 恢复推送（复用连接），保留队列 ' + wsState.dataQueue.length + ' 帧');
        }
    }

    /**
     * 设置页面可见性处理器（后台暂停/前台恢复）
     */
    function setupVisibilityHandler() {
        // 避免重复添加监听
        if (wsState._visibilityHandlerSetup) {
            return;
        }
        wsState._visibilityHandlerSetup = true;
        
        // 后台暂停延迟计时器（10秒）
        let backgroundPauseTimer = null;
        const BACKGROUND_PAUSE_DELAY = 10000; // 10秒
        
        document.addEventListener('visibilitychange', () => {
            if (!wsState.connection || wsState.connection.readyState !== WebSocket.OPEN) {
                return;
            }
            
            if (document.hidden) {
                // 页面进入后台：启动10秒倒计时
                console.log('[WS] 页面进入后台，启动10秒暂停倒计时');
                backgroundPauseTimer = setTimeout(() => {
                    console.log('[WS] 后台10秒倒计时结束，发送暂停命令');
                    sendWsCmd(wsState.connection, 'pause');
                    DBG.log('[WS] 已发送暂停命令（后台10秒后）');
                }, BACKGROUND_PAUSE_DELAY);
            } else {
                // 页面回到前台：取消倒计时（如果还在倒计时中）
                if (backgroundPauseTimer) {
                    clearTimeout(backgroundPauseTimer);
                    backgroundPauseTimer = null;
                    console.log('[WS] 回到前台，取消暂停倒计时');
                }
                // 立即恢复播放
                console.log('[WS] 页面回到前台，恢复播放');
                sendWsCmd(wsState.connection, 'resume');
                DBG.log('[WS] 已发送恢复命令（前台）');
            }
        });
        
        console.log('[WS] 页面可见性处理器已设置（10秒延迟暂停）');
    }

    /**
     * 连接 WebSocket
     */
    function connectWebSocket(autoPlay = false, onConnected, onDisconnected) {
        console.log('[WS] 开始连接, autoPlay=', autoPlay);

        // 关键修复：页面刷新时强制清理旧连接，防止连接状态异常
        if (wsState.connection) {
            const readyState = wsState.connection.readyState;
            console.log('[WS] 发现旧连接, readyState=', readyState);
            // 0=CONNECTING, 1=OPEN, 2=CLOSING, 3=CLOSED
            if (readyState === WebSocket.CONNECTING || readyState === WebSocket.OPEN) {
                wsState.connection.onclose = null; // 防止触发onclose回调
                wsState.connection.close();
                console.log('[WS] 已关闭旧连接');
            }
            wsState.connection = null;
        }

        wsState.dataQueue = [];
        wsState.playbackActive = false;
        wsState.lastStepData = null;
        wsState.autoPlayOnConnect = autoPlay;
        wsState.connectionState = 'connecting';
        updateWsSts(wsState);

        // 新增：重试机制
        const maxRetries = 5;
        const retryDelay = 2000; // 2秒
        let retryCount = 0;

        function attemptConnection() {
            console.log(`[WS] 创建新 WebSocket 连接 (尝试 ${retryCount + 1}/${maxRetries})`);
            const clientId = 'web_' + Date.now() + '_' + Math.floor(Math.random() * 1000000);
            const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${wsProtocol}//${window.location.host}/ws/${clientId}`;
            wsState.connection = new WebSocket(wsUrl);

            wsState.connection.onopen = () => {
                console.log('[WS] 连接已打开');
                wsState.connectionState = 'buffering';
                updateWsSts(wsState);
                onConnected?.();
                
                // 关键修复：添加 Page Visibility API 监听，后台时暂停播放
                setupVisibilityHandler();
            };

            wsState.connection.onerror = (error) => {
                console.error(`[WS] 连接错误 (尝试 ${retryCount + 1}/${maxRetries})`);
            };

            wsState.connection.onclose = () => {
                console.log(`[WS] 连接关闭 (尝试 ${retryCount + 1}/${maxRetries})`);
                
                // 关键修复：重置所有状态（无论是否重连）
                console.log('[WS] 重置状态: dataQueue, renderAccumulator, interpState...');
                wsState.dataQueue = [];
                wsState.renderAccumulator = 0;
                wsState.renderLastTime = performance.now();
                wsState.lastStepData = null;
                wsState._queueEmptyWarned = false;
                wsState._visibilityHandlerSetup = false;  // 清理可见性处理器标志
                
                // 重置插值状态
                const interpState = appState.interpolation;
                interpState.prevFrameData = null;
                interpState.currFrameData = null;
                interpState.currentInterpData = null;
                interpState.currentProgress = 0;
                
                // 如果当前不在 WS 模式，不尝试重连
                if (appState.currentMode !== 'ws') {
                    console.log('[WS] 当前非 WS 模式，不重连');
                    wsState.connectionState = 'disconnected';
                    updateWsSts(wsState);
                    onDisconnected?.();
                    return;
                }
                
                // 如果未达到最大重试次数，则重试
                if (retryCount < maxRetries) {
                    retryCount++;
                    console.log(`[WS] ${retryDelay}ms 后重试... (${retryCount}/${maxRetries})`);
                    wsState.connectionState = 'connecting';
                    updateWsSts(wsState);
                    setTimeout(attemptConnection, retryDelay);
                } else {
                    console.error('[WS] 已达到最大重试次数，连接失败');
                    wsState.connectionState = 'disconnected';
                    updateWsSts(wsState);
                    onDisconnected?.();
                }
            };

            wsState.connection.onmessage = (event) => {
                let msg;
                try { msg = JSON.parse(event.data); } catch (e) { DBG.error('解析失败:', e); return; }

                // 处理协议响应（灯光控制）
                if (msg.type === 'protocol_response') {
                    if (msg.cmd === 'light_control_ok' && appState.constellationPanel) {
                        appState.constellationPanel.handleLightResponse(msg.data);
                    } else if (msg.cmd === 'light_control_error') {
                        DBG.error('[CONSTELLATION] 灯光控制失败:', msg.data);
                    }
                    return;
                }

                if (msg.type === 'data' && Array.isArray(msg.data) && msg.data.length > 0) {
                    const isValid = msg.data.every(d => Array.isArray(d) && d.length >= 14);
                    if (!isValid) { DBG.warn('格式错误'); return; }

                    // 保存当前仿真步和时间戳（用于灯光计划的时间参考）
                    if (msg.current_step !== undefined) {
                        wsState.currentStep = msg.current_step;
                    }
                    if (msg.current_timestamp) {
                        wsState.currentTimestamp = msg.current_timestamp;
                    }

                    // 关键修复：记录数据到达信息
                    if (msg.is_first) {
                        DBG.log(`收到首帧数据: ${msg.data.length} 帧, 队列总数: ${wsState.dataQueue.length + msg.data.length}`);
                    }

                    // 请求-响应模式：直接入队，无需复杂计数
                    for (let i = 0; i < msg.data.length; i++) wsState.dataQueue.push(msg.data[i]);
                    while (wsState.dataQueue.length > WS_MAX_QUEUE_SIZE) wsState.dataQueue.shift();

                    // 初始化灯光管理器（必须在同步灯光状态之前）
                    if (msg.is_first && appState.lightManager && msg.data.length > 0) {
                        const satCount = msg.data[0].length; // 每帧的卫星数
                        appState.lightManager.init(satCount);
                        appState.config.satCount = satCount;  // 更新配置中的卫星数
                        DBG.log(`[LIGHT] WS 模式已初始化 ${satCount} 颗卫星的灯光状态`);
                        
                        // 更新总卫星数显示
                        const totalSatCountEl = document.getElementById('totalSatCount');
                        if (totalSatCountEl) totalSatCountEl.textContent = satCount;
                    }

                    // 同步灯光状态（在 init 之后）
                    if (msg.light_states && appState.lightManager) {
                        Object.entries(msg.light_states).forEach(([satId, isOn]) => {
                            appState.lightManager.setLight(parseInt(satId), isOn);
                        });
                    }

                    // 请求-响应模式：收到数据即恢复播放
                    if (wsState._queueEmptyWarned) {
                        DBG.log('WS 数据队列恢复，继续播放');
                        wsState._queueEmptyWarned = false;
                    }

                    // 请求-响应模式：首次连接时启动播放
                    if (msg.is_first && !wsState.playbackActive) {
                        wsState.connectionState = 'playing';
                        wsState.autoPlayOnConnect = false;
                        DBG.log(`[WS] 收到首帧${msg.data.length}帧，启动播放循环`);
                        runWsPlayback();
                    }
                    // 移除：不要重复调用runWsPlayback，播放循环已经在运行
                    // if (wsState.playbackActive && !wsState.playbackTimer) runWsPlayback();
                    updateWsSts(wsState);
                } else if (msg.type === 'command' && msg.cmd === 'paused') {
                    // 处理后端发送的暂停命令
                    // 关键修复：WS 模式下收到 paused 是过期 ACK（竞态条件），忽略
                    if (appState.currentMode === 'ws') {
                        DBG.warn('收到过期的暂停确认，忽略（当前已在 WS 模式）');
                    } else {
                        DBG.warn('后端已暂停播放');
                        wsState.connectionState = 'paused';
                        updateWsSts(wsState);
                    }
                } else if (msg.type === 'command' && msg.cmd === 'buffering') {
                    // 处理后端发送的计算中命令
                    DBG.warn('后端正在计算数据...');
                    wsState.connectionState = 'buffering';
                    updateWsSts(wsState);
                }
            };
        }

        // 开始首次连接尝试
        attemptConnection();
    }

    /**
     * 统一播放控制
     */
    function startPlay() {
        DBG.log(`startPlay: 模式=${appState.currentMode}, wasPaused=${csvPlaybackState.wasPaused}, isPlaying=${csvState.isPlaying}`);

        if (wsState.connection?.readyState === WebSocket.OPEN && wsState.playbackActive) return;

        if (wsState.connection?.readyState === WebSocket.CONNECTING) {
            wsState.autoPlayOnConnect = true;
            return;
        }

        if (appState.currentMode === 'ws') {
            if (wsState.connection?.readyState === WebSocket.OPEN) {
                sendWsCmd(wsState.connection, 'resume');
                wsState.connectionState = 'playing';
                runWsPlayback();
                updateWsSts(wsState);
                return;
            }
            wsState.dataQueue = [];
            wsState.playbackActive = false;
            wsState.connection = null;
            wsState.autoPlayOnConnect = true;
            connectWebSocket(true, null, null);
            return;
        }

        // CSV 模式：检查是否从暂停恢复
        if (csvPlaybackState.wasPaused) {
            DBG.log('  → 从暂停恢复（resetState=false）');
            DBG.log(`  当前: currentTimeIdx=${csvState.currentTimeIdx}, accumulator=${csvPlaybackState.accumulator.toFixed(2)}ms`);
            DBG.log(`  prevFrameData=${interpState.prevFrameData ? '有' : '无'}, currFrameData=${interpState.currFrameData ? '有' : '无'}`);
            startCsvPlayback(false);
        } else {
            DBG.log('  → 全新播放（resetState=true）');
            startCsvPlayback(true);
        }
    }

    /**
     * 统一停止控制（暂停）
     */
    function stopPlay() {
        DBG.log('停止/暂停播放');
        // 记录暂停时刻的模拟时间，用于恢复时计算新的 startTime
        if (earthRotationState.startTime !== null && csvState.isPlaying) {
            csvPlaybackState.pausedSimulatedTime = (performance.now() - earthRotationState.startTime) * earthRotationState.speedFactor;
            // 保存 startJD 以便恢复时使用
            csvPlaybackState.pausedStartJD = earthRotationState.startJD;
        }
        csvPlaybackState.wasPaused = true;
        stopWsPlayback();
        if (csvState.isPlaying) stopCsvPlayback();

        earthRotationState.startTime = null;
        earthRotationState.startJD = null;
        earthRotationState.speedFactor = 1;

        const slider = document.getElementById('timeSlider');
        if (slider && appState.currentMode === 'csv') slider.value = csvState.currentTimeIdx;
        const btn = document.getElementById('playBtn');
        if (btn) btn.innerHTML = '<span class="play-icon">▶</span>';

        if (appState.currentMode === 'ws' && wsState.connection?.readyState === WebSocket.OPEN) {
            sendWsCmd(wsState.connection, 'pause');
            wsState.connectionState = 'paused';
            updateWsSts(wsState);
        }
    }

    /**
     * 速度切换
     */
    function changeSpeed() {
        DBG.log(`changeSpeed: wasPaused=${csvPlaybackState.wasPaused}, isPlaying=${csvState.isPlaying}`);
        if (appState.currentMode === 'ws') return;
        if (!csvState.isPlaying) {
            DBG.log('changeSpeed: 当前未播放，忽略');
            return;
        }
        const speedEl = document.getElementById('speed');
        const newIntervalMs = speedEl ? parseInt(speedEl.value, 10) : 200;
        const oldIntervalMs = csvPlaybackState.intervalMs;

        DBG.log(`changeSpeed: ${oldIntervalMs}ms → ${newIntervalMs}ms`);
        DBG.log(`  切换前: currentTimeIdx=${csvState.currentTimeIdx}, accumulator=${csvPlaybackState.accumulator.toFixed(2)}ms, progress=${(csvPlaybackState.accumulator / oldIntervalMs * 100).toFixed(1)}%`);
        DBG.log(`  切换前帧数据: prev=${interpState.prevFrameData ? interpState.prevFrameData[0][0] : '无'}, curr=${interpState.currFrameData ? interpState.currFrameData[0][0] : '无'}`);
        if (interpState.currFrameData) {
            DBG.log(`  切换前curr帧首星: sat_id=${interpState.currFrameData[0][1]}, X=${interpState.currFrameData[0][8].toFixed(2)}, Y=${interpState.currFrameData[0][9].toFixed(2)}, Z=${interpState.currFrameData[0][10].toFixed(2)}`);
        }

        // 保存当前插值进度（0~1之间）
        const currentProgress = csvPlaybackState.accumulator / oldIntervalMs;

        if (csvState.playbackAnimId) cancelAnimationFrame(csvState.playbackAnimId);

        // 更新速度因子
        const data = appState.csv.satelliteData;
        const times = appState.csv.timeIndices;
        let frameIntervalSec = 60;
        if (times.length >= 2) {
            const d1 = parseTimestamp(times[0]);
            const d2 = parseTimestamp(times[1]);
            frameIntervalSec = Math.abs((dateToJD(d2.year, d2.month, d2.day, d2.hour, d2.minute, d2.second) -
                                          dateToJD(d1.year, d1.month, d1.day, d1.hour, d1.minute, d1.second)) * 86400);
        }
        const framesPerSec = 1000 / newIntervalMs;
        const newSpeedFactor = framesPerSec * frameIntervalSec;
        const oldSpeedFactor = earthRotationState.speedFactor;

        // 关键修复：调整 startTime 以保持地球旋转连续
        // 切换前模拟时间: (now - startTime) * oldSpeedFactor
        // 切换后模拟时间: (now - newStartTime) * newSpeedFactor
        // 令两者相等: newStartTime = now - (now - startTime) * oldSpeedFactor / newSpeedFactor
        if (earthRotationState.startTime !== null && newSpeedFactor > 0) {
            const now = performance.now();
            const realElapsed = now - earthRotationState.startTime;
            earthRotationState.startTime = now - (realElapsed * oldSpeedFactor / newSpeedFactor);
        }
        earthRotationState.speedFactor = newSpeedFactor;

        DBG.log(`  speedFactor: ${oldSpeedFactor.toFixed(1)} → ${newSpeedFactor.toFixed(1)}, startTime 已调整保持旋转连续`);

        // 关键修复：按比例缩放累加器，使插值进度保持不变
        csvPlaybackState.accumulator = currentProgress * newIntervalMs;
        csvPlaybackState.intervalMs = newIntervalMs;
        csvPlaybackState.lastFrameTime = performance.now();

        DBG.log(`  切换后: accumulator=${csvPlaybackState.accumulator.toFixed(2)}ms, progress=${(currentProgress * 100).toFixed(1)}%`);
        DBG.log(`  切换后帧数据: prev=${interpState.prevFrameData ? interpState.prevFrameData[0][0] : '无'}, curr=${interpState.currFrameData ? interpState.currFrameData[0][0] : '无'}`);
        if (interpState.currFrameData) {
            DBG.log(`  切换后curr帧首星: sat_id=${interpState.currFrameData[0][1]}, X=${interpState.currFrameData[0][8].toFixed(2)}, Y=${interpState.currFrameData[0][9].toFixed(2)}, Z=${interpState.currFrameData[0][10].toFixed(2)}`);
        }

        csvState.playbackAnimId = requestAnimationFrame(function playbackLoop(now) {
            if (!csvState.isPlaying) {
                DBG.log('  playbackLoop 启动但 isPlaying=false，退出');
                return;
            }
            DBG.log('  playbackLoop 启动成功');

            csvPlaybackState.lastFrameTime = now;

            function loopInner(now) {
                if (!csvState.isPlaying) {
                    DBG.log('  loopInner: isPlaying=false，停止循环');
                    return;
                }

                const delta = now - csvPlaybackState.lastFrameTime;
                csvPlaybackState.lastFrameTime = now;
                csvPlaybackState.accumulator += delta;

                while (csvPlaybackState.accumulator >= newIntervalMs) {
                    csvPlaybackState.accumulator -= newIntervalMs;
                    if (csvState.currentTimeIdx >= csvState.endIdx) csvState.currentTimeIdx = csvState.startIdx;
                    else csvState.currentTimeIdx++;

                    const currentGroup = data[csvState.currentTimeIdx];
                    if (currentGroup) {
                        interpState.prevFrameData = interpState.currFrameData;
                        interpState.currFrameData = currentGroup.sats.map(sat => [
                            currentGroup.timestamp, sat.sat_id, sat.a, sat.e, sat.i, sat.OMG, sat.omg, sat.f,
                            sat.X, sat.Y, sat.Z, sat.Vx, sat.Vy, sat.Vz
                        ]);
                    }

                    const timeSlider = document.getElementById('timeSlider');
                    if (timeSlider) timeSlider.value = csvState.currentTimeIdx;
                    const bar = document.getElementById('time-bar');
                    if (bar) bar.style.width = (times.length > 1 ? (csvState.currentTimeIdx / (times.length - 1)) * 100 : 0) + '%';
                }

                const progress = csvPlaybackState.accumulator / newIntervalMs;
                const interpData = interpolateSatellites(
                    interpState.prevFrameData,
                    interpState.currFrameData,
                    progress
                );
                interpState.currentInterpData = interpData;
                interpState.currentProgress = progress;

                const currentView = appState.currentView;
                if (currentView === 'third') {
                    updateSatellitesThirdPersonInterp(interpData, appState.sceneObjects, appState.interaction, appState);
                } else if (currentView === 'first') {
                    updateSatellitesFirstPersonInterp(interpData, appState);
                } else {
                    updateSatellitesCenterPersonInterp(interpData, appState, camera, cameraPanOffset, modules.updateCenterPersonCamera);
                }

                csvState.playbackAnimId = requestAnimationFrame(loopInner);
            }

            loopInner(now);
        });
    }

    /**
     * 是否正在播放
     */
    function isPlaying() {
        return wsState.playbackActive || csvState.isPlaying;
    }

    return {
        startCsvPlayback,
        stopCsvPlayback,
        seekToIndex,
        runWsPlayback,
        stopWsPlayback,
        pauseWs,
        resumeWs,
        connectWebSocket,
        sendWsCommand: sendWsCmd,
        updateWsStatus: updateWsSts,
        startPlay,
        stopPlay,
        changeSpeed,
        isPlaying
    };
}

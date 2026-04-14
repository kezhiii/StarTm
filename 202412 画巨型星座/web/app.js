import * as THREE from 'three';
import { DEG, THIRD_PERSON_CAMERA_POS, THIRD_PERSON_CAMERA_TARGET } from './modules/config.js';
import { dateToJD, parseTimestamp } from './modules/math-utils.js';
import { createState } from './modules/state.js';
import { loadTextures } from './modules/texture-loader.js';
import { createAppContext } from './core/app-context.js';
import { updateEarthRotation as updateEarthRotationModule } from './modules/earth-rotation.js';
import { initLocationControls as initLocationControlsModule } from './modules/ui/location-controls.js';
import { initTooltip as initTooltipModule } from './modules/ui/tooltip-system.js';
import { initStatsPanel as initStatsPanelModule, updateStatsPanel as updateStatsPanelModule } from './modules/ui/stats-panel.js';
import { createConstellationPanel as createConstellationPanelModule } from './modules/ui/constellation-panel.js';
import { createStarField } from './modules/star-field.js';
import { initThirdPersonScene as initThirdPersonSceneMod, updateSatellitesThirdPerson as updateThirdMod, updateSatellitesThirdPersonWs as updateThirdWsMod, createOrbitRing } from './modules/views/third-person.js';
import { updateMoon } from './modules/moon-orbit.js';
import { initFirstPersonScene as initFirstPersonSceneMod, updateFirstPersonCamera as updateFirstPersonCameraMod, updateSatellitesFirstPerson as updateFirstPersonMod, updateSatellitesFirstPersonWs as updateFirstPersonWsMod, updateMoonFirstPerson as updateMoonFirstPersonMod } from './modules/views/first-person.js';
import { initCenterPersonScene as initCenterPersonSceneMod, updateSatellitesCenterPerson as updateCenterPersonMod, updateSatellitesCenterPersonWs as updateCenterPersonWsMod, updateCenterPersonCamera as updateCenterPersonCameraMod } from './modules/views/center-person.js';
import { clearSceneObjects, updateOrbitRings } from './core/scene-utils.js';
import { createTransitionManager } from './core/transition.js';
import { updateCurrentView as execUpdateCurrentView, updateCurrentViewWs as execUpdateCurrentViewWs } from './core/view-update.js';
import { createUiManager } from './managers/ui-manager.js';
import { createModeManager } from './managers/mode-manager.js';
import { createPlaybackManager } from './managers/playback-manager.js';
import { createInputManager } from './managers/input-manager.js';
import { createCsvManager } from './managers/csv-manager.js';
import { createLightManager } from './modules/light-manager.js';

// 创建全局状态
const appState = createState();
// 将相机和偏移量存入 state，供模块使用
appState.camera = null;
appState.cameraPanOffset = null;

// 应用上下文（封装 scene, camera, renderer, controls）
const appCtx = createAppContext();

// 场景对象引用（使用 appState 中的引用）
const sceneObjects = appState.sceneObjects;

// CSV 状态
const csvState = appState.csv.state;

// WS 状态
const wsState = appState.ws;

// 交互状态
const interactionState = appState.interaction;

// 相机偏移（主星视角）
const cameraPanOffset = appCtx.cameraPanOffset;

// 过渡动画管理器（使用 getter 延迟获取）
const transitionMgr = createTransitionManager(() => appCtx.controls, () => appCtx.camera, appState.cache);

// 插值相关
const interpState = appState.interpolation;

// 地球自转相关
const earthRotationState = appState.earthRotation;

// 灯光管理器（稍后初始化）
let lightManager = null;
// 卫星编队面板
let constellationPanel = null;

// ======================== 调试日志辅助 ========================
// 开发环境输出详细日志，生产环境仅保留警告和错误
const isDev = typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'development';
const DBG = {
    log: isDev ? (m, ...a) => console.log(`[${m}]`, ...a) : () => {},
    warn: (m, ...a) => console.warn(`[${m}]`, ...a),
    error: (m, ...a) => console.error(`[${m}]`, ...a)
};

// ======================== 渲染循环 ========================
function animate() {
    requestAnimationFrame(animate);

    // 视角切换动画期间禁用 OrbitControls
    if (appState.currentView === 'third' && !appState.cache.transitionAnimId) {
        appCtx.controls.update();
    }

    // 更新地球自转
    updateEarthRotationModule(appState, appState.sceneObjects);

    // 更新月球公转
    if (appState.currentView === 'first') {
        updateMoonFirstPersonMod(appState);
    } else {
        updateMoon(appState);
    }

    // 渲染场景
    appCtx.renderer.render(appCtx.scene, appCtx.camera);
}

// ======================== 基础场景 ========================
function initBaseScene() {
    DBG.log('SCENE', '初始化 Three.js 场景');
    const container = document.getElementById('canvasContainer');
    appCtx.initBaseScene(container, appState);
    
    // 添加星空背景
    createStarField(appCtx.scene, appState);
}

// ======================== 视角切换 ========================
function switchView(view) {
    if (view === appState.currentView) return;
    DBG.log('VIEW', `切换到: ${view}, 模式: ${appState.currentMode}, 当前帧索引: ${csvState.currentTimeIdx}`);

    // 0. 更新状态和 UI (最先执行，防止后续 return 跳过)
    appState.currentView = view;
    
    // 强制更新按钮高亮
    document.getElementById('thirdViewBtn').className = view === 'third' ? 'active' : '';
    document.getElementById('firstViewBtn').className = view === 'first' ? 'active' : '';
    document.getElementById('centerViewBtn').className = view === 'center' ? 'active' : '';
    document.getElementById('lockViewGroup').style.display = view === 'center' ? 'block' : 'none';

    // 1. 清理旧状态
    transitionMgr.cancel();
    interactionState.centerDragging = false;
    interactionState.fpDragging = false;
    cameraPanOffset.set(0, 0, 0);

    // 2. 清理场景对象
    clearSceneObjects(appCtx.scene, appCtx.camera, appState);

    // 3. 修复光照
    appCtx.scene.traverse(obj => {
        if (obj.isDirectionalLight) {
            const dist = (view === 'center') ? 10000 : 100;
            obj.position.set(dist, 50, dist);
        }
    });

    // 4. 数据索引校验 (防止越界导致不渲染)
    if (appState.currentMode === 'csv' && appState.csv.satelliteData && appState.csv.satelliteData.length > 0) {
        if (csvState.currentTimeIdx < 0 || csvState.currentTimeIdx >= appState.csv.satelliteData.length) {
            csvState.currentTimeIdx = 0;
        }
    }

    // 5. 初始化新场景并立即渲染当前帧
    if (view === 'third') {
        initThirdPersonSceneMod(appCtx.scene, appCtx.controls, appState);
        appCtx.controls.enabled = true;
        appCtx.controls.autoRotate = false;
        appCtx.camera.position.set(150, 75, 150);
        appCtx.controls.target.set(0, 0, 0);
        appCtx.camera.up.set(0, 1, 0);
        appCtx.controls.update();

        // CSV 模式下立即渲染当前帧
        if (appState.currentMode === 'csv') {
            updateThirdMod(csvState.currentTimeIdx, appState.csv.satelliteData, appState.sceneObjects, appState.interaction);
        }
    }
    else if (view === 'first') {
        initFirstPersonSceneMod(appCtx.scene, appCtx.controls, appCtx.camera, appState);
        appCtx.controls.enabled = false;

        // 设置相机初始朝向 - 如果有月球数据，自动朝向月球
        appCtx.camera.position.set(0, 0, 0);
        appCtx.camera.up.set(0, 1, 0);

        // CSV 模式下立即渲染当前帧
        if (appState.currentMode === 'csv' && appState.csv.satelliteData.length > 0) {
            // 确保时间索引有效
            if (csvState.currentTimeIdx < 0) csvState.currentTimeIdx = 0;
            if (csvState.currentTimeIdx >= appState.csv.satelliteData.length) {
                csvState.currentTimeIdx = appState.csv.satelliteData.length - 1;
            }

            // 渲染卫星位置
            updateFirstPersonMod(csvState.currentTimeIdx, appState);

            // 如果有可见的月球，自动朝向月球；否则使用默认朝向
            if (appState.moonECI && appState.sceneObjects.moon && appState.sceneObjects.moon.visible) {
                const moonPos = appState.sceneObjects.moon.position;
                const direction = new THREE.Vector3().copy(moonPos).normalize();
                appCtx.camera.lookAt(direction);
                appState.interaction.fpAzimuth = Math.atan2(direction.x, -direction.z);
                appState.interaction.fpElevation = Math.asin(direction.y);
            } else {
                appState.interaction.fpAzimuth = 0;
                appState.interaction.fpElevation = 45 * DEG;
                updateFirstPersonCameraMod(appCtx.camera, appState);
            }

            appCtx.camera.updateProjectionMatrix();
            appCtx.camera.updateMatrix();
            appCtx.camera.updateMatrixWorld(true);
            appCtx.renderer.render(appCtx.scene, appCtx.camera);
        } else {
            // WS 模式：初始化并检查月球可见性
            if (appState.ws.lastStepData) {
                const d = parseTimestamp(appState.ws.lastStepData[0][0]);
                appState.earthRotation.startJD = dateToJD(d.year, d.month, d.day, d.hour, d.minute, d.second);
                appState.earthRotation.startTime = performance.now();
                updateFirstPersonWsMod(appState.ws.lastStepData, appState);
            }

            if (appState.sceneObjects.moon && appState.sceneObjects.moon.visible) {
                const moonPos = appState.sceneObjects.moon.position;
                const dist = moonPos.length();
                const azR = Math.atan2(moonPos.x, -moonPos.z);
                const elR = Math.asin(moonPos.y / dist);

                appState.interaction.fpAzimuth = azR;
                appState.interaction.fpElevation = elR / DEG;
                updateFirstPersonCameraMod(appCtx.camera, appState);
            } else {
                appState.interaction.fpAzimuth = 0;
                appState.interaction.fpElevation = 45 * DEG;
                updateFirstPersonCameraMod(appCtx.camera, appState);
            }
            appCtx.camera.updateProjectionMatrix();
        }
    }
    else { // Center
        initCenterPersonSceneMod(appCtx.scene, appCtx.controls, appState);
        appCtx.controls.enabled = false;
        appCtx.camera.up.set(0, 1, 0);

        if (appState.currentMode === 'csv') {
            if (csvState.currentTimeIdx < 0) csvState.currentTimeIdx = 0;
            if (csvState.currentTimeIdx >= appState.csv.satelliteData.length) {
                csvState.currentTimeIdx = appState.csv.satelliteData.length - 1;
            }

            const currentGroup = appState.csv.satelliteData[csvState.currentTimeIdx];
            if (!currentGroup || !currentGroup.sats || currentGroup.sats.length === 0) {
                console.warn("切换到主星视角：当前帧无卫星数据，自动切换到第三视角");
                switchView('third');
                return;
            }

            updateCenterPersonMod(csvState.currentTimeIdx, appState, appCtx.camera, cameraPanOffset);

            appCtx.camera.updateMatrix();
            appCtx.camera.updateMatrixWorld(true);
            appCtx.camera.updateProjectionMatrix();

            appCtx.renderer.render(appCtx.scene, appCtx.camera);
            requestAnimationFrame(() => {
                appCtx.renderer.render(appCtx.scene, appCtx.camera);
                requestAnimationFrame(() => {
                    appCtx.renderer.render(appCtx.scene, appCtx.camera);
                });
            });
        } else if (wsState.lastStepData) {
            updateCenterPersonWsMod(wsState.lastStepData, appState, appCtx.camera, cameraPanOffset);
            appCtx.camera.updateMatrix();
            appCtx.camera.updateMatrixWorld(true);
            appCtx.camera.updateProjectionMatrix();
            appCtx.renderer.render(appCtx.scene, appCtx.camera);
        }
    }

    // 6. 最终确保相机完全更新
    appCtx.camera.updateMatrix();
    appCtx.camera.updateMatrixWorld(true);
    appCtx.camera.updateProjectionMatrix();

    // ======================== 关键修复：恢复星空显示 ========================
    // 星空是场景中的对象（纹理球体或粒子），不需要设置 scene.background 为纹理
    // 设置为深色背景，让星空对象自然跟随相机转动
    const sf = appState.sceneObjects.starField;
    if (sf) {
        sf.visible = true; // 确保可见
    }
    // 设置极暗背景色，确保星空对象可见
    appCtx.scene.background = new THREE.Color(0x000005);
    // ====================================================================

    if (appState.currentMode !== 'csv' || !appState.csv.satelliteData || appState.csv.satelliteData.length === 0) {
        if (view === 'third' || (view === 'first' && appState.currentMode !== 'csv') || (view === 'center' && !wsState.lastStepData)) {
            appCtx.renderer.render(appCtx.scene, appCtx.camera);
        }
    }
}

// 更新模块聚合对象 (用于传递给 view-update 模块)
const modules = {
    updateThird: updateThirdMod,
    updateFirstPerson: updateFirstPersonMod,
    updateCenterPerson: updateCenterPersonMod,
    updateThirdWs: updateThirdWsMod,
    updateFirstPersonWs: updateFirstPersonWsMod,
    updateCenterPersonWs: updateCenterPersonWsMod,
    updateStatsPanel: updateStatsPanelModule,
    // 新增：用于插值循环中的主星相机更新
    updateCenterPersonCamera: updateCenterPersonCameraMod
};

function updateCurrentView() {
    if (appState.currentMode === 'ws') {
        if (wsState.lastStepData) execUpdateCurrentViewWs(appState.currentView, wsState, appState, appCtx.camera, cameraPanOffset, modules);
        const bar = document.getElementById('time-bar');
        if (bar) bar.style.width = '0%';
        return;
    }
    execUpdateCurrentView(appState.currentView, csvState, appState, appCtx.camera, cameraPanOffset, modules);
}

// ======================== 输入/文件逻辑已移至 managers ========================

// ======================== 初始化 ========================
async function init() {
    DBG.log('INIT', '开始初始化...');
    try {
        // 1. 加载纹理
        const textures = await loadTextures();
        appState.textures.earthTextureLoaded = textures.earth;
        appState.textures.moonTextureLoaded = textures.moon;

        // 2. 初始化场景
        initBaseScene();

        // 2.5 初始化灯光管理器（传入获取 sceneObjects 的函数，延迟获取）
        lightManager = createLightManager(() => appState.sceneObjects);
        appState.lightManager = lightManager;  // 存入 appState 供其他模块访问

        // 2.6 初始化卫星编队面板
        constellationPanel = createConstellationPanelModule(appState);
        appState.constellationPanel = constellationPanel;

        // 2.7 初始化 CSV 管理器
        const csvManager = createCsvManager(appState, lightManager, constellationPanel);
        appState.csvManager = csvManager;

        // 绑定打开面板按钮
        document.getElementById('openConstellationPanel').addEventListener('click', () => {
            constellationPanel.toggle();
        });

        // 加载默认 CSV
        await csvManager.loadCSV();

        // 3. 定义核心管理器接口
        const viewManager = {
            switchView,
            getCurrentView: () => appState.currentView
        };
        const engine = { scene: appCtx.scene, camera: appCtx.camera, render: () => appCtx.render() };
        const playbackManager = createPlaybackManager(appState, engine, viewManager, modules, cameraPanOffset);

        // 4. 初始化输入控制
        const inputManager = createInputManager(
            appState, appCtx.camera, appCtx.controls, viewManager, playbackManager,
            { updateFirstPersonCamera: updateFirstPersonCameraMod }
        );
        inputManager.initFirstPersonControls(appCtx.renderer.domElement);
        inputManager.initCenterPersonMouse(appCtx.renderer.domElement, cameraPanOffset, updateCenterPersonCameraMod);
        inputManager.initKeyboardControls();

        // 5. 初始化其他 UI 模块
        initLocationControlsModule(appState, {
            onLocationChange: () => updateCurrentView()
        });
        initTooltipModule(appState.sceneObjects, appCtx.camera, appCtx.renderer, appState);
        initStatsPanelModule(() => updateStatsPanelModule(appState));

        // 6. 初始化模式管理器
        // 注意：这里传入最小化的依赖，避免 playbackHandlers 还没定义时的循环引用
        const modeManager = createModeManager(appState, viewManager, {
            stopWs: () => playbackManager.stopWsPlayback(),
            // 修复：传入停止 CSV 播放的方法，供 switchToWs 调用
            stopCsvPlayback: () => playbackManager.stopCsvPlayback(),
            startCsvPlayback: (reset) => playbackManager.startCsvPlayback(reset),
            updateWsStatus: () => playbackManager.updateWsStatus(appState.ws),
            // 修复：添加 connectWs 以支持从 CSV 切换回 WS 模式
            connectWs: (auto) => playbackManager.connectWebSocket(auto,
                () => modeManager.onWsConnected(),
                () => modeManager.onWsDisconnected())
        });

        // 7. 构建完整的 Handlers
        const orbitRingUpdater = () => updateOrbitRings(appCtx.scene, appState, createOrbitRing, DEG);
        const playbackHandlers = {
            startPlay: () => playbackManager.startPlay(),
            stopPlay: () => playbackManager.stopPlay(),
            changeSpeed: () => playbackManager.changeSpeed(),
            connectWs: (auto) => playbackManager.connectWebSocket(auto,
                () => modeManager.onWsConnected(),
                () => modeManager.onWsDisconnected()),
            stopWs: () => playbackManager.stopWsPlayback(),
            updateWsStatus: () => playbackManager.updateWsStatus(appState.ws),
            startCsvPlayback: (reset) => playbackManager.startCsvPlayback(reset),
            stopCsvPlayback: () => playbackManager.stopCsvPlayback(),
            seekToIndex: (idx) => playbackManager.seekToIndex(idx)
        };

        // 8. 初始化 UI 管理器 (传入 modeManager 处理模式切换按钮)
        const uiManager = createUiManager(appState, viewManager, playbackHandlers, orbitRingUpdater, modeManager);
        uiManager.initAll();

        // 初始场景
        initThirdPersonSceneMod(appCtx.scene, appCtx.controls, appState);
        appCtx.camera.position.copy(THIRD_PERSON_CAMERA_POS);
        appCtx.controls.target.copy(THIRD_PERSON_CAMERA_TARGET);
        appCtx.controls.update();

        // 9. 启动 WS 连接
        console.log('[INIT] 开始清理 WS 状态');
        if (wsState.connection) {
            if (wsState.connection.readyState !== WebSocket.CLOSED) {
                wsState.connection.onclose = null;
                wsState.connection.close();
            }
            wsState.connection = null;
        }
        wsState.playbackActive = false;
        wsState.dataQueue = [];
        wsState.lastStepData = null;

        // 确保重置 CSV 播放状态
        if (csvState.playbackAnimId) {
            cancelAnimationFrame(csvState.playbackAnimId);
            csvState.playbackAnimId = null;
        }
        csvState.isPlaying = false;
        
        console.log('[INIT] 开始连接 WebSocket');

        try {
            playbackManager.connectWebSocket(true,
                () => modeManager.onWsConnected(),
                () => modeManager.onWsDisconnected()
            );
            console.log('[INIT] WebSocket 连接已启动');
        } catch (e) {
            console.error('[INIT] WebSocket 连接失败:', e);
        }

        console.log('[INIT] 初始化完成, 开始渲染循环');
        animate();
    } catch (e) {
        DBG.error('INIT', '初始化失败:', e);
        console.error('[INIT] 完整错误堆栈:', e.stack);
        alert('初始化失败: ' + e.message);
    }
}

init();

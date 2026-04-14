// ======================== 视角管理器 ========================
import * as THREE from 'three';
import { DEG, RE_3D, sharedResources, THIRD_PERSON_CAMERA_POS, THIRD_PERSON_CAMERA_TARGET } from '../modules/config.js';

const DBG = {
    log: (...a) => console.log('[VIEW-MGR]', ...a),
    warn: (...a) => console.warn('[VIEW-MGR]', ...a)
};

/**
 * 清理场景对象
 */
function clearSceneObjects(scene, camera) {
    const toRemove = [];
    scene.traverse(child => {
        if (child !== scene && child !== camera &&
            !(child instanceof THREE.AmbientLight) && !(child instanceof THREE.DirectionalLight)) {
            toRemove.push(child);
        }
    });
    const sharedRes = new Set(Object.values(sharedResources));
    toRemove.forEach(obj => {
        if (obj.parent) obj.parent.remove(obj);
        if (obj.geometry && !sharedRes.has(obj.geometry)) obj.geometry.dispose();
        if (obj.material) {
            const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
            mats.forEach(m => { if (!sharedRes.has(m)) m.dispose(); });
        }
    });
}

/**
 * 创建视角管理器
 */
export function createViewManager(engine, appState, modules) {
    const { scene, camera, controls, setControls, setCamera, setSunPosition, render } = engine;
    const {
        initThirdPerson, initFirstPerson, initCenterPerson,
        updateThird, updateFirstPerson, updateCenterPerson,
        updateThirdWs, updateFirstPersonWs, updateCenterPersonWs,
        updateFirstPersonCamera,
        animateTransition
    } = modules;

    let currentView = appState.currentView;
    let currentMode = appState.currentMode;
    let csvState = appState.csv.state;
    let wsState = appState.ws;

    /**
     * 清理并重置场景对象引用
     */
    function clearScene() {
        clearSceneObjects(scene, camera);
        const so = appState.sceneObjects;
        Object.keys(so).forEach(k => {
            if (Array.isArray(so[k])) so[k] = [];
            else so[k] = null;
        });
    }

    /**
     * 校验数据索引
     */
    function validateDataIndex() {
        if (currentMode === 'csv' && appState.csv.satelliteData?.length > 0) {
            if (csvState.currentTimeIdx < 0 || csvState.currentTimeIdx >= appState.csv.satelliteData.length) {
                csvState.currentTimeIdx = 0;
            }
        }
    }

    /**
     * 切换视角
     */
    function switchView(view) {
        if (view === currentView) return;
        DBG.log(`切换: ${view}, 模式: ${currentMode}, 帧: ${csvState.currentTimeIdx}`);

        currentView = view;
        appState.currentView = view;

        // UI 更新
        const thirdBtn = document.getElementById('thirdViewBtn');
        const firstBtn = document.getElementById('firstViewBtn');
        const centerBtn = document.getElementById('centerViewBtn');
        const lockGroup = document.getElementById('lockViewGroup');

        // 修复：使用 classList.toggle 保留 view-btn 类，只修改 active 状态
        if (thirdBtn) thirdBtn.classList.toggle('active', view === 'third');
        if (firstBtn) firstBtn.classList.toggle('active', view === 'first');
        if (centerBtn) centerBtn.classList.toggle('active', view === 'center');
        if (lockGroup) lockGroup.style.display = view === 'center' ? 'block' : 'none';

        // 清理
        if (appState.cache.transitionAnimId) {
            cancelAnimationFrame(appState.cache.transitionAnimId);
            appState.cache.transitionAnimId = null;
        }
        appState.interaction.centerDragging = false;
        appState.interaction.fpDragging = false;

        clearScene();

        // 光照
        setSunPosition(view === 'center' ? 10000 : 100);

        // 数据校验
        validateDataIndex();

        // 初始化场景
        if (view === 'third') {
            initThirdPerson(scene, controls, appState);
            setControls({ enabled: true, autoRotate: false });
            setCamera(
                new THREE.Vector3(150, 75, 150),
                new THREE.Vector3(0, 0, 0)
            );
            if (currentMode === 'csv') {
                updateThird(csvState.currentTimeIdx, appState.csv.satelliteData, appState.sceneObjects, appState.interaction);
            }
        }
        else if (view === 'first') {
            initFirstPerson(scene, controls, appState);
            setControls({ enabled: false });
            appState.interaction.fpAzimuth = 0;
            appState.interaction.fpElevation = 45 * DEG;
            setCamera(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0));
            // 新增：初始化相机朝向和方位角/仰角显示
            updateFirstPersonCamera(appState.camera, appState);
            if (currentMode === 'csv' && appState.csv.satelliteData.length > 0) {
                csvState.currentTimeIdx = Math.max(0, Math.min(csvState.currentTimeIdx, appState.csv.satelliteData.length - 1));
                updateFirstPerson(csvState.currentTimeIdx, appState);
            }
        }
        else { // center
            initCenterPerson(scene, controls, appState);
            setControls({ enabled: false });
            if (currentMode === 'csv' && appState.csv.satelliteData.length > 0) {
                csvState.currentTimeIdx = Math.max(0, Math.min(csvState.currentTimeIdx, appState.csv.satelliteData.length - 1));
                const group = appState.csv.satelliteData[csvState.currentTimeIdx];
                if (!group?.sats?.length) {
                    DBG.warn('无卫星数据，切到第三视角');
                    switchView('third');
                    return;
                }
                updateCenterPerson(csvState.currentTimeIdx, appState, camera, new THREE.Vector3(0, 0, 0));
            } else if (wsState.lastStepData) {
                updateCenterPersonWs(wsState.lastStepData, appState, camera, new THREE.Vector3(0, 0, 0));
            }
        }

        // 渲染
        renderImmediate();
    }

    /**
     * 立即渲染多帧
     */
    function renderImmediate() {
        camera.updateMatrix();
        camera.updateMatrixWorld(true);
        camera.updateProjectionMatrix();
        render();
        requestAnimationFrame(() => {
            render();
            requestAnimationFrame(() => render());
        });
    }

    /**
     * 过渡动画
     */
    function animateTransitionTo(view, duration = 1000) {
        animateTransition(
            new THREE.Vector3(RE_3D * 3, RE_3D * 1.5, RE_3D * 3),
            new THREE.Vector3(0, 0, 0),
            view,
            duration,
            () => switchView(view),
            camera.position.clone(),
            controls.target.clone()
        );
    }

    return {
        switchView,
        animateTransitionTo,
        getCurrentView: () => currentView,
        getCurrentMode: () => currentMode,
        updateMode: (mode) => { currentMode = mode; }
    };
}

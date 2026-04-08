import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { DEG, RE_KM, RE_3D, SAT_SCALE, SAT_SCALE_CENTER, MAX_PAN_DISTANCE, WS_MAX_QUEUE_SIZE, sharedResources, THIRD_PERSON_CAMERA_POS, THIRD_PERSON_CAMERA_TARGET, FIRST_PERSON_CAMERA_POS, FIRST_PERSON_CAMERA_TARGET } from './modules/config.js';
import { lerp, dateToJD, calcGMST, eciToEcef, ecefToLocal, normalize, cross, dot, parseTimestamp, formatTimestamp } from './modules/math-utils.js';
import { createState } from './modules/state.js';
import { updateEarthRotation as updateEarthRotationModule, latLonToSurface3D } from './modules/earth-rotation.js';
import { initLocationControls as initLocationControlsModule } from './modules/ui/location-controls.js';
import { initTooltip as initTooltipModule } from './modules/ui/tooltip-system.js';
import { initStatsPanel as initStatsPanelModule, updateStatsPanel as updateStatsPanelModule } from './modules/ui/stats-panel.js';
import { initThirdPersonScene as initThirdPersonSceneMod, updateSatellitesThirdPerson as updateThirdMod, updateSatellitesThirdPersonWs as updateThirdWsMod, createOrbitRing } from './modules/views/third-person.js';
import { initFirstPersonScene as initFirstPersonSceneMod, updateFirstPersonCamera as updateFirstPersonCameraMod, updateSatellitesFirstPerson as updateFirstPersonMod, updateSatellitesFirstPersonWs as updateFirstPersonWsMod } from './modules/views/first-person.js';
import { initCenterPersonScene as initCenterPersonSceneMod, updateSatellitesCenterPerson as updateCenterPersonMod, updateSatellitesCenterPersonWs as updateCenterPersonWsMod, updateCenterPersonCamera as updateCenterPersonCameraMod } from './modules/views/center-person.js';

// 创建全局状态
const appState = createState();
// 将相机和偏移量存入 state，供模块使用
appState.camera = null; // Will be set later
appState.cameraPanOffset = null;

// Three.js 核心对象
let scene, camera, renderer, controls;

// 当前视角和模式
let currentView = appState.currentView;
let currentMode = appState.currentMode;

// 解包场景对象引用
let { earth, earthGroup, groundStationMarker3D, orbitRings, satelliteMeshes3D,
      horizonPlane, horizonRing, satelliteMeshes1D, groundStationMarker1D, gridGroup, arrowGroup,
      centerSatMarker, satelliteMeshesCenter, earthRef } = appState.sceneObjects;

// 解包纹理引用
let { earthTextureLoaded, moonTextureLoaded } = appState.textures;

// 解包 CSV 状态
let { satelliteData, timeIndices } = appState.csv;
let csvState = appState.csv.state;

// 解包 WS 状态
let wsState = appState.ws;

// 解包交互状态
let { currentLat, currentLon, isViewLocked, centerDragging, centerLastMouse, fpAzimuth, fpElevation, fpDragging, fpLastX, fpLastY } = appState.interaction;
const cameraPanOffset = new THREE.Vector3(0, 0, 0);

// 性能优化缓存
let { transitionAnimId } = appState.cache;

// 插值相关
let { prevFrameData, currFrameData, currentInterpData, interpProgress, interpAnimId } = appState.interpolation;

// 地球自转相关
let earthRotationStartTime = appState.earthRotation.startTime;
let earthRotationStartJD = appState.earthRotation.startJD;
let earthRotationSpeedFactor = appState.earthRotation.speedFactor;

// 向后兼容：共享资源别名
const {
    SAT_GEOM_3RD, SAT_MAT_3RD, SAT_GEOM_1ST, SAT_MAT_1ST, ORBIT_RING_MAT,
    CENTER_SAT_GEOM, CENTER_SAT_MAT, DEPUTY_SAT_GEOM, DEPUTY_SAT_MAT,
    EARTH_GEOM_3RD, EARTH_WIRE_MAT, GS_MARKER_GEOM, GS_MARKER_MAT,
    MOON_GEOM, SKY_GEOM, SKY_MAT, HORIZON_PLANE_GEOM, HORIZON_PLANE_MAT,
    HORIZON_RING_GEOM, HORIZON_RING_MAT, EARTH_CENTER_GEOM,
    GS_MARKER_1ST_GEOM, GS_MARKER_1ST_MAT
} = sharedResources;

// ======================== 插值函数 ========================

function interpolateSatellites(prevData, currData, progress) {
    if (!prevData || !currData) return currData;
    if (prevData.length === 0 || currData.length === 0) return currData;
    
    const interpolated = [];
    for (let i = 0; i < currData.length; i++) {
        const prev = prevData[i];
        const curr = currData[i];
        if (!prev) {
            interpolated.push(curr);
            continue;
        }
        const interpSat = [...curr];
        // 插值位置
        interpSat[8] = lerp(prev[8], curr[8], progress);
        interpSat[9] = lerp(prev[9], curr[9], progress);
        interpSat[10] = lerp(prev[10], curr[10], progress);
        // 插值速度
        interpSat[11] = lerp(prev[11], curr[11], progress);
        interpSat[12] = lerp(prev[12], curr[12], progress);
        interpSat[13] = lerp(prev[13], curr[13], progress);
        interpolated.push(interpSat);
    }
    return interpolated;
}

function startInterpolation(duration = 1000) {
    // 修复：取消之前的动画，防止多个循环叠加导致闪烁
    if (interpAnimId) {
        cancelAnimationFrame(interpAnimId);
        interpAnimId = null;
        
        // 修复高频闪烁：如果已有插值数据，将其作为下一帧的起点（视觉连续性）
        if (currentInterpData) {
            prevFrameData = currentInterpData;
        }
    }

    // 同步全局状态到 appState
    appState.interpolation.prevFrameData = prevFrameData;
    appState.interpolation.currFrameData = currFrameData;

    const startTime = performance.now();
    function interpLoop(now) {
        const elapsed = now - startTime;
        interpProgress = Math.min(elapsed / duration, 1.0);
        const interpData = interpolateSatellites(prevFrameData, currFrameData, interpProgress);
        currentInterpData = interpData;
        if (currentView === 'third') {
            updateSatellitesThirdPersonInterp(interpData);
        } else if (currentView === 'first') {
            updateSatellitesFirstPersonInterp(interpData);
        } else {
            updateSatellitesCenterPersonInterp(interpData);
        }
        if (interpProgress < 1.0) {
            interpAnimId = requestAnimationFrame(interpLoop);
        } else {
            interpAnimId = null;
        }
    }
    interpAnimId = requestAnimationFrame(interpLoop);
}

function updateSatellitesThirdPersonInterp(interpData) {
    if (!interpData || interpData.length === 0) return;
    const { sceneObjects, interaction } = appState;
    
    interpData.forEach((satData, idx) => {
        if (idx >= sceneObjects.satelliteMeshes3D.length) return;
        sceneObjects.satelliteMeshes3D[idx].visible = true;
        sceneObjects.satelliteMeshes3D[idx].position.set(satData[8] * SAT_SCALE, satData[10] * SAT_SCALE, -satData[9] * SAT_SCALE);
    });
    for (let i = interpData.length; i < sceneObjects.satelliteMeshes3D.length; i++) sceneObjects.satelliteMeshes3D[i].visible = false;
    document.getElementById('coordDisplay').textContent = `纬度 ${interaction.currentLat.toFixed(1)}°  经度 ${interaction.currentLon.toFixed(1)}°  时间 ${formatTimestamp(interpData[0][0])}`;
    document.getElementById('timeDisplay').textContent = formatTimestamp(interpData[0][0]);
}

function updateSatellitesFirstPersonInterp(interpData) {
    if (!interpData || interpData.length === 0) return;
    const d = parseTimestamp(interpData[0][0]);
    const gmst = calcGMST(dateToJD(d.year, d.month, d.day, d.hour, d.minute, d.second));
    const { sceneObjects, interaction } = appState;
    
    let visibleCount = 0;
    interpData.forEach((satData, idx) => {
        if (idx >= sceneObjects.satelliteMeshes1D.length) return;
        const ecef = eciToEcef(satData[8], satData[9], satData[10], gmst);
        const local = ecefToLocal(ecef.x, ecef.y, ecef.z, interaction.currentLat, interaction.currentLon);
        sceneObjects.satelliteMeshes1D[idx].visible = true;
        if (local.el >= 0) { sceneObjects.satelliteMeshes1D[idx].material.color.setHex(0x00ff00); visibleCount++; }
        else sceneObjects.satelliteMeshes1D[idx].material.color.setHex(0xff3333);
        const displayDist = local.range;
        const azR = local.az * DEG, elR = Math.max(local.el, -10) * DEG;
        sceneObjects.satelliteMeshes1D[idx].position.set(displayDist * Math.cos(elR) * Math.sin(azR), displayDist * Math.sin(elR), -displayDist * Math.cos(elR) * Math.cos(azR));
    });
    for (let i = interpData.length; i < sceneObjects.satelliteMeshes1D.length; i++) sceneObjects.satelliteMeshes1D[i].visible = false;
    document.getElementById('visibleCount').textContent = visibleCount;
    document.getElementById('timeDisplay').textContent = formatTimestamp(interpData[0][0]);
}

function updateSatellitesCenterPersonInterp(interpData) {
    if (!interpData || interpData.length === 0) return;
    const d = parseTimestamp(interpData[0][0]);
    const gmst = calcGMST(dateToJD(d.year, d.month, d.day, d.hour, d.minute, d.second));
    const { sceneObjects, interaction } = appState;

    if (sceneObjects.earthRef && sceneObjects.earthRef.parent) { sceneObjects.earthRef.position.set(0, 0, 0); sceneObjects.earthRef.rotation.y = gmst; }
    const centerSat = interpData[0];
    // 计算主星位置
    const centerPos = { x: centerSat[8], y: centerSat[10], z: -centerSat[9] };
    
    if (sceneObjects.centerSatMarker) sceneObjects.centerSatMarker.position.set(centerPos.x, centerPos.y, centerPos.z);
    let visibleCount = 0;
    const maxDeputyIdx = Math.min(interpData.length, sceneObjects.satelliteMeshesCenter.length + 1);
    for (let i = 1; i < maxDeputyIdx; i++) {
        const dX = (interpData[i][8] - centerSat[8]) * SAT_SCALE_CENTER;
        const dY = (interpData[i][9] - centerSat[9]) * SAT_SCALE_CENTER;
        const dZ = (interpData[i][10] - centerSat[10]) * SAT_SCALE_CENTER;
        sceneObjects.satelliteMeshesCenter[i - 1].visible = true;
        sceneObjects.satelliteMeshesCenter[i - 1].position.set(centerPos.x + dX, centerPos.y + dZ, centerPos.z - dY);
        if (dZ > -0.5) visibleCount++;
    }
    for (let i = maxDeputyIdx - 1; i < sceneObjects.satelliteMeshesCenter.length; i++) sceneObjects.satelliteMeshesCenter[i].visible = false;

    // 更新相机位置（跟随主星） - 直接传入计算好的坐标
    updateCenterPersonCameraMod(camera, appState, cameraPanOffset, centerPos);

    document.getElementById('coordDisplay').textContent = `纬度 ${interaction.currentLat.toFixed(1)}°  经度 ${interaction.currentLon.toFixed(1)}°  时间 ${formatTimestamp(interpData[0][0])}`;
    document.getElementById('visibleCount').textContent = visibleCount;
    document.getElementById('timeDisplay').textContent = formatTimestamp(interpData[0][0]);
}

// ======================== 工具函数 ========================
function isWsMode() {
    return currentMode === 'ws' && wsState.connection && wsState.connection.readyState === WebSocket.OPEN;
}

// (数学工具函数已从 modules/math-utils.js 导入)

// ======================== 基础场景 ========================
function initBaseScene() {
    const container = document.getElementById('canvasContainer');
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000011);
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 20000);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    // FIX P2-7: Set pixel ratio for high DPI screens
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);
    scene.add(new THREE.AmbientLight(0x333344, 0.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.position.set(100, 50, 100);
    scene.add(sun);
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}

function clearSceneObjects() {
    // 1. 物理移除场景中的对象
    const toRemove = [];
    scene.traverse(child => {
        // 保留相机、灯光和场景本身
        if (child !== scene && child !== camera && 
            !(child instanceof THREE.AmbientLight) && !(child instanceof THREE.DirectionalLight)) {
            toRemove.push(child);
        }
    });
    
    // 2. 释放资源
    const sharedRes = new Set(Object.values(sharedResources));
    toRemove.forEach(obj => {
        if (obj.parent) obj.parent.remove(obj);
        if (obj.geometry && !sharedRes.has(obj.geometry)) obj.geometry.dispose();
        if (obj.material) {
            const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
            mats.forEach(m => { if (!sharedRes.has(m)) m.dispose(); });
        }
    });

    // 3. 重置 appState 中的场景对象引用（关键：防止旧引用导致更新错误）
    const so = appState.sceneObjects;
    so.orbitRings = []; so.satelliteMeshes3D = []; so.satelliteMeshes1D = []; 
    so.satelliteMeshesCenter = []; 
    so.earth = null; so.earthGroup = null; so.groundStationMarker3D = null;
    so.horizonPlane = null; so.horizonRing = null; so.groundStationMarker1D = null;
    so.centerSatMarker = null; so.earthRef = null; so.gridGroup = null; so.arrowGroup = null;
}

function addArrowTo(group, from, to, color) {
    const dir = new THREE.Vector3().subVectors(to, from).normalize();
    group.add(new THREE.ArrowHelper(dir, from, from.distanceTo(to), color, 20, 15));
}

// ======================== 第三视角 ========================
function initThirdPersonScene() {
    scene.background = new THREE.Color(0x000011);
    clearSceneObjects();
    earthGroup = new THREE.Group();
    scene.add(earthGroup);
    const earthMat = appState.textures.earthTextureLoaded ? new THREE.MeshPhongMaterial({ map: appState.textures.earthTextureLoaded, specular: 0x333333, shininess: 5 }) : new THREE.MeshPhongMaterial({ color: 0x2244aa, specular: 0x333333, shininess: 5 });
    earth = new THREE.Mesh(EARTH_GEOM_3RD, earthMat);
    // 修复：同步地球到状态对象
    appState.sceneObjects.earth = earth;
    earthGroup.add(earth);
    earth.add(new THREE.LineSegments(new THREE.WireframeGeometry(EARTH_GEOM_3RD), EARTH_WIRE_MAT));
    groundStationMarker3D = new THREE.Mesh(GS_MARKER_GEOM, GS_MARKER_MAT);
    // 修复：同步地面站标记到状态对象
    appState.sceneObjects.groundStationMarker3D = groundStationMarker3D;
    earthGroup.add(groundStationMarker3D);
    satelliteMeshes3D = [];
    for (let i = 0; i < 22; i++) {
        // FIX Bug 5: Store satellite index for correct tooltip data lookup
        const mesh = new THREE.Mesh(SAT_GEOM_3RD, SAT_MAT_3RD);
        mesh.userData.satIdx = i;
        mesh.visible = false;
        scene.add(mesh);
        satelliteMeshes3D.push(mesh);
    }
    orbitRings = [];
    if (satelliteData.length > 0) {
        satelliteData[0].sats.forEach((sat) => {
            const ring = createOrbitRing(sat.a, sat.e, sat.i * DEG, sat.OMG * DEG, sat.omg * DEG);
            ring.visible = true;
            scene.add(ring);
            orbitRings.push(ring);
        });
    }
    const moon = new THREE.Mesh(MOON_GEOM, appState.textures.moonTextureLoaded ? new THREE.MeshPhongMaterial({ map: appState.textures.moonTextureLoaded }) : new THREE.MeshPhongMaterial({ color: 0xcccccc }));
    moon.position.set(RE_3D * 4.5, RE_3D * 0.5, -RE_3D * 4.5);
    scene.add(moon);
    // 相机位置由 switchView 的 animateTransition 控制，不在此设置
    controls.autoRotate = false;
    controls.autoRotateSpeed = 0.5;
    controls.enableRotate = true;
    controls.enablePan = true;
    controls.enableZoom = true;
    controls.minDistance = RE_3D * 1.2;
    controls.maxDistance = RE_3D * 5;
    controls.enabled = true;
    document.getElementById('groundInfo').classList.remove('hidden');
    document.getElementById('info').querySelector('span').parentElement.parentElement.style.display = 'none';
    if (isWsMode() && wsState.lastStepData) {
        // 初始化地球自转基准JD
        const d = parseTimestamp(wsState.lastStepData[0][0]);
        earthRotationStartJD = dateToJD(d.year, d.month, d.day, d.hour, d.minute, d.second);
        updateThirdWsMod(wsState.lastStepData, appState.sceneObjects, appState.interaction);
    }
    else if (appState.csv.satelliteData.length > 0) updateThirdMod(csvState.currentTimeIdx, appState.csv.satelliteData, appState.sceneObjects, appState.interaction);
}

// ======================== 视角切换 (彻底重构版) ========================
function switchView(view) {
    if (view === currentView) return;

    // 0. 更新状态和 UI (最先执行，防止后续 return 跳过)
    currentView = view;
    appState.currentView = view;
    
    // 强制更新按钮高亮
    document.getElementById('thirdViewBtn').className = view === 'third' ? 'active' : '';
    document.getElementById('firstViewBtn').className = view === 'first' ? 'active' : '';
    document.getElementById('centerViewBtn').className = view === 'center' ? 'active' : '';
    document.getElementById('lockViewGroup').style.display = view === 'center' ? 'block' : 'none';

    // 1. 清理旧状态
    if (transitionAnimId) { cancelAnimationFrame(transitionAnimId); transitionAnimId = null; }
    centerDragging = false;
    appState.interaction.fpDragging = false;
    cameraPanOffset.set(0, 0, 0);

    // 2. 清理场景对象
    clearSceneObjects();

    // 3. 修复光照
    scene.traverse(obj => {
        if (obj.isDirectionalLight) {
            const dist = (view === 'center') ? 10000 : 100;
            obj.position.set(dist, 50, dist);
        }
    });

    // 4. 数据索引校验 (防止越界导致不渲染)
    if (currentMode === 'csv' && appState.csv.satelliteData && appState.csv.satelliteData.length > 0) {
        if (csvState.currentTimeIdx < 0 || csvState.currentTimeIdx >= appState.csv.satelliteData.length) {
            csvState.currentTimeIdx = 0;
        }
    }

    // 5. 初始化新场景并立即渲染当前帧
    if (view === 'third') {
        initThirdPersonSceneMod(scene, controls, appState);
        controls.enabled = true;
        controls.autoRotate = false;
        camera.position.set(150, 75, 150);
        controls.target.set(0, 0, 0);
        camera.up.set(0, 1, 0);
        controls.update();
        
        // CSV 模式下立即渲染当前帧
        if (currentMode === 'csv') {
            updateThirdMod(csvState.currentTimeIdx, appState.csv.satelliteData, appState.sceneObjects, appState.interaction);
        }
    } 
    else if (view === 'first') {
        initFirstPersonSceneMod(scene, controls, appState);
        controls.enabled = false;
        appState.interaction.fpAzimuth = 0;
        appState.interaction.fpElevation = 45;
        
        // 修复第一视角画面扭曲：重置相机姿态
        camera.position.set(0, 0, 0);
        camera.up.set(0, 1, 0);
        camera.lookAt(new THREE.Vector3(0, 0, 100));
        updateFirstPersonCameraMod(camera, appState);
        
        // CSV 模式下立即渲染当前帧
        if (currentMode === 'csv') {
            updateFirstPersonMod(csvState.currentTimeIdx, appState);
            // 强制渲染，解决切换后需要鼠标拖动的问题
            renderer.render(scene, camera);
        }
    } 
    else { // Center
        initCenterPersonSceneMod(scene, controls, appState);
        controls.enabled = false;
        camera.up.set(0, 1, 0);
        
        // CSV 模式下立即渲染当前帧（包含相机位置更新）
        if (currentMode === 'csv') {
            // 确保先渲染卫星，相机位置会在 updateCenterPersonMod 中自动计算
            updateCenterPersonMod(csvState.currentTimeIdx, appState, camera, cameraPanOffset);
            // 强制渲染，解决切换后需要点击播放的问题
            renderer.render(scene, camera);
        } else if (wsState.lastStepData) {
            // WS 模式下也需要渲染
            updateCenterPersonWsMod(wsState.lastStepData, appState, camera, cameraPanOffset);
        }
    }

    // 6. 强制渲染 (解决切换不显示问题)
    // 更新相机矩阵确保渲染正确
    camera.updateMatrix();
    camera.updateMatrixWorld(true);
    renderer.render(scene, camera);
}

function animateTransitionFrom(targetPos, targetLookAt, targetView, duration, onComplete, startPos, startTarget) {
    // FIX: Cancel previous animation to prevent conflicts
    if (transitionAnimId) {
        cancelAnimationFrame(transitionAnimId);
        transitionAnimId = null;
    }
    
    // 修复视角切换跳动/极点问题：禁用控制器，防止其在动画过程中干扰相机位置
    const wasEnabled = controls.enabled;
    controls.enabled = false;

    // 直接设置目标点
    controls.target.copy(targetLookAt);
    
    const startTime = performance.now();
    function step(now) {
        const t = Math.min((now - startTime) / duration, 1);
        const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        camera.position.lerpVectors(startPos, targetPos, ease);
        
        if (t < 1) {
            transitionAnimId = requestAnimationFrame(step);
        } else {
            transitionAnimId = null;
            // 动画结束后，恢复控制器状态
            controls.enabled = wasEnabled;
            if (targetView === 'third') {
                controls.update();
            }
            if (onComplete) onComplete();
        }
    }
    transitionAnimId = requestAnimationFrame(step);
}

// ======================== 轨道环更新 ========================
function updateOrbitRings() {
    // 安全获取卫星数据
    const satData = appState.csv?.satelliteData;
    if (!satData || satData.length === 0) return;

    // 移除旧轨道环
    if (appState.sceneObjects?.orbitRings) {
        appState.sceneObjects.orbitRings.forEach(ring => {
            if (ring.parent) ring.parent.remove(ring);
            if (ring.geometry) ring.geometry.dispose();
        });
        appState.sceneObjects.orbitRings = [];
    }
    
    // 创建新轨道环 (增加 sats 存在性检查)
    if (satData.length > 0 && satData[0].sats && satData[0].sats.length > 0) {
        satData[0].sats.forEach((sat) => {
            const ring = createOrbitRing(sat.a, sat.e, sat.i * DEG, sat.OMG * DEG, sat.omg * DEG);
            ring.visible = true;
            scene.add(ring);
            appState.sceneObjects.orbitRings.push(ring);
        });
    }
}

// ======================== CSV 模式 ========================
async function loadCSV() {
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
            const sat = { sat_id: satId, a: parseFloat(vals[2]), e: parseFloat(vals[3]), i: parseFloat(vals[4]), OMG: parseFloat(vals[5]), omg: parseFloat(vals[6]), f: parseFloat(vals[7]), X: parseFloat(vals[8]), Y: parseFloat(vals[9]), Z: parseFloat(vals[10]), Vx: parseFloat(vals[11]), Vy: parseFloat(vals[12]), Vz: parseFloat(vals[13]) };
            if (!grouped[ts]) grouped[ts] = [];
            grouped[ts].push(sat);
        }
        appState.csv.timeIndices = Object.keys(grouped).sort();
        appState.csv.satelliteData = appState.csv.timeIndices.map(ts => ({ timestamp: ts, sats: grouped[ts] }));
        csvState.endIdx = appState.csv.timeIndices.length - 1;
        console.log(`CSV加载完成: ${appState.csv.satelliteData.length} 个时间点, ${appState.csv.satelliteData[0]?.sats.length || 0} 颗卫星`);
    } catch (e) {
        console.log('propagation_result.csv 加载失败，请使用文件选择器加载 CSV 文件');
    }
}

function startCsvPlayback() {
    // 修复：从 appState 获取最新数据引用（解决加载 CSV 后局部变量未更新的问题）
    const data = appState.csv.satelliteData;
    const state = appState.csv.state;
    const times = appState.csv.timeIndices;

    if (state.isPlaying) return;
    if (!data || data.length === 0) {
        console.error("无可用卫星数据，请先加载 CSV 文件");
        return;
    }
    state.isPlaying = true;

    // Reset interpolation state to prevent stale data from other modes
    prevFrameData = null;
    currFrameData = null;
    currentInterpData = null;

    const speed = parseInt(document.getElementById('speed').value, 10);
    const intervalMs = Math.max(100 / speed, 16);

    // 计算CSV帧时间间隔（秒）
    let frameIntervalSec = 60;  // 默认1分钟
    if (times.length >= 2) {
        const d1 = parseTimestamp(times[0]);
        const d2 = parseTimestamp(times[1]);
        const jd1 = dateToJD(d1.year, d1.month, d1.day, d1.hour, d1.minute, d1.second);
        const jd2 = dateToJD(d2.year, d2.month, d2.day, d2.hour, d2.minute, d2.second);
        frameIntervalSec = Math.abs((jd2 - jd1) * 86400);
    }

    // 速度因子 = 每秒播放帧数 * 每帧间隔秒数
    const framesPerSec = 1000 / intervalMs;
    earthRotationSpeedFactor = appState.earthRotation.speedFactor = framesPerSec * frameIntervalSec;

    // 重置地球自转基准时间
    earthRotationStartTime = appState.earthRotation.startTime = performance.now();
    const groupData = data[state.currentTimeIdx];
    if (groupData) {
        const d = parseTimestamp(groupData.timestamp);
        earthRotationStartJD = appState.earthRotation.startJD = dateToJD(d.year, d.month, d.day, d.hour, d.minute, d.second);
    }

    csvState.interval = setInterval(() => {
        if (state.currentTimeIdx >= state.endIdx) {
            state.currentTimeIdx = state.startIdx;
        } else {
            state.currentTimeIdx++;
        }
        document.getElementById('timeSlider').value = state.currentTimeIdx;

        // Get timestamp from group level (not individual satellite objects)
        const currentGroup = data[state.currentTimeIdx];
        if (!currentGroup) return;
        const timestamp = currentGroup.timestamp;
        const frameData = currentGroup.sats.map(sat => [
            timestamp, sat.sat_id, sat.a, sat.e, sat.i, sat.OMG, sat.omg, sat.f,
            sat.X, sat.Y, sat.Z, sat.Vx, sat.Vy, sat.Vz
        ]);
        prevFrameData = currFrameData;
        currFrameData = frameData;
        startInterpolation(intervalMs);
        // 已删除 updateCurrentView() 调用，防止双重渲染导致闪烁

        // 只更新时间进度条
        const progress = times.length > 1 
            ? (state.currentTimeIdx / (times.length - 1)) * 100 
            : 0;
        const bar = document.getElementById('time-bar');
        if (bar) bar.style.width = progress + '%';
    }, intervalMs);
}

function stopCsvPlayback() {
    csvState.isPlaying = false;
    if (csvState.interval) { clearInterval(csvState.interval); csvState.interval = null; }
}

function updateCurrentView() {
    if (currentMode === 'ws') {
        // WS 模式：调用 WS 模式的视角更新
        if (wsState.lastStepData) {
            updateCurrentViewWs();
        }
        const bar = document.getElementById('time-bar');
        if (bar) bar.style.width = '0%';
        return;
    }
    // CSV mode: earth rotation is handled by updateEarthRotation() in animate loop
    if (currentView === 'third') updateThirdMod(csvState.currentTimeIdx, appState.csv.satelliteData, appState.sceneObjects, appState.interaction);
    else if (currentView === 'first') updateFirstPersonMod(csvState.currentTimeIdx, appState);
    else updateCenterPersonMod(csvState.currentTimeIdx, appState, camera, cameraPanOffset);
    const times = appState.csv.timeIndices;
    const progress = times.length > 1 ? (csvState.currentTimeIdx / (times.length - 1)) * 100 : 0;
    const bar = document.getElementById('time-bar');
    if (bar) bar.style.width = progress + '%';
    if (!document.getElementById('stats-panel').classList.contains('hidden')) updateStatsPanelModule(appState);
}

// WS 模式下的视角切换处理
function updateCurrentViewWs() {
    if (!wsState.lastStepData) return;
    if (currentView === 'third') {
        updateThirdWsMod(wsState.lastStepData, appState.sceneObjects, appState.interaction);
    } else if (currentView === 'first') {
        updateFirstPersonWsMod(wsState.lastStepData, appState);
    } else {
        updateCenterPersonWsMod(wsState.lastStepData, appState, camera, cameraPanOffset);
    }
}

// ======================== WebSocket 模式 ========================
function connectWebSocket(autoPlay = false) {
    if (wsState.connection && wsState.connection.readyState !== WebSocket.CLOSED) return;
    wsState.dataQueue = [];
    wsState.currentTime = 0;
    wsState.playbackActive = false;
    wsState.lastStepData = null;
    wsState.autoPlayOnConnect = autoPlay;
    wsState.connectionState = 'connecting';
    updateWsStatus();
    wsState.connection = new WebSocket('ws://localhost:8765');
    wsState.connection.onopen = () => {
        wsState.connectionState = 'buffering';
        currentMode = 'ws';
        // FIX P2-8: Hide CSV UI elements in WS mode
        document.getElementById('startIdx').parentElement.style.display = 'none';
        document.getElementById('endIdx').parentElement.style.display = 'none';
        document.getElementById('timeSlider').parentElement.style.display = 'none';
        const barContainer = document.getElementById('time-bar-container');
        if (barContainer) barContainer.style.display = 'none';
        // Update mode toggle button text
        const modeBtn = document.getElementById('modeToggle');
        if (modeBtn) modeBtn.textContent = '🔄 切换到 CSV 模式';
        updateWsStatus();
        
        // 初始化地球自转基准时间
        earthRotationStartTime = performance.now();
        
        // 添加过渡动画
        animateTransitionFrom(
            THIRD_PERSON_CAMERA_POS.clone(),
            THIRD_PERSON_CAMERA_TARGET.clone(),
            'third',
            1000,
            () => {},
            camera.position.clone(),
            controls.target.clone()
        );
    };
    wsState.connection.onmessage = (event) => {
        // FIX Bug 2 & 7: Add JSON parse error handling
        let msg;
        try {
            msg = JSON.parse(event.data);
        } catch (e) {
            console.error('WS 数据解析失败:', e);
            return;
        }
        if (msg.type === 'data' && Array.isArray(msg.data) && msg.data.length > 0) {
            // FIX Bug 2: Validate data structure
            const isValid = msg.data.every(d => Array.isArray(d) && d.length >= 14);
            if (!isValid) {
                console.warn('WS 数据格式错误，跳过本批次');
                return;
            }
            // FIX P0-2: Use loop instead of spread to prevent stack overflow
            for (let i = 0; i < msg.data.length; i++) {
                wsState.dataQueue.push(msg.data[i]);
            }
            // FIX Bug 5: Keep newest data when queue overflows
            while (wsState.dataQueue.length > WS_MAX_QUEUE_SIZE) {
                wsState.dataQueue.shift();
            }
            // FIX: Don't set lastStepData here - it's set in runWsPlayback when consuming data
            // This ensures lastStepData always reflects the currently playing frame
            if (msg.is_first && !wsState.playbackActive && wsState.autoPlayOnConnect) {
                wsState.connectionState = 'playing';
                wsState.autoPlayOnConnect = false;
                runWsPlayback();
            }
            // FIX Bug 3: Restart timer if playback was active but timer stopped due to empty queue
            if (wsState.playbackActive && !wsState.playbackTimer) {
                runWsPlayback();
            }
            updateWsStatus();
        }
    };
    wsState.connection.onclose = () => {
        wsState.connectionState = 'disconnected';
        currentMode = 'csv';
        wsState.playbackActive = false;
        wsState.connection = null;
        stopWsPlayback();
        if (csvState.isPlaying) stopCsvPlayback();
        // FIX Bug 9: Restore all CSV UI elements
        document.getElementById('startIdx').parentElement.style.display = '';
        document.getElementById('endIdx').parentElement.style.display = '';
        document.getElementById('timeSlider').parentElement.style.display = '';
        const barContainer = document.getElementById('time-bar-container');
        if (barContainer) barContainer.style.display = '';
        updateWsStatus();
        
        // 添加过渡动画
        animateTransitionFrom(
            THIRD_PERSON_CAMERA_POS.clone(),
            THIRD_PERSON_CAMERA_TARGET.clone(),
            'third',
            1000,
            () => {},
            camera.position.clone(),
            controls.target.clone()
        );
    };
    wsState.connection.onerror = () => {
        wsState.connectionState = 'disconnected';
        updateWsStatus();
        // FIX: Delay cleanup to avoid conflict with onclose
        setTimeout(() => {
            if (wsState.connection && wsState.connection.readyState === WebSocket.CLOSED) {
                wsState.connection = null;
            }
            if (!wsState.connection) {
                connectWebSocket(wsState.autoPlayOnConnect);
            }
        }, 3000);
    };
}

function runWsPlayback() {
    if (wsState.playbackActive) return;
    wsState.playbackActive = true;

    // Reset interpolation state to prevent stale data from other modes
    prevFrameData = null;
    currFrameData = null;
    currentInterpData = null;

    // WS模式：地球自转与时间戳1:1同步
    // 重置状态，确保在收到第一条数据时能正确初始化
    earthRotationSpeedFactor = appState.earthRotation.speedFactor = 1;
    earthRotationStartTime = appState.earthRotation.startTime = null;
    earthRotationStartJD = appState.earthRotation.startJD = null;
    
    function tick() {
        if (!wsState.playbackActive) return;
        if (wsState.dataQueue.length === 0) {
            wsState.playbackTimer = setTimeout(tick, 100);
            return;
        }
        const stepData = wsState.dataQueue.shift();
        prevFrameData = currFrameData;
        currFrameData = stepData;
        wsState.lastStepData = stepData;
        
        // 初始化地球自转基准时间
        if (earthRotationStartTime === null && stepData && stepData.length > 0) {
            earthRotationStartTime = appState.earthRotation.startTime = performance.now();
            const d = parseTimestamp(stepData[0][0]);
            earthRotationStartJD = appState.earthRotation.startJD = dateToJD(d.year, d.month, d.day, d.hour, d.minute, d.second);
        }
        
        startInterpolation();
        if (stepData && stepData.length > 0) {
            document.getElementById('timeDisplay').textContent = formatTimestamp(stepData[0][0]);
        }
        wsState.playbackTimer = setTimeout(tick, 1000);
    }
    tick();
}

function stopWsPlayback() {
    wsState.playbackActive = false;
    // FIX Bug 5: Clear both setTimeout and setInterval timers
    if (wsState.playbackTimer) { 
        clearTimeout(wsState.playbackTimer); 
        clearInterval(wsState.playbackTimer); 
        wsState.playbackTimer = null; 
    }
}

function sendWsCommand(cmd) {
    if (wsState.connection && wsState.connection.readyState === WebSocket.OPEN) {
        wsState.connection.send(JSON.stringify({ type: 'command', cmd }));
    }
}



function updateWsStatus() {
    const statusDot = document.getElementById('ws-status-dot');
    const statusText = document.getElementById('ws-status-text');
    if (!statusDot || !statusText) return;
    statusDot.className = 'dot ' + wsState.connectionState;
    const texts = { disconnected: '未连接', connecting: '连接中...', buffering: '计算中...', playing: '实时播放', paused: '已暂停' };
    statusText.textContent = texts[wsState.connectionState] || '未知';
}

// ======================== 播放控制 ========================
function startPlay() {
    // 如果 WS 已连接并正在播放，不启动任何播放
    if (wsState.connection && wsState.connection.readyState === WebSocket.OPEN && wsState.playbackActive) {
        return;
    }
    // 停止所有可能的播放
    stopWsPlayback();
    if (csvState.isPlaying) stopCsvPlayback();
    
    // 如果 WS 正在连接中，等待连接完成
    if (wsState.connection && wsState.connection.readyState === WebSocket.CONNECTING) {
        wsState.autoPlayOnConnect = true;
        updateWsStatus();
        return;
    }
    
    if (currentMode === 'ws') {
        if (wsState.connection && wsState.connection.readyState === WebSocket.OPEN) {
            sendWsCommand('resume');
            wsState.connectionState = 'playing';
            runWsPlayback();
            updateWsStatus();
            return;
        }
        // 重连
        wsState.dataQueue = [];
        wsState.currentTime = 0;
        wsState.playbackActive = false;
        wsState.connection = null;
        wsState.autoPlayOnConnect = true;
        connectWebSocket(true);
        return;
    }
    startCsvPlayback();
}

function stopPlay() {
    stopWsPlayback();
    if (csvState.isPlaying) stopCsvPlayback();
    
    // 重置地球自转状态，停止后地球不再自转
    earthRotationStartTime = appState.earthRotation.startTime = null;
    earthRotationStartJD = appState.earthRotation.startJD = null;
    earthRotationSpeedFactor = appState.earthRotation.speedFactor = 1;
    
    // FIX Bug 3: Update UI state when stopping
    const slider = document.getElementById('timeSlider');
    if (slider && currentMode === 'csv') slider.value = csvState.currentTimeIdx;
    const playBtn = document.getElementById('playBtn');
    if (playBtn) playBtn.textContent = '▶ 播放';
    
    if (currentMode === 'ws' && wsState.connection && wsState.connection.readyState === WebSocket.OPEN) {
        sendWsCommand('pause');
        wsState.connectionState = 'paused';
        updateWsStatus();
    }
}

// ======================== UI 控制 ========================
function initTimeControls() {
    const startSelect = document.getElementById('startIdx');
    const endSelect = document.getElementById('endIdx');
    const slider = document.getElementById('timeSlider');
    startSelect.innerHTML = '';
    endSelect.innerHTML = '';
    appState.csv.timeIndices.forEach((ts, idx) => {
        const opt1 = document.createElement('option');
        opt1.value = idx;
        opt1.textContent = formatTimestamp(ts);
        startSelect.appendChild(opt1);
        const opt2 = document.createElement('option');
        opt2.value = idx;
        opt2.textContent = formatTimestamp(ts);
        endSelect.appendChild(opt2);
    });
    endSelect.value = appState.csv.timeIndices.length - 1;
    csvState.startIdx = 0;
    csvState.endIdx = appState.csv.timeIndices.length - 1;
    startSelect.addEventListener('change', () => {
        csvState.startIdx = parseInt(startSelect.value);
        if (csvState.currentTimeIdx < csvState.startIdx) { csvState.currentTimeIdx = csvState.startIdx; slider.value = csvState.currentTimeIdx; updateCurrentView(); }
    });
    endSelect.addEventListener('change', () => {
        csvState.endIdx = parseInt(endSelect.value);
        if (csvState.currentTimeIdx > csvState.endIdx) { csvState.currentTimeIdx = csvState.endIdx; slider.value = csvState.currentTimeIdx; updateCurrentView(); }
    });
    slider.max = Math.max(0, appState.csv.timeIndices.length - 1);
    slider.addEventListener('input', () => { csvState.currentTimeIdx = parseInt(slider.value); updateCurrentView(); });
    document.getElementById('playBtn').addEventListener('click', startPlay);
    document.getElementById('stopBtn').addEventListener('click', stopPlay);
    document.getElementById('speed').addEventListener('change', () => {
        if (csvState.isPlaying) { stopCsvPlayback(); startCsvPlayback(); }
        else if (currentMode === 'ws') {
            // WS 模式下速度切换提示
            console.log('WS 模式下速度由服务器控制，前端切换无效');
        }
    });
}

function initModeToggle() {
    const btn = document.getElementById('modeToggle');
    btn.addEventListener('click', () => {
        if (currentMode === 'ws') {
            currentMode = 'csv';
            stopWsPlayback();
            if (wsState.connection && wsState.connection.readyState === WebSocket.OPEN) {
                wsState.connection.close();
            }
            wsState.connection = null;
            
            // 恢复 CSV UI
            document.getElementById('startIdx').parentElement.style.display = '';
            document.getElementById('endIdx').parentElement.style.display = '';
            document.getElementById('timeSlider').parentElement.style.display = '';
            const barContainer = document.getElementById('time-bar-container');
            if (barContainer) barContainer.style.display = '';
            btn.textContent = '🔄 切换到 WS 模式';
            updateWsStatus();

            // 修复：如果在主星视角，检查是否有 CSV 数据
            // 如果没有数据，主星视角会导致相机进入地球内部（蓝屏），因此自动切换到第三视角
            if (currentView === 'center') {
                if (appState.csv.satelliteData && appState.csv.satelliteData.length > 0) {
                    // 确保时间索引有效，防止 updateSatellitesCenterPerson 提前返回导致 Marker 在原点
                    if (csvState.currentTimeIdx < 0 || csvState.currentTimeIdx >= appState.csv.satelliteData.length) {
                        csvState.currentTimeIdx = 0;
                    }
                    
                    // 检查当前帧是否有卫星数据
                    const currentGroup = appState.csv.satelliteData[csvState.currentTimeIdx];
                    if (!currentGroup || !currentGroup.sats || currentGroup.sats.length === 0) {
                        console.log("切换到 CSV 模式：当前帧无卫星数据，自动切换到第三视角以避免蓝屏");
                        switchView('third');
                    } else {
                        initCenterPersonSceneMod(scene, controls, appState);
                        updateCurrentView();
                    }
                } else {
                    console.log("切换到 CSV 模式：无可用数据，自动切换到第三视角以避免蓝屏");
                    switchView('third');
                }
            } else {
                // 其他视角尝试刷新数据
                if (appState.csv.satelliteData && appState.csv.satelliteData.length > 0) {
                    updateCurrentView(); 
                }
            }

        } else {
            connectWebSocket(true);
            btn.textContent = '🔄 切换到 CSV 模式';
        }
    });
}

function initViewControls() {
    document.getElementById('thirdViewBtn').addEventListener('click', () => switchView('third'));
    document.getElementById('firstViewBtn').addEventListener('click', () => switchView('first'));
    document.getElementById('centerViewBtn').addEventListener('click', () => switchView('center'));
}

function updateLockButton() {
    const btn = document.getElementById('lockViewBtn');
    if (isViewLocked) {
        btn.textContent = '🔒 锁定视角';
        btn.classList.add('active');
        if (currentView === 'center') {
            resetCameraPanOffset();
            if (isWsMode() && wsState.lastStepData) {
                updateCenterPersonWsMod(wsState.lastStepData, appState);
            } else if (appState.csv.satelliteData.length > 0) {
                updateCurrentView();
            }
        }
    } else {
        btn.textContent = '🔓 解锁视角';
        btn.classList.remove('active');
    }
}

function initCenterPersonMouse() {
    renderer.domElement.addEventListener('mousedown', (e) => {
        if (currentView !== 'center' || isViewLocked || e.button !== 0) return;
        centerDragging = true;
        centerLastMouse = { x: e.clientX, y: e.clientY };
    });
    renderer.domElement.addEventListener('mousemove', (e) => {
        if (!centerDragging || currentView !== 'center' || isViewLocked) return;
        const dx = e.clientX - centerLastMouse.x;
        const dy = e.clientY - centerLastMouse.y;
        const viewDir = new THREE.Vector3().subVectors(new THREE.Vector3(0,0,0), camera.position).normalize();
        const up = new THREE.Vector3(0, 1, 0);
        const right = new THREE.Vector3().crossVectors(viewDir, up).normalize();
        const panSpeed = 0.02;
        cameraPanOffset.add(right.clone().multiplyScalar(-dx * panSpeed));
        cameraPanOffset.add(up.clone().multiplyScalar(dy * panSpeed));
        centerLastMouse = { x: e.clientX, y: e.clientY };
        // 限制偏移，不直接更新相机（由插值循环统一更新）
        if (cameraPanOffset.length() > MAX_PAN_DISTANCE) {
            cameraPanOffset.setLength(MAX_PAN_DISTANCE);
        }
    });
    renderer.domElement.addEventListener('mouseup', () => { centerDragging = false; });
    renderer.domElement.addEventListener('mouseleave', () => { centerDragging = false; });
}

function resetCameraPanOffset() {
    cameraPanOffset.set(0, 0, 0);
    updateCenterPersonCameraMod(camera, appState, cameraPanOffset);
}

function initLockView() {
    document.getElementById('lockViewBtn').addEventListener('click', () => { isViewLocked = !isViewLocked; updateLockButton(); });
}

// 第一视角鼠标事件处理函数（提取为独立函数以避免重复绑定）
let fpMouseDownHandler, fpMouseMoveHandler, fpMouseUpHandler, fpMouseLeaveHandler;

function initFirstPersonControls() {
    // 移除旧的事件监听器（防止重复绑定）
    if (fpMouseDownHandler) renderer.domElement.removeEventListener('mousedown', fpMouseDownHandler);
    if (fpMouseMoveHandler) renderer.domElement.removeEventListener('mousemove', fpMouseMoveHandler);
    if (fpMouseUpHandler) renderer.domElement.removeEventListener('mouseup', fpMouseUpHandler);
    if (fpMouseLeaveHandler) renderer.domElement.removeEventListener('mouseleave', fpMouseLeaveHandler);

    // 创建新的事件监听器
    fpMouseDownHandler = (e) => {
        if (currentView !== 'first') return;
        appState.interaction.fpDragging = true;
        appState.interaction.fpLastX = e.clientX;
        appState.interaction.fpLastY = e.clientY;
    };

    fpMouseMoveHandler = (e) => {
        if (!appState.interaction.fpDragging || currentView !== 'first') return;
        appState.interaction.fpAzimuth -= (e.clientX - appState.interaction.fpLastX) * 0.003;
        appState.interaction.fpElevation = Math.max(1, Math.min(90, appState.interaction.fpElevation + (e.clientY - appState.interaction.fpLastY) * 0.1));
        appState.interaction.fpLastX = e.clientX;
        appState.interaction.fpLastY = e.clientY;
        updateFirstPersonCameraMod(camera, appState);
    };

    fpMouseUpHandler = () => { appState.interaction.fpDragging = false; };
    fpMouseLeaveHandler = () => { appState.interaction.fpDragging = false; };

    // 绑定新的事件监听器
    renderer.domElement.addEventListener('mousedown', fpMouseDownHandler);
    renderer.domElement.addEventListener('mousemove', fpMouseMoveHandler);
    renderer.domElement.addEventListener('mouseup', fpMouseUpHandler);
    renderer.domElement.addEventListener('mouseleave', fpMouseLeaveHandler);
}

// ======================== Tooltip ========================
// ======================== 键盘快捷键 ========================
function initKeyboardControls() {
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
        switch(e.key) {
            case ' ': e.preventDefault(); isPlaying() ? stopPlay() : startPlay(); break;
            case '1': switchView('third'); break;
            case '2': switchView('first'); break;
            case '3': switchView('center'); break;
            case 'ArrowLeft':
                if (isWsMode()) return;
                e.preventDefault();
                csvState.currentTimeIdx = Math.max(csvState.startIdx, csvState.currentTimeIdx - 1);
                document.getElementById('timeSlider').value = csvState.currentTimeIdx;
                updateCurrentView();
                break;
            case 'ArrowRight':
                if (isWsMode()) return;
                e.preventDefault();
                csvState.currentTimeIdx = Math.min(csvState.endIdx, csvState.currentTimeIdx + 1);
                document.getElementById('timeSlider').value = csvState.currentTimeIdx;
                updateCurrentView();
                break;
        }
    });
}

function isPlaying() {
    return wsState.playbackActive || csvState.isPlaying;
}

// ======================== 文件选择器 ========================
function initFileLoader() {
    document.getElementById('csvFileInput').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
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
                const sat = { sat_id: satId, a: parseFloat(vals[2]), e: parseFloat(vals[3]), i: parseFloat(vals[4]), OMG: parseFloat(vals[5]), omg: parseFloat(vals[6]), f: parseFloat(vals[7]), X: parseFloat(vals[8]), Y: parseFloat(vals[9]), Z: parseFloat(vals[10]), Vx: parseFloat(vals[11]), Vy: parseFloat(vals[12]), Vz: parseFloat(vals[13]) };
                if (!grouped[ts]) grouped[ts] = [];
                grouped[ts].push(sat);
            }
            appState.csv.timeIndices = Object.keys(grouped).sort();
            appState.csv.satelliteData = appState.csv.timeIndices.map(ts => ({ timestamp: ts, sats: grouped[ts] }));
            csvState.endIdx = appState.csv.timeIndices.length - 1;
            csvState.startIdx = 0;
            csvState.currentTimeIdx = 0;
            // 修复：使用 ?.sats?.length 防止空数组导致崩溃
            document.getElementById('totalSatCount').textContent = appState.csv.satelliteData[0]?.sats?.length || 0;
            initTimeControls();
            updateOrbitRings();
            updateCurrentView();
            alert(`加载成功: ${appState.csv.satelliteData.length} 个时间点, ${appState.csv.satelliteData[0]?.sats?.length || 0} 颗卫星`);
        } catch (err) {
            alert('CSV解析失败: ' + err.message);
        }
    });
}

// ======================== 地球自转连续插值 ========================

function animate() {
    requestAnimationFrame(animate);
    
    // 修复：如果正在执行视角切换动画，禁用 OrbitControls 更新，防止相机被吸附到极点
    if (currentView === 'third' && !transitionAnimId) {
        controls.update();
    }
    // ❌ 已移除：相机跟随逻辑移至数据更新函数中，避免渲染循环竞争条件
    
    // 确保 appState.sceneObjects 是最新的
    if (earth && !appState.sceneObjects.earth) {
        appState.sceneObjects.earth = earth;
    }
    if (earthRef && !appState.sceneObjects.earthRef) {
        appState.sceneObjects.earthRef = earthRef;
    }

    // --- 临时调试日志：追踪地球自转状态 ---
    if (appState.earthRotation.startTime === null || appState.earthRotation.startJD === null) {
        console.warn('地球自转未初始化: startTime=', appState.earthRotation.startTime, 'startJD=', appState.earthRotation.startJD);
    }
    // 如果满足条件，打印一帧以确认更新逻辑被触发
    if (Math.floor(performance.now() / 1000) % 2 === 0) { // 每 2 秒打印一次，避免刷屏
        console.log('Earth Rotation Check:', { 
            hasEarth: !!appState.sceneObjects.earth, 
            hasEarthRef: !!appState.sceneObjects.earthRef,
            startTime: appState.earthRotation.startTime,
            startJD: appState.earthRotation.startJD
        });
    }
    // ----------------------------------------

    // 每帧更新地球自转（连续插值）
    updateEarthRotationModule(appState, appState.sceneObjects);
    renderer.render(scene, camera);
}

// ======================== 初始化 ========================
async function init() {
    try {
        const loader = new THREE.TextureLoader();
        
        // 等待纹理加载完成，避免地球从蓝色跳变到纹理
        await new Promise((resolve) => {
            let loadedCount = 0;
            const checkDone = () => { if (++loadedCount >= 2) resolve(); };
            
            loader.load('https://unpkg.com/three-globe@2.31.1/example/img/earth-blue-marble.jpg',
                (texture) => { 
                    earthTextureLoaded = texture; 
                    appState.textures.earthTextureLoaded = texture; // 同步到状态
                    checkDone(); 
                },
                undefined, 
                () => { console.warn('地球纹理加载失败'); checkDone(); }
            );
            loader.load('https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/FullMoon2010.jpg/1200px-FullMoon2010.jpg',
                (texture) => { 
                    moonTextureLoaded = texture; 
                    appState.textures.moonTextureLoaded = texture; // 同步到状态
                    checkDone(); 
                },
                undefined, 
                () => { console.warn('月球纹理加载失败'); checkDone(); }
            );
        });
        
        initBaseScene();
        initFirstPersonControls();
        initCenterPersonMouse();
        initLocationControlsModule(appState, {
            onLocationChange: (state) => {
                // 同步全局变量
                currentLat = state.interaction.currentLat;
                currentLon = state.interaction.currentLon;

                updateCurrentView();

                // 手动更新地面站标记
                if (appState.sceneObjects.groundStationMarker3D && appState.sceneObjects.earth) {
                    const gmst = appState.sceneObjects.earth.rotation.y;
                    const gsPos = latLonToSurface3D(currentLat, currentLon);
                    gsPos.applyAxisAngle(new THREE.Vector3(0, 1, 0), gmst);
                    appState.sceneObjects.groundStationMarker3D.position.copy(gsPos);
                }
            }
        });
        initViewControls();
        initLockView();
        initTooltipModule(appState.sceneObjects, camera, renderer, appState);
        initKeyboardControls();
        initFileLoader();
        initStatsPanelModule(() => updateStatsPanelModule(appState));
        initTimeControls();
        initModeToggle();
        initThirdPersonSceneMod(scene, controls, appState);
        
        // 设置初始相机位置
        camera.position.copy(THIRD_PERSON_CAMERA_POS);
        controls.target.copy(THIRD_PERSON_CAMERA_TARGET);
        controls.update();
        
        connectWebSocket(true);
        animate();
    } catch (e) {
        console.error('初始化失败:', e);
        alert('初始化失败: ' + e.message);
    }
}

init();

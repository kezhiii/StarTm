// ======================== 第三视角模块 ========================
import * as THREE from 'three';
import { DEG, RE_3D, RE_KM, SAT_SCALE, sharedResources } from '../config.js';
import { parseTimestamp, dateToJD, formatTimestamp } from '../math-utils.js';
import { initMoon } from '../moon-orbit.js';
import { clearSceneObjects } from '../../core/scene-utils.js';

const { EARTH_GEOM_3RD, EARTH_WIRE_MAT, GS_MARKER_GEOM, GS_MARKER_MAT, 
        SAT_GEOM_3RD, SAT_MAT_3RD, MOON_GEOM, ORBIT_RING_MAT } = sharedResources;

const DBG = {
    log: (...a) => console.log('[THIRD-PERSON]', ...a)
};

/**
 * 创建轨道环
 */
export function createOrbitRing(a, e, i, OMG, omg) {
    const points = [];
    const cosO = Math.cos(OMG), sinO = Math.sin(OMG);
    const cosI = Math.cos(i), sinI = Math.sin(i);
    const cosW = Math.cos(omg), sinW = Math.sin(omg);
    for (let f = 0; f <= 360; f++) {
        const fRad = f * DEG;
        const p = a * (1 - e * e);
        const r = p / (1 + e * Math.cos(fRad));
        const x_orb = r * Math.cos(fRad);
        const y_orb = r * Math.sin(fRad);
        const x = (cosO * cosW - sinO * sinW * cosI) * x_orb + (-cosO * sinW - sinO * cosW * cosI) * y_orb;
        const y = (sinO * cosW + cosO * sinW * cosI) * x_orb + (-sinO * sinW + cosO * cosW * cosI) * y_orb;
        const z = (sinW * sinI) * x_orb + (cosW * sinI) * y_orb;
        points.push(new THREE.Vector3(x * SAT_SCALE, z * SAT_SCALE, -y * SAT_SCALE));
    }
    return new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), ORBIT_RING_MAT);
}

/**
 * 经纬度转 3D 表面坐标
 */
function latLonToSurface3D(lat, lon) {
    const latR = lat * DEG, lonR = lon * DEG;
    return new THREE.Vector3(RE_3D * Math.cos(latR) * Math.cos(lonR), RE_3D * Math.sin(latR), -RE_3D * Math.cos(latR) * Math.sin(lonR));
}

/**
 * 初始化第三视角场景
 */
export function initThirdPersonScene(scene, controls, appState) {
    const { earthTextureLoaded, moonTextureLoaded } = appState.textures;
    const { csv, ws, sceneObjects } = appState;

    // 恢复原始FOV（从第一人称视角切换回来时）
    if (appState.camera && scene.userData.originalFOV !== undefined) {
        appState.camera.fov = scene.userData.originalFOV;
        appState.camera.updateProjectionMatrix();
    }

    // 注意：不要设置 scene.background 为纯色，否则会覆盖星空
    // 星空背景的恢复由 app.js 的 switchView 逻辑处理

    // 清理旧对象 (修复：正确传入 appState)
    clearSceneObjects(scene, appState.camera, appState);

    // 创建地球
    const earthMat = earthTextureLoaded 
        ? new THREE.MeshPhongMaterial({ map: earthTextureLoaded, specular: 0x333333, shininess: 5 }) 
        : new THREE.MeshPhongMaterial({ color: 0x2244aa, specular: 0x333333, shininess: 5 });
    
    sceneObjects.earth = new THREE.Mesh(EARTH_GEOM_3RD, earthMat);
    sceneObjects.earthGroup = new THREE.Group();
    sceneObjects.earthGroup.add(sceneObjects.earth);
    sceneObjects.earth.add(new THREE.LineSegments(new THREE.WireframeGeometry(EARTH_GEOM_3RD), EARTH_WIRE_MAT));
    scene.add(sceneObjects.earthGroup);

    // 地面站标记
    sceneObjects.groundStationMarker3D = new THREE.Mesh(GS_MARKER_GEOM, GS_MARKER_MAT);
    sceneObjects.earthGroup.add(sceneObjects.groundStationMarker3D);

    // 卫星网格 (22 颗)
    sceneObjects.satelliteMeshes3D = [];
    for (let i = 0; i < 22; i++) {
        // 修复：克隆材质，使每颗卫星的颜色独立
        const mesh = new THREE.Mesh(SAT_GEOM_3RD, SAT_MAT_3RD.clone());
        mesh.userData.satIdx = i;
        mesh.visible = false;
        scene.add(mesh);
        sceneObjects.satelliteMeshes3D.push(mesh);
    }

    // 轨道环
    sceneObjects.orbitRings = [];
    if (csv.satelliteData.length > 0) {
        csv.satelliteData[0].sats.forEach((sat) => {
            const ring = createOrbitRing(sat.a, sat.e, sat.i * DEG, sat.OMG * DEG, sat.omg * DEG);
            ring.visible = true;
            scene.add(ring);
            sceneObjects.orbitRings.push(ring);
        });
    }

    // 初始化月球 (使用模块化方法)
    initMoon(scene, appState);
    DBG.log('Moon initialized in Third Person View');

    // 控制器设置
    controls.autoRotate = false;
    controls.autoRotateSpeed = 0.5;
    controls.enableRotate = true;
    controls.enablePan = true;
    controls.enableZoom = true;
    controls.minDistance = RE_3D * 1.2;
    controls.maxDistance = RE_3D * 100; // 增加缩放限制，以便观察远处的月球 (真实距离约 60 倍半径)
    controls.enabled = true;

    // UI 更新
    document.getElementById('groundInfo').classList.remove('hidden');
    document.getElementById('info').querySelector('span').parentElement.parentElement.style.display = 'none';

    // 数据初始化
    if (ws.connection && ws.connection.readyState === WebSocket.OPEN && ws.lastStepData) {
        const d = parseTimestamp(ws.lastStepData[0][0]);
        appState.earthRotation.startJD = dateToJD(d.year, d.month, d.day, d.hour, d.minute, d.second);
        appState.earthRotation.startTime = performance.now();
        updateSatellitesThirdPersonWs(ws.lastStepData, sceneObjects, appState.interaction);
    } else if (csv.satelliteData.length > 0) {
        // CSV 模式：初始化地球自转基准时间
        const currentGroup = csv.satelliteData[csv.state.currentTimeIdx];
        if (currentGroup) {
            const d = parseTimestamp(currentGroup.timestamp);
            appState.earthRotation.startJD = dateToJD(d.year, d.month, d.day, d.hour, d.minute, d.second);
            appState.earthRotation.startTime = performance.now();
        }
        updateSatellitesThirdPerson(csv.state.currentTimeIdx, csv.satelliteData, sceneObjects, appState.interaction);
    }
}

/**
 * 更新第三视角卫星位置 (CSV 模式)
 */
export function updateSatellitesThirdPerson(timeIdx, satelliteData, sceneObjects, interaction, lightManager = null) {
    if (timeIdx < 0 || timeIdx >= satelliteData.length) return;
    const data = satelliteData[timeIdx];

    document.getElementById('coordDisplay').textContent =
        `纬度 ${interaction.currentLat.toFixed(1)}°  经度 ${interaction.currentLon.toFixed(1)}°  时间 ${formatTimestamp(data.timestamp)}`;

    data.sats.forEach((sat, idx) => {
        if (idx >= sceneObjects.satelliteMeshes3D.length) return;
        sceneObjects.satelliteMeshes3D[idx].visible = true;
        sceneObjects.satelliteMeshes3D[idx].position.set(
            sat.X * SAT_SCALE,
            sat.Z * SAT_SCALE,
            -sat.Y * SAT_SCALE
        );
    });
    for (let i = data.sats.length; i < sceneObjects.satelliteMeshes3D.length; i++) {
        sceneObjects.satelliteMeshes3D[i].visible = false;
    }

    // 应用灯光状态
    if (lightManager) {
        lightManager.applyAll();
    }
}

/**
 * 更新第三视角卫星位置 (WS 模式)
 */
export function updateSatellitesThirdPersonWs(stepData, sceneObjects, interaction, lightManager = null) {
    stepData.forEach((satData, idx) => {
        if (idx >= sceneObjects.satelliteMeshes3D.length) return;
        sceneObjects.satelliteMeshes3D[idx].visible = true;
        sceneObjects.satelliteMeshes3D[idx].position.set(
            satData[8] * SAT_SCALE,
            satData[10] * SAT_SCALE,
            -satData[9] * SAT_SCALE
        );
    });
    for (let i = stepData.length; i < sceneObjects.satelliteMeshes3D.length; i++) {
        sceneObjects.satelliteMeshes3D[i].visible = false;
    }

    document.getElementById('coordDisplay').textContent =
        `纬度 ${interaction.currentLat.toFixed(1)}°  经度 ${interaction.currentLon.toFixed(1)}°  时间 ${formatTimestamp(stepData[0][0])}`;

    // 应用灯光状态
    if (lightManager) {
        lightManager.applyAll();
    }
}

// ======================== 第三视角模块 ========================
import * as THREE from 'three';
import { DEG, RE_3D, SAT_SCALE, sharedResources } from '../config.js';
import { formatTimestamp, parseTimestamp, dateToJD, calcGMST } from '../math-utils.js';
import { initMoon } from '../moon-orbit.js';
import { buildSatelliteMesh, buildSatLabel, buildTextSprite, buildSelectionRing, applyScreenScale, placeSelectionRing } from '../sat-model.js';
import { buildGroundStationMarker, placeGroundStationMarker } from '../earth-rotation.js';
import { clearSceneObjects } from '../../core/scene-utils.js';
import { createLogger } from '../../core/logger.js';

const { EARTH_GEOM_3RD, EARTH_WIRE_MAT,
        SAT_MAT_3RD, ORBIT_RING_MAT } = sharedResources;

const log = createLogger('THIRD-PERSON');
let thirdCam = null;   // 本视角的相机，用于把卫星缩放到恒定屏幅与选中框朝向

/**
 * 卫星按相机距离缩放到恒定屏幅，并把选中框摆到当前选中的目标上。
 * 三条更新路径（CSV / WS / 插值）与外部驱动循环都调用它。
 */
export function updateThirdPersonDecor(sceneObjects, camera) {
    const cam = camera || thirdCam;
    const meshes = sceneObjects.satelliteMeshes3D;
    if (!cam || !meshes || !meshes.length) return;
    applyScreenScale(meshes, cam);
    const idx = sceneObjects.selectedSatIdx;
    placeSelectionRing(sceneObjects.selectionRing, idx == null ? null : meshes[idx], cam);

    const term = sceneObjects.terminator;
    const sun = meshes[0].parent && meshes[0].parent.userData.sunLight;
    if (term && sun) {
        term.quaternion.setFromUnitVectors(Z_AXIS, sun.position.clone().normalize());
    }
    (sceneObjects.orbitRings || []).forEach((ring, k) => {
        ring.material.color.setHex(k === idx ? 0x7fe3d6 : 0x4488ff);
        ring.material.opacity = idx == null || k === idx ? 0.75 : 0.4;
    });
}

/**
 * 当前帧对应的 GMST（无数据时为 0）
 */
function currentGmst(appState) {
    const ts = appState.csv.satelliteData[appState.csv.state.currentTimeIdx]?.timestamp
        || appState.ws.lastStepData?.[0]?.[0];
    if (!ts) return 0;
    const d = parseTimestamp(ts);
    return calcGMST(dateToJD(d.year, d.month, d.day, d.hour, d.minute, d.second));
}

/**
 * 创建轨道环
 */
const RING_STEPS = 360;   // 轨迹线的顶点数
const Z_AXIS = new THREE.Vector3(0, 0, 1);

/** 把根数写进轨道环顶点（原地改，避免每步重建几何） */
function fillOrbitRing(attr, a, e, i, OMG, omg) {
    const cosO = Math.cos(OMG), sinO = Math.sin(OMG);
    const cosI = Math.cos(i), sinI = Math.sin(i);
    const cosW = Math.cos(omg), sinW = Math.sin(omg);
    for (let f = 0; f <= RING_STEPS; f++) {
        const fRad = f * DEG;
        const p = a * (1 - e * e);
        const r = p / (1 + e * Math.cos(fRad));
        const x_orb = r * Math.cos(fRad);
        const y_orb = r * Math.sin(fRad);
        const x = (cosO * cosW - sinO * sinW * cosI) * x_orb + (-cosO * sinW - sinO * cosW * cosI) * y_orb;
        const y = (sinO * cosW + cosO * sinW * cosI) * x_orb + (-sinO * sinW + cosO * cosW * cosI) * y_orb;
        const z = (sinW * sinI) * x_orb + (cosW * sinI) * y_orb;
        attr.setXYZ(f, x * SAT_SCALE, z * SAT_SCALE, -y * SAT_SCALE);
    }
    attr.needsUpdate = true;
}

/**
 * 轨迹线改用数据里的真实位置画出：以当前步为中心取一整圈的历元，逐点写进线几何。
 *
 * 不用密切椭圆代替：J2 摄动下真实轨迹不是闭合椭圆（升交点每天进动约 1°），
 * 用当前根数画的椭圆虽然每步都在重算，但对近圆轨道几乎看不出变化，容易被当成
 * "轨道没更新"。直接连数据点既跟着走带移动，也是交付数据本身。
 */
const MU = 398600.4418;   // km^3/s^2

/** 帧间隔（s），从首末历元的时间戳反推：数据集换 60 s/1 s 都不用改这里 */
function frameStepSec(frames) {
    const toSec = (ts) => {
        const d = parseTimestamp(ts);
        return Date.UTC(d.year, d.month - 1, d.day, d.hour, d.minute, d.second) / 1000;
    };
    const n = frames.length;
    if (n < 2) return 1;
    const dt = (toSec(frames[n - 1].timestamp) - toSec(frames[0].timestamp)) / (n - 1);
    return Number.isFinite(dt) && dt > 0 ? dt : 1;
}

export function updateTrajectoryLines(sceneObjects, frames, idx) {
    const lines = sceneObjects.orbitRings;
    if (!lines || !lines.length || !frames || frames.length < 2) return;
    const cur = frames[Math.max(0, Math.min(idx, frames.length - 1))];
    const a0 = cur && cur.sats && cur.sats[0] && cur.sats[0].a;
    if (!Number.isFinite(a0)) return;
    const period = 2 * Math.PI * Math.sqrt(a0 * a0 * a0 / MU);             // s
    // 帧偏移按小数取并线性内插：60 s 稀疏集也能正好铺满一个轨道周期，
    // 整数 stride 向下取整会让覆盖圈数变成周期的数倍。
    const half = period / frameStepSec(frames) / 2;                        // 半周期的帧数
    const last = frames.length - 1;
    for (let i = 0; i < lines.length; i++) {
        const attr = lines[i].geometry.attributes.position;
        for (let k = 0; k <= RING_STEPS; k++) {
            const f = idx + (k - RING_STEPS / 2) / (RING_STEPS / 2) * half;
            const f0 = Math.floor(f), u = f - f0;
            const sa = frames[Math.max(0, Math.min(last, f0))].sats[i];
            const sb = frames[Math.max(0, Math.min(last, f0 + 1))].sats[i];
            if (!sa || !sb) continue;
            attr.setXYZ(k,
                (sa.X + (sb.X - sa.X) * u) * SAT_SCALE,
                (sa.Z + (sb.Z - sa.Z) * u) * SAT_SCALE,
                -(sa.Y + (sb.Y - sa.Y) * u) * SAT_SCALE);
        }
        attr.needsUpdate = true;
        lines[i].geometry.computeBoundingSphere();
    }
}

export function createOrbitRing(a, e, i, OMG, omg) {
    const points = [];
    const cosO = Math.cos(OMG), sinO = Math.sin(OMG);
    const cosI = Math.cos(i), sinI = Math.sin(i);
    const cosW = Math.cos(omg), sinW = Math.sin(omg);
    fillOrbitRing({ setXYZ: (idx, x, y, z) => points.push(new THREE.Vector3(x, y, z)) }, a, e, i, OMG, omg);
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(geo, ORBIT_RING_MAT.clone());   // 各自一份材质，选中星要单独着色
    return line;
}

/** 晨昏线：法线沿太阳方向的圆，半径略高于地表，由太阳星历方向摆放 */
export function buildTerminator() {
    const pts = [];
    for (let k = 0; k <= 256; k++) {
        const th = k / 256 * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(th) * RE_3D * 1.004, Math.sin(th) * RE_3D * 1.004, 0));
    }
    const line = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.9 }));
    line.renderOrder = 2;
    return line;
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
    // 大气边缘光：夜面也能读出地球轮廓，不至于糊成一块黑
    sceneObjects.earthGroup.add(new THREE.Mesh(
        new THREE.SphereGeometry(RE_3D * 1.04, 48, 24),
        new THREE.MeshBasicMaterial({
            color: 0x3f7fbf, transparent: true, opacity: 0.22,
            side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false,
        })
    ));
    scene.add(sceneObjects.earthGroup);

    // 地面站标记（贴地环 + 天顶光柱 + 站名），位置随地球自转
    sceneObjects.groundStationMarker3D = buildGroundStationMarker();
    const gsLabel = buildTextSprite('地面站', { scale: 13, color: 'rgba(242, 163, 60, 0.9)' });
    gsLabel.position.y = 9;
    sceneObjects.groundStationMarker3D.add(gsLabel);
    sceneObjects.earthGroup.add(sceneObjects.groundStationMarker3D);
    placeGroundStationMarker(sceneObjects.groundStationMarker3D, appState.interaction.currentLat, appState.interaction.currentLon, currentGmst(appState));

    thirdCam = appState.camera;
    sceneObjects.selectionRing = buildSelectionRing();
    scene.add(sceneObjects.selectionRing);
    sceneObjects.terminator = buildTerminator();
    scene.add(sceneObjects.terminator);

    // 卫星网格：CSV/外部驱动按数据里的星数建，WS 模式按后端星座数
    const csvSats = (appState.currentMode === 'csv' && csv.satelliteData.length)
        ? csv.satelliteData[0].sats : null;
    const satCount = csvSats ? csvSats.length : (appState.config?.satCount || 0);
    sceneObjects.satelliteMeshes3D = [];
    for (let i = 0; i < satCount; i++) {
        // 克隆材质使每颗星的着色独立；大小由 updateThirdPersonDecor 按相机距离逐帧给
        const mesh = buildSatelliteMesh(SAT_MAT_3RD.clone());
        mesh.userData.satIdx = i;
        // 编队间距 1 km，在此比例下三星重合为一点，只给一个组标签
        if (csvSats && i === 0) mesh.add(buildSatLabel('编队 TM0S1-3', { scale: 4, offset: 3.4 }));
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
    log.debug('Moon initialized in Third Person View');

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
    const groundInfo = document.getElementById('groundInfo');
    const info = document.getElementById('info');
    if (groundInfo) groundInfo.classList.remove('hidden');
    if (info) info.style.display = 'none';  // 第三视角隐藏卫星统计

    // 数据初始化检查（仅 WARN 级别输出）
    if (!ws.lastStepData && csv.satelliteData.length === 0) {
        log.warn('无可用数据，卫星将不显示');
    }
}

/**
 * 更新第三视角卫星位置 (CSV 模式)
 */
export function updateSatellitesThirdPerson(timeIdx, satelliteData, sceneObjects, interaction, lightManager = null) {
    if (timeIdx < 0 || timeIdx >= satelliteData.length) {
        return;
    }
    const data = satelliteData[timeIdx];

    // 优化：使用缓存的 DOM 元素
    const coordDisplay = document.getElementById('coordDisplay');
    if (coordDisplay) {
        coordDisplay.textContent =
            `纬度 ${interaction.currentLat.toFixed(1)}°  经度 ${interaction.currentLon.toFixed(1)}°  时间 ${formatTimestamp(data.timestamp)}`;
    }

    // 优化：批量更新卫星位置
    const meshes = sceneObjects.satelliteMeshes3D;
    const sats = data.sats;
    const satCount = Math.min(sats.length, meshes.length);
    
    for (let idx = 0; idx < satCount; idx++) {
        const sat = sats[idx];
        const mesh = meshes[idx];
        mesh.visible = true;
        mesh.position.set(
            sat.X * SAT_SCALE,
            sat.Z * SAT_SCALE,
            -sat.Y * SAT_SCALE
        );
    }
    
    // 隐藏多余卫星
    for (let i = sats.length; i < meshes.length; i++) {
        meshes[i].visible = false;
    }

    // 应用灯光状态
    if (lightManager) {
        lightManager.applyAll();
    }
    updateThirdPersonDecor(sceneObjects);
}

/**
 * 更新第三视角卫星位置 (WS 模式)
 */
export function updateSatellitesThirdPersonWs(stepData, sceneObjects, interaction, lightManager = null) {
    const meshes = sceneObjects.satelliteMeshes3D;
    const satCount = Math.min(stepData.length, meshes.length);
    
    for (let idx = 0; idx < satCount; idx++) {
        const satData = stepData[idx];
        const mesh = meshes[idx];
        mesh.visible = true;
        mesh.position.set(
            satData[8] * SAT_SCALE,
            satData[10] * SAT_SCALE,
            -satData[9] * SAT_SCALE
        );
    }
    
    for (let i = stepData.length; i < meshes.length; i++) {
        meshes[i].visible = false;
    }

    const coordDisplay = document.getElementById('coordDisplay');
    if (coordDisplay && stepData.length > 0) {
        coordDisplay.textContent =
            `纬度 ${interaction.currentLat.toFixed(1)}°  经度 ${interaction.currentLon.toFixed(1)}°  时间 ${formatTimestamp(stepData[0][0])}`;
    }

    // 应用灯光状态
    if (lightManager) {
        lightManager.applyAll();
    }
    updateThirdPersonDecor(sceneObjects);
}

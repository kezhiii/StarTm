// ======================== 主星视角模块 ========================
import * as THREE from 'three';
import { DEG, RE_KM, SAT_SCALE_CENTER, MAX_PAN_DISTANCE, sharedResources } from '../config.js';
import { parseTimestamp, dateToJD, calcGMST, formatTimestamp } from '../math-utils.js';

const { EARTH_CENTER_GEOM, CENTER_SAT_GEOM, CENTER_SAT_MAT, DEPUTY_SAT_GEOM, DEPUTY_SAT_MAT } = sharedResources;

/**
 * 更新主星视角相机位置
 */
export function updateCenterPersonCamera(camera, appState, cameraPanOffset, forceCenterPos) {
    if (appState.currentView !== 'center') return;

    const { sceneObjects } = appState;
    
    let centerPos = forceCenterPos;

    // 1. 如果没有强制指定坐标（例如来自插值计算），则尝试从主星标记读取
    if (!centerPos) {
        if (sceneObjects.centerSatMarker) {
            // 获取世界坐标
            sceneObjects.centerSatMarker.updateWorldMatrix(true, false);
            const worldPos = new THREE.Vector3();
            worldPos.setFromMatrixPosition(sceneObjects.centerSatMarker.matrixWorld);
            centerPos = { x: worldPos.x, y: worldPos.y, z: worldPos.z };
        } else if (appState.interpolation.currentInterpData) {
            const cs = appState.interpolation.currentInterpData[0];
            centerPos = { x: cs[8], y: cs[10], z: -cs[9] };
        } else {
            return;
        }
    }

    // 2. 计算径向方向
    const distToCenter = Math.sqrt(centerPos.x ** 2 + centerPos.y ** 2 + centerPos.z ** 2);
    if (distToCenter === 0) return;

    const radialDir = {
        x: centerPos.x / distToCenter,
        y: centerPos.y / distToCenter,
        z: centerPos.z / distToCenter
    };

    // 3. 设置相机位置（主星位置 + 径向偏移）
    const offsetDistance = 10;
    const basePos = new THREE.Vector3(
        centerPos.x + radialDir.x * offsetDistance,
        centerPos.y + radialDir.y * offsetDistance,
        centerPos.z + radialDir.z * offsetDistance
    );

    // 4. 应用拖拽偏移
    if (cameraPanOffset.length() > MAX_PAN_DISTANCE) {
        cameraPanOffset.setLength(MAX_PAN_DISTANCE);
    }

    camera.position.copy(basePos).add(cameraPanOffset);
    
    // 5. 看向主星
    camera.lookAt(centerPos.x, centerPos.y, centerPos.z);
}

/**
 * Initialize Center Person Scene
 */
export function initCenterPersonScene(scene, controls, appState) {
    scene.background = new THREE.Color(0x000022);
    
    const { textures, sceneObjects, ws, csv, earthRotation } = appState;

    const earthMat = textures.earthTextureLoaded 
        ? new THREE.MeshPhongMaterial({ map: textures.earthTextureLoaded, specular: 0x333333, shininess: 5 }) 
        : new THREE.MeshPhongMaterial({ color: 0x2244aa, specular: 0x333333, shininess: 5 });
        
    sceneObjects.earthRef = new THREE.Mesh(EARTH_CENTER_GEOM, earthMat);
    sceneObjects.earthRef.position.set(0, 0, 0);
    scene.add(sceneObjects.earthRef);

    sceneObjects.centerSatMarker = new THREE.Mesh(CENTER_SAT_GEOM, CENTER_SAT_MAT);
    scene.add(sceneObjects.centerSatMarker);

    sceneObjects.satelliteMeshesCenter = [];
    for (let i = 0; i < 21; i++) {
        const mesh = new THREE.Mesh(DEPUTY_SAT_GEOM, DEPUTY_SAT_MAT);
        mesh.userData.satIdx = i + 1;
        mesh.visible = false;
        scene.add(mesh);
        sceneObjects.satelliteMeshesCenter.push(mesh);
    }

    controls.autoRotate = false;
    controls.enabled = false;
    controls.enableRotate = false;
    controls.enablePan = false;
    controls.enableZoom = false;
    
    document.getElementById('lockViewGroup').style.display = 'block';
    document.getElementById('groundInfo').classList.remove('hidden');
    document.getElementById('info').querySelector('span').parentElement.parentElement.style.display = 'none';

    if (ws.connection && ws.connection.readyState === WebSocket.OPEN && ws.lastStepData) {
        const d = parseTimestamp(ws.lastStepData[0][0]);
        earthRotation.startJD = dateToJD(d.year, d.month, d.day, d.hour, d.minute, d.second);
        updateSatellitesCenterPersonWs(ws.lastStepData, appState);
    } else if (csv.satelliteData.length > 0) {
        updateSatellitesCenterPerson(csv.state.currentTimeIdx, appState);
    }
}

/**
 * Update Center Person Satellites (CSV)
 */
export function updateSatellitesCenterPerson(timeIdx, appState, camera, cameraPanOffset) {
    const data = appState.csv.satelliteData;
    if (timeIdx < 0 || timeIdx >= data.length) return;

    const group = data[timeIdx];
    const centerSat = group.sats[0];
    const { sceneObjects } = appState;

    const d = parseTimestamp(group.timestamp);
    const gmst = calcGMST(dateToJD(d.year, d.month, d.day, d.hour, d.minute, d.second));

    if (sceneObjects.earthRef) {
        sceneObjects.earthRef.position.set(0, 0, 0);
        sceneObjects.earthRef.rotation.y = gmst;
    }

    // Calculate main star position
    const centerPos = { x: centerSat.X * SAT_SCALE_CENTER, y: centerSat.Z * SAT_SCALE_CENTER, z: -centerSat.Y * SAT_SCALE_CENTER };
    
    // Update main star marker
    if (sceneObjects.centerSatMarker) {
        sceneObjects.centerSatMarker.position.set(centerPos.x, centerPos.y, centerPos.z);
        // 修复：立即更新矩阵，防止相机读取旧位置导致闪烁
        sceneObjects.centerSatMarker.updateMatrix();
        sceneObjects.centerSatMarker.updateWorldMatrix(true, false);
    }

    let visibleCount = 0;
    for (let i = 1; i < data.sats.length; i++) {
        const dX = (data.sats[i].X - centerSat.X) * SAT_SCALE_CENTER;
        const dY = (data.sats[i].Y - centerSat.Y) * SAT_SCALE_CENTER;
        const dZ = (data.sats[i].Z - centerSat.Z) * SAT_SCALE_CENTER;
        if (sceneObjects.satelliteMeshesCenter[i - 1]) {
            sceneObjects.satelliteMeshesCenter[i - 1].visible = true;
            sceneObjects.satelliteMeshesCenter[i - 1].position.set(centerPos.x + dX, centerPos.y + dZ, centerPos.z - dY);
            if (dZ > -0.5) visibleCount++;
        }
    }
    for (let i = data.sats.length - 1; i < sceneObjects.satelliteMeshesCenter.length; i++) {
        if (sceneObjects.satelliteMeshesCenter[i]) sceneObjects.satelliteMeshesCenter[i].visible = false;
    }

    document.getElementById('coordDisplay').textContent = `纬度 ${appState.interaction.currentLat.toFixed(1)}°  经度 ${appState.interaction.currentLon.toFixed(1)}°  时间 ${formatTimestamp(group.timestamp)}`;
    document.getElementById('visibleCount').textContent = visibleCount;
    document.getElementById('timeDisplay').textContent = formatTimestamp(group.timestamp);

    // Update camera position (Pass the calculated centerPos directly)
    if (camera) {
        updateCenterPersonCamera(camera, appState, cameraPanOffset, centerPos);
    }
}

/**
 * Update Center Person Satellites (WS)
 */
export function updateSatellitesCenterPersonWs(stepData, appState, camera, cameraPanOffset) {
    const centerSat = stepData[0];
    const { sceneObjects } = appState;

    // Calculate main star position
    const centerPos = { x: centerSat[8], y: centerSat[10], z: -centerSat[9] };
    
    if (sceneObjects.centerSatMarker) {
        sceneObjects.centerSatMarker.position.set(centerPos.x, centerPos.y, centerPos.z);
    }

    let visibleCount = 0;
    for (let i = 1; i < stepData.length; i++) {
        const dX = (stepData[i][8] - centerSat[8]) * SAT_SCALE_CENTER;
        const dY = (stepData[i][9] - centerSat[9]) * SAT_SCALE_CENTER;
        const dZ = (stepData[i][10] - centerSat[10]) * SAT_SCALE_CENTER;
        if (sceneObjects.satelliteMeshesCenter[i - 1]) {
            sceneObjects.satelliteMeshesCenter[i - 1].visible = true;
            sceneObjects.satelliteMeshesCenter[i - 1].position.set(centerPos.x + dX, centerPos.y + dZ, centerPos.z - dY);
            if (dZ > -0.5) visibleCount++;
        }
    }
    for (let i = stepData.length - 1; i < sceneObjects.satelliteMeshesCenter.length; i++) {
        if (sceneObjects.satelliteMeshesCenter[i]) sceneObjects.satelliteMeshesCenter[i].visible = false;
    }

    document.getElementById('coordDisplay').textContent = `纬度 ${appState.interaction.currentLat.toFixed(1)}°  经度 ${appState.interaction.currentLon.toFixed(1)}°  时间 ${formatTimestamp(stepData[0][0])}`;
    document.getElementById('visibleCount').textContent = visibleCount;
    document.getElementById('timeDisplay').textContent = formatTimestamp(stepData[0][0]);

    // Update camera position (Pass the calculated centerPos directly)
    if (camera) {
        updateCenterPersonCamera(camera, appState, cameraPanOffset, centerPos);
    }
}

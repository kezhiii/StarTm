// ======================== 主星视角模块 ========================
import * as THREE from 'three';
import { DEG, SAT_SCALE_CENTER, MAX_PAN_DISTANCE, sharedResources } from '../config.js';
import { parseTimestamp, dateToJD, calcGMST, formatTimestamp } from '../math-utils.js';
import { buildSatelliteMesh, buildSatLabel } from '../sat-model.js';

const { EARTH_CENTER_GEOM, CENTER_SAT_MAT, DEPUTY_SAT_MAT } = sharedResources;

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
    // 注意：不要设置 scene.background 为纯色，否则会覆盖星空
    // 星空背景的恢复由 app.js 的 switchView 逻辑处理

    const { textures, sceneObjects, ws, csv, earthRotation } = appState;

    const earthMat = textures.earthTextureLoaded
        ? new THREE.MeshPhongMaterial({ map: textures.earthTextureLoaded, specular: 0x333333, shininess: 5 })
        : new THREE.MeshPhongMaterial({ color: 0x2244aa, specular: 0x333333, shininess: 5 });

    sceneObjects.earthRef = new THREE.Mesh(EARTH_CENTER_GEOM, earthMat);
    sceneObjects.earthRef.position.set(0, 0, 0);
    scene.add(sceneObjects.earthRef);

    // CSV/编队数据：跟随星与从星都按数据里的星数建；此视角 1 单位 = 1 km，
    // 模型不缩小就会互相压住，故取 0.25（≈2.5 m 观感）
    const csvSats = (appState.currentMode === 'csv' && csv.satelliteData.length)
        ? csv.satelliteData[0].sats : null;
    const satCount = csvSats ? csvSats.length : (appState.config?.satCount || 0);
    const modelScale = csvSats ? 0.25 : 1;

    sceneObjects.centerSatMarker = buildSatelliteMesh(CENTER_SAT_MAT.clone());
    sceneObjects.centerSatMarker.scale.setScalar(modelScale);
    if (csvSats) sceneObjects.centerSatMarker.add(buildSatLabel(`TM0S${csvSats[0].sat_id}`, { scale: 3.2, offset: 9 }));
    scene.add(sceneObjects.centerSatMarker);

    sceneObjects.satelliteMeshesCenter = [];
    for (let i = 1; i < satCount; i++) {
        const mesh = buildSatelliteMesh(DEPUTY_SAT_MAT.clone());
        mesh.scale.setScalar(modelScale);
        mesh.userData.satIdx = i;
        if (csvSats) mesh.add(buildSatLabel(`TM0S${csvSats[i].sat_id}`, { scale: 3.2, offset: 9 }));
        mesh.visible = false;
        scene.add(mesh);
        sceneObjects.satelliteMeshesCenter.push(mesh);
    }

    controls.autoRotate = false;
    controls.enabled = false;
    controls.enableRotate = false;
    controls.enablePan = false;
    controls.enableZoom = false;

    const lockViewGroup = document.getElementById('lockViewGroup');
    const groundInfo = document.getElementById('groundInfo');
    const info = document.getElementById('info');
    
    if (lockViewGroup) lockViewGroup.style.display = 'block';
    if (groundInfo) groundInfo.classList.remove('hidden');
    if (info) info.style.display = 'none';  // 主星视角隐藏卫星统计

    // 修复：初始化地球自转基准时间和相机位置
    if (ws.connection && ws.connection.readyState === WebSocket.OPEN && ws.lastStepData) {
        const d = parseTimestamp(ws.lastStepData[0][0]);
        earthRotation.startJD = dateToJD(d.year, d.month, d.day, d.hour, d.minute, d.second);
        earthRotation.startTime = performance.now();
        // 注意：相机更新由 switchView 中的调用完成，这里只初始化卫星位置
        updateSatellitesCenterPersonWs(ws.lastStepData, appState, null, null);
    } else if (csv.satelliteData.length > 0) {
        // CSV 模式：初始化地球自转基准时间
        const currentGroup = csv.satelliteData[csv.state.currentTimeIdx];
        if (currentGroup) {
            const d = parseTimestamp(currentGroup.timestamp);
            // 关键修复：只在播放状态下设置 startTime，否则地球会意外自转
            if (csv.state.isPlaying) {
                earthRotation.startJD = dateToJD(d.year, d.month, d.day, d.hour, d.minute, d.second);
                earthRotation.startTime = performance.now();
            }
            // 注意：相机更新由 switchView 中的调用完成，这里只初始化卫星位置
            updateSatellitesCenterPerson(csv.state.currentTimeIdx, appState, null, null);
        }
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
    const { sceneObjects, earthRotation } = appState;

    const d = parseTimestamp(group.timestamp);
    const gmst = calcGMST(dateToJD(d.year, d.month, d.day, d.hour, d.minute, d.second));

    if (sceneObjects.earthRef) {
        sceneObjects.earthRef.position.set(0, 0, 0);
        sceneObjects.earthRef.rotation.y = gmst;
    }

    // 计算主星位置
    const centerPos = { x: centerSat.X * SAT_SCALE_CENTER, y: centerSat.Z * SAT_SCALE_CENTER, z: -centerSat.Y * SAT_SCALE_CENTER };

    // 更新主星标记
    if (sceneObjects.centerSatMarker) {
        sceneObjects.centerSatMarker.position.set(centerPos.x, centerPos.y, centerPos.z);
        sceneObjects.centerSatMarker.updateMatrix();
        sceneObjects.centerSatMarker.updateWorldMatrix(true, false);
        // 主星灯光状态（索引 0）
        const lightMgr = appState.lightManager;
        if (lightMgr) {
            const isMainLightOn = lightMgr.getLightState(0);
            if (isMainLightOn) {
                sceneObjects.centerSatMarker.material.emissive.setHex(0xffdd44);
                sceneObjects.centerSatMarker.material.emissiveIntensity = 0.6;
                sceneObjects.centerSatMarker.material.color.setHex(0xffff00);
            } else {
                sceneObjects.centerSatMarker.material.emissive.setHex(0x000000);
                sceneObjects.centerSatMarker.material.emissiveIntensity = 0;
                sceneObjects.centerSatMarker.material.color.setHex(0xffff00);
            }
        }
    }

    let visibleCount = 0;
    const lightMgr = appState.lightManager;
    for (let i = 1; i < group.sats.length; i++) {
        const dX = (group.sats[i].X - centerSat.X) * SAT_SCALE_CENTER;
        const dY = (group.sats[i].Y - centerSat.Y) * SAT_SCALE_CENTER;
        const dZ = (group.sats[i].Z - centerSat.Z) * SAT_SCALE_CENTER;
        const meshIdx = i - 1;
        if (sceneObjects.satelliteMeshesCenter[meshIdx]) {
            sceneObjects.satelliteMeshesCenter[meshIdx].visible = true;
            sceneObjects.satelliteMeshesCenter[meshIdx].position.set(centerPos.x + dX, centerPos.y + dZ, centerPos.z - dY);
            
            // 应用灯光状态（数据索引 i 对应灯光状态 i）
            if (lightMgr) {
                const isLightOn = lightMgr.getLightState(i);
                if (isLightOn) {
                    sceneObjects.satelliteMeshesCenter[meshIdx].material.emissive.setHex(0xffdd44);
                    sceneObjects.satelliteMeshesCenter[meshIdx].material.emissiveIntensity = 0.6;
                    sceneObjects.satelliteMeshesCenter[meshIdx].material.color.setHex(0xffff00);
                } else {
                    sceneObjects.satelliteMeshesCenter[meshIdx].material.emissive.setHex(0x000000);
                    sceneObjects.satelliteMeshesCenter[meshIdx].material.emissiveIntensity = 0;
                    sceneObjects.satelliteMeshesCenter[meshIdx].material.color.setHex(0x00ff00);
                }
            }
            
            visibleCount++;
        }
    }
    for (let i = group.sats.length - 1; i < sceneObjects.satelliteMeshesCenter.length; i++) {
        if (sceneObjects.satelliteMeshesCenter[i]) sceneObjects.satelliteMeshesCenter[i].visible = false;
    }

    const domCache = appState.domCache;
    const coordDisplay = domCache ? domCache.get('coordDisplay') : document.getElementById('coordDisplay');
    const visibleCountEl = domCache ? domCache.get('visibleCount') : document.getElementById('visibleCount');
    const timeDisplayEl = domCache ? domCache.get('timeDisplay') : document.getElementById('timeDisplay');
    
    if (coordDisplay) coordDisplay.textContent = `纬度 ${appState.interaction.currentLat.toFixed(1)}°  经度 ${appState.interaction.currentLon.toFixed(1)}°  时间 ${formatTimestamp(group.timestamp)}`;
    if (visibleCountEl) visibleCountEl.textContent = visibleCount;
    if (timeDisplayEl) timeDisplayEl.textContent = formatTimestamp(group.timestamp);

    // 相机跟随主星位置
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
        // 主星灯光状态（索引 0）
        const lightMgr = appState.lightManager;
        if (lightMgr) {
            const isMainLightOn = lightMgr.getLightState(0);
            if (isMainLightOn) {
                sceneObjects.centerSatMarker.material.emissive.setHex(0xffdd44);
                sceneObjects.centerSatMarker.material.emissiveIntensity = 0.6;
                sceneObjects.centerSatMarker.material.color.setHex(0xffff00);
            } else {
                sceneObjects.centerSatMarker.material.emissive.setHex(0x000000);
                sceneObjects.centerSatMarker.material.emissiveIntensity = 0;
                sceneObjects.centerSatMarker.material.color.setHex(0xffff00);
            }
        }
    }

    let visibleCount = 0;
    for (let i = 1; i < stepData.length; i++) {
        const dX = (stepData[i][8] - centerSat[8]) * SAT_SCALE_CENTER;
        const dY = (stepData[i][9] - centerSat[9]) * SAT_SCALE_CENTER;
        const dZ = (stepData[i][10] - centerSat[10]) * SAT_SCALE_CENTER;
        const meshIdx = i - 1;
        if (sceneObjects.satelliteMeshesCenter[meshIdx]) {
            sceneObjects.satelliteMeshesCenter[meshIdx].visible = true;
            sceneObjects.satelliteMeshesCenter[meshIdx].position.set(centerPos.x + dX, centerPos.y + dZ, centerPos.z - dY);
            
            // 应用灯光状态（数据索引 i 对应灯光状态 i）
            const lightMgr = appState.lightManager;
            if (lightMgr) {
                const isLightOn = lightMgr.getLightState(i);
                if (isLightOn) {
                    sceneObjects.satelliteMeshesCenter[meshIdx].material.emissive.setHex(0xffdd44);
                    sceneObjects.satelliteMeshesCenter[meshIdx].material.emissiveIntensity = 0.6;
                    sceneObjects.satelliteMeshesCenter[meshIdx].material.color.setHex(0xffff00);
                } else {
                    sceneObjects.satelliteMeshesCenter[meshIdx].material.emissive.setHex(0x000000);
                    sceneObjects.satelliteMeshesCenter[meshIdx].material.emissiveIntensity = 0;
                    sceneObjects.satelliteMeshesCenter[meshIdx].material.color.setHex(0x00ff00);
                }
            }
            
            visibleCount++;
        }
    }
    for (let i = stepData.length - 1; i < sceneObjects.satelliteMeshesCenter.length; i++) {
        if (sceneObjects.satelliteMeshesCenter[i]) sceneObjects.satelliteMeshesCenter[i].visible = false;
    }

    const domCache = appState.domCache;
    const coordDisplay = domCache ? domCache.get('coordDisplay') : document.getElementById('coordDisplay');
    const visibleCountEl = domCache ? domCache.get('visibleCount') : document.getElementById('visibleCount');
    const timeDisplayEl = domCache ? domCache.get('timeDisplay') : document.getElementById('timeDisplay');
    
    if (coordDisplay) coordDisplay.textContent = `纬度 ${appState.interaction.currentLat.toFixed(1)}°  经度 ${appState.interaction.currentLon.toFixed(1)}°  时间 ${formatTimestamp(stepData[0][0])}`;
    if (visibleCountEl) visibleCountEl.textContent = visibleCount;
    if (timeDisplayEl) timeDisplayEl.textContent = formatTimestamp(stepData[0][0]);

    // Update camera position (Pass the calculated centerPos directly)
    if (camera) {
        updateCenterPersonCamera(camera, appState, cameraPanOffset, centerPos);
    }
}

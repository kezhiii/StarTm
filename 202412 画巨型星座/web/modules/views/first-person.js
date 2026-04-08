// ======================== 第一视角模块 ========================
import * as THREE from 'three';
import { DEG, RE_KM, sharedResources } from '../config.js';
import { parseTimestamp, dateToJD, calcGMST, eciToEcef, ecefToLocal, formatTimestamp } from '../math-utils.js';

const { SKY_GEOM, SKY_MAT, HORIZON_PLANE_GEOM, HORIZON_PLANE_MAT, 
        HORIZON_RING_GEOM, HORIZON_RING_MAT, GS_MARKER_1ST_GEOM, GS_MARKER_1ST_MAT,
        SAT_GEOM_1ST, SAT_MAT_1ST } = sharedResources;

/**
 * 添加箭头辅助线
 */
function addArrowTo(group, from, to, color) {
    group.add(new THREE.ArrowHelper(to.clone().sub(from).normalize(), from, from.distanceTo(to), color, 20, 15));
}

/**
 * 初始化第一视角场景
 */
export function initFirstPersonScene(scene, controls, appState) {
    scene.background = new THREE.Color(0x0a0a1a);

    const { sceneObjects, ws, csv, earthRotation } = appState;

    scene.add(new THREE.Mesh(SKY_GEOM, SKY_MAT));

    sceneObjects.horizonPlane = new THREE.Mesh(HORIZON_PLANE_GEOM, HORIZON_PLANE_MAT);
    sceneObjects.horizonPlane.rotation.x = -Math.PI / 2;
    scene.add(sceneObjects.horizonPlane);
    
    sceneObjects.horizonRing = new THREE.Mesh(HORIZON_RING_GEOM, HORIZON_RING_MAT);
    sceneObjects.horizonRing.rotation.x = -Math.PI / 2;
    scene.add(sceneObjects.horizonRing);

    sceneObjects.gridGroup = new THREE.Group();
    const gridMat = new THREE.LineBasicMaterial({ color: 0x333366, transparent: true, opacity: 0.3 });
    [30, 60, 90].forEach(el => {
        const r = 2000 * Math.cos(el * DEG), y = 2000 * Math.sin(el * DEG);
        const pts = new THREE.EllipseCurve(0, 0, r, r, 0, 2 * Math.PI, false, 0).getPoints(64);
        sceneObjects.gridGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts.map(p => new THREE.Vector3(p.x, y, p.y))), gridMat));
    });
    for (let az = 0; az < 360; az += 30) {
        const azR = az * DEG, pts = [];
        for (let el = 0; el <= 90; el += 5) {
            const r = 2000 * Math.cos(el * DEG), y = 2000 * Math.sin(el * DEG);
            pts.push(new THREE.Vector3(r * Math.sin(azR), y, -r * Math.cos(azR)));
        }
        sceneObjects.gridGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), gridMat));
    }
    scene.add(sceneObjects.gridGroup);

    sceneObjects.arrowGroup = new THREE.Group();
    addArrowTo(sceneObjects.arrowGroup, new THREE.Vector3(0, 0, -100), new THREE.Vector3(0, 0, -250), 0xff0000);
    addArrowTo(sceneObjects.arrowGroup, new THREE.Vector3(100, 0, 0), new THREE.Vector3(250, 0, 0), 0x00ff00);
    addArrowTo(sceneObjects.arrowGroup, new THREE.Vector3(0, 100, 0), new THREE.Vector3(0, 250, 0), 0x0066ff);
    scene.add(sceneObjects.arrowGroup);

    sceneObjects.groundStationMarker1D = new THREE.Mesh(GS_MARKER_1ST_GEOM, GS_MARKER_1ST_MAT);
    sceneObjects.groundStationMarker1D.position.set(0, 0, 0);
    scene.add(sceneObjects.groundStationMarker1D);

    sceneObjects.satelliteMeshes1D = [];
    for (let i = 0; i < 22; i++) {
        const mesh = new THREE.Mesh(SAT_GEOM_1ST, SAT_MAT_1ST);
        mesh.userData.satIdx = i;
        mesh.visible = false;
        scene.add(mesh);
        sceneObjects.satelliteMeshes1D.push(mesh);
    }

    controls.enabled = false;
    document.getElementById('groundInfo').classList.add('hidden');
    document.getElementById('info').querySelector('span').parentElement.parentElement.style.display = '';


    if (ws.connection && ws.connection.readyState === WebSocket.OPEN && ws.lastStepData) {
        const d = parseTimestamp(ws.lastStepData[0][0]);
        earthRotation.startJD = dateToJD(d.year, d.month, d.day, d.hour, d.minute, d.second);
        updateSatellitesFirstPersonWs(ws.lastStepData, appState);
    } else if (csv.satelliteData.length > 0) {
        updateSatellitesFirstPerson(csv.state.currentTimeIdx, appState);
    }
}

/**
 * 更新第一视角相机 (鼠标拖拽)
 */
export function updateFirstPersonCamera(camera, appState) {
    camera.position.set(0, 0, 0);
    const elRad = appState.interaction.fpElevation * DEG;
    const lookAtTarget = new THREE.Vector3(
        Math.cos(elRad) * Math.sin(appState.interaction.fpAzimuth), 
        Math.sin(elRad), 
        Math.cos(elRad) * Math.cos(appState.interaction.fpAzimuth)
    );
    camera.lookAt(lookAtTarget);
}

/**
 * 更新第一视角卫星位置 (CSV)
 */
export function updateSatellitesFirstPerson(timeIdx, appState) {
    const data = appState.csv.satelliteData;
    if (timeIdx < 0 || timeIdx >= data.length) return;
    
    const group = data[timeIdx];
    const { currentLat, currentLon } = appState.interaction;
    const { sceneObjects } = appState;
    
    const d = parseTimestamp(group.timestamp);
    const gmst = calcGMST(dateToJD(d.year, d.month, d.day, d.hour, d.minute, d.second));
    let visibleCount = 0;
    
    group.sats.forEach((sat, idx) => {
        if (idx >= sceneObjects.satelliteMeshes1D.length) return;
        const ecef = eciToEcef(sat.X, sat.Y, sat.Z, gmst);
        const local = ecefToLocal(ecef.x, ecef.y, ecef.z, currentLat, currentLon);
        sceneObjects.satelliteMeshes1D[idx].visible = true;
        if (local.el >= 0) { 
            sceneObjects.satelliteMeshes1D[idx].material.color.setHex(0x00ff00); 
            visibleCount++; 
        } else {
            sceneObjects.satelliteMeshes1D[idx].material.color.setHex(0xff3333);
        }
        const displayDist = local.range;
        const azR = local.az * DEG, elR = Math.max(local.el, -10) * DEG;
        sceneObjects.satelliteMeshes1D[idx].position.set(
            displayDist * Math.cos(elR) * Math.sin(azR), 
            displayDist * Math.sin(elR), 
            -displayDist * Math.cos(elR) * Math.cos(azR)
        );
    });
    for (let i = data.sats.length; i < sceneObjects.satelliteMeshes1D.length; i++) {
        sceneObjects.satelliteMeshes1D[i].visible = false;
    }
    document.getElementById('visibleCount').textContent = visibleCount;
    document.getElementById('timeDisplay').textContent = formatTimestamp(group.timestamp);
}

/**
 * 更新第一视角卫星位置 (WS)
 */
export function updateSatellitesFirstPersonWs(stepData, appState) {
    const d = parseTimestamp(stepData[0][0]);
    const gmst = calcGMST(dateToJD(d.year, d.month, d.day, d.hour, d.minute, d.second));
    const { currentLat, currentLon } = appState.interaction;
    const { sceneObjects } = appState;
    
    let visibleCount = 0;
    stepData.forEach((satData, idx) => {
        if (idx >= sceneObjects.satelliteMeshes1D.length) return;
        const ecef = eciToEcef(satData[8], satData[9], satData[10], gmst);
        const local = ecefToLocal(ecef.x, ecef.y, ecef.z, currentLat, currentLon);
        sceneObjects.satelliteMeshes1D[idx].visible = true;
        if (local.el >= 0) { 
            sceneObjects.satelliteMeshes1D[idx].material.color.setHex(0x00ff00); 
            visibleCount++; 
        } else {
            sceneObjects.satelliteMeshes1D[idx].material.color.setHex(0xff3333);
        }
        const displayDist = local.range;
        const azR = local.az * DEG, elR = Math.max(local.el, -10) * DEG;
        sceneObjects.satelliteMeshes1D[idx].position.set(
            displayDist * Math.cos(elR) * Math.sin(azR), 
            displayDist * Math.sin(elR), 
            -displayDist * Math.cos(elR) * Math.cos(azR)
        );
    });
    for (let i = stepData.length; i < sceneObjects.satelliteMeshes1D.length; i++) {
        sceneObjects.satelliteMeshes1D[i].visible = false;
    }
    document.getElementById('visibleCount').textContent = visibleCount;
}

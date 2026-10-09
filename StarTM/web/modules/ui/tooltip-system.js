// ======================== Tooltip 系统模块 ========================
import * as THREE from 'three';
import { RE_KM } from '../config.js';

let tooltip = null;
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let lastTooltipKey = null;
let tooltipMeshes = [];

/**
 * 初始化 Tooltip
 */
export function initTooltip(sceneObjects, camera, renderer, appState) {
    tooltip = document.createElement('div');
    tooltip.id = 'satellite-tooltip';
    tooltip.style.cssText = `position:fixed;display:none;background:rgba(0,0,0,0.85);color:#fff;padding:8px 12px;border-radius:4px;font-size:12px;z-index:1000;pointer-events:none;border:1px solid #444;max-width:200px;`;
    document.body.appendChild(tooltip);
    renderer.domElement.addEventListener('mousemove', (event) => {
        onMouseMove(event, sceneObjects, camera, appState);
    });
    // 点击选中：把星号交给外部驱动页面（飞行模拟仿真系统靠它联动参数与相机）
    renderer.domElement.addEventListener('click', (event) => {
        const idx = pickSatIdx(event, sceneObjects, camera, appState);
        if (idx !== null && window.__simbridge && window.__simbridge.onPick) window.__simbridge.onPick(idx);
    });
}

/**
 * 射线拾取：返回命中的网格索引（与 sceneObjects 数组同序），未命中返回 null
 */
function pickSatIdx(event, sceneObjects, camera, appState) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    tooltipMeshes.length = 0;
    const { satelliteMeshes3D, satelliteMeshes1D, centerSatMarker, satelliteMeshesCenter } = sceneObjects;
    if (appState.currentView === 'third') {
        for (let i = 0; i < satelliteMeshes3D.length; i++) {
            if (satelliteMeshes3D[i] && satelliteMeshes3D[i].visible) tooltipMeshes.push(satelliteMeshes3D[i]);
        }
    } else if (appState.currentView === 'first') {
        for (let i = 0; i < satelliteMeshes1D.length; i++) {
            if (satelliteMeshes1D[i] && satelliteMeshes1D[i].visible) tooltipMeshes.push(satelliteMeshes1D[i]);
        }
    } else {
        if (centerSatMarker && centerSatMarker.visible) tooltipMeshes.push(centerSatMarker);
        for (let i = 0; i < satelliteMeshesCenter.length; i++) {
            if (satelliteMeshesCenter[i] && satelliteMeshesCenter[i].visible) tooltipMeshes.push(satelliteMeshesCenter[i]);
        }
    }
    const hits = raycaster.intersectObjects(tooltipMeshes);
    if (!hits.length) return null;
    const hitObj = hits[0].object;
    // 组合模型（箱体+翼+发光面）命中到的是子网格，星号挂在父组上
    const idx = hitObj.userData.satIdx ?? hitObj.parent?.userData.satIdx;
    return idx === undefined ? null : idx;
}

/**
 * 悬停显示卫星简要遥测
 */
function onMouseMove(event, sceneObjects, camera, appState) {
    const satIdx = pickSatIdx(event, sceneObjects, camera, appState);
    if (satIdx === null) {
        lastTooltipKey = null;
        tooltip.style.display = 'none';
        return;
    }
    let data = null;
    if (appState.currentMode === 'ws' && appState.ws.lastStepData) {
        const sd = appState.ws.lastStepData[satIdx];
        if (!sd) return;
        data = { sat_id: satIdx, X: sd[8], Y: sd[9], Z: sd[10], Vx: sd[11], Vy: sd[12], Vz: sd[13], a: sd[2], e: sd[3], i: sd[4] };
    } else {
        data = appState.csv.satelliteData[appState.csv.state.currentTimeIdx]?.sats[satIdx];
    }
    if (!data) return;
    const alt = Math.sqrt(data.X**2 + data.Y**2 + data.Z**2) - RE_KM;
    const vel = Math.sqrt(data.Vx**2 + data.Vy**2 + data.Vz**2);
    const tooltipKey = `${data.sat_id}-${data.X.toFixed(1)}-${data.Y.toFixed(1)}-${data.Z.toFixed(1)}`;
    if (tooltipKey !== lastTooltipKey) {
        lastTooltipKey = tooltipKey;
        tooltip.innerHTML = `<div>卫星 #${data.sat_id}</div><div>高度: ${alt.toFixed(1)} km</div><div>速度: ${vel.toFixed(2)} km/s</div><div>a=${data.a?.toFixed(1) || '--'} km, e=${data.e?.toFixed(4) || '--'}</div><div>i=${data.i?.toFixed(2) || '--'}°</div>`;
    }
    tooltip.style.display = 'block';
    tooltip.style.left = (event.clientX + 15) + 'px';
    tooltip.style.top = (event.clientY + 15) + 'px';
}

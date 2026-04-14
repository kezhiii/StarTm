// ======================== 场景工具函数 ========================
import * as THREE from 'three';
import { sharedResources } from '../modules/config.js';

/**
 * 清理场景对象
 */
export function clearSceneObjects(scene, camera, appState) {
    const toRemove = [];
    const starField = appState?.sceneObjects?.starField;
    
    scene.traverse(child => {
        if (child === scene || child === camera ||
            child instanceof THREE.AmbientLight || child instanceof THREE.DirectionalLight) {
            return;
        }
        if (child.userData && child.userData.isStarField) {
            return;
        }
        if (starField && child === starField) {
            return;
        }
        toRemove.push(child);
    });

    const sharedRes = new Set(Object.values(sharedResources));
    toRemove.forEach(obj => {
        try {
            if (obj.parent) obj.parent.remove(obj);
            if (obj.geometry && !sharedRes.has(obj.geometry)) obj.geometry.dispose();
            if (obj.material) {
                const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
                mats.forEach(m => { if (!sharedRes.has(m)) m.dispose(); });
            }
        } catch (e) {
            // 开发环境输出警告，帮助发现潜在 bug
            if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'development') {
                console.warn('[SCENE] 清理对象失败:', e.message || e);
            }
        }
    });

    const so = appState.sceneObjects;
    so.orbitRings = []; so.satelliteMeshes3D = []; so.satelliteMeshes1D = [];
    so.satelliteMeshesCenter = [];
    so.earth = null; so.earthGroup = null; so.groundStationMarker3D = null;
    so.horizonPlane = null; so.horizonRing = null; so.groundStationMarker1D = null;
    so.centerSatMarker = null; so.earthRef = null; so.gridGroup = null; so.arrowGroup = null;
}

/**
 * 更新轨道环
 */
export function updateOrbitRings(scene, appState, createOrbitRingFn, DEG) {
    const satData = appState.csv?.satelliteData;
    if (!satData || satData.length === 0) return;

    if (appState.sceneObjects?.orbitRings) {
        appState.sceneObjects.orbitRings.forEach(ring => {
            if (ring.parent) ring.parent.remove(ring);
            if (ring.geometry) ring.geometry.dispose();
        });
        appState.sceneObjects.orbitRings = [];
    }

    if (satData.length > 0 && satData[0].sats && satData[0].sats.length > 0) {
        satData[0].sats.forEach((sat) => {
            const ring = createOrbitRingFn(sat.a, sat.e, sat.i * DEG, sat.OMG * DEG, sat.omg * DEG);
            ring.visible = true;
            scene.add(ring);
            appState.sceneObjects.orbitRings.push(ring);
        });
    }
}

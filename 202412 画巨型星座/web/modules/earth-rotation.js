// ======================== 地球自转系统模块 ========================
import { DEG, RE_3D } from './config.js';
import { calcGMST } from './math-utils.js';
import * as THREE from 'three';

/**
 * 经纬度转 3D 表面坐标
 */
export function latLonToSurface3D(lat, lon) {
    const latR = lat * DEG, lonR = lon * DEG;
    return new THREE.Vector3(
        RE_3D * Math.cos(latR) * Math.cos(lonR),
        RE_3D * Math.sin(latR),
        -RE_3D * Math.cos(latR) * Math.sin(lonR)
    );
}

/**
 * 更新地球自转（连续插值）
 */
export function updateEarthRotation(appState, sceneObjects) {
    const { earthRotation, interaction } = appState;
    
    // 只有在播放状态下才更新地球自转
    if (earthRotation.startTime === null || earthRotation.startJD === null) return;
    
    const elapsedSec = (performance.now() - earthRotation.startTime) / 1000;
    const currentJD = earthRotation.startJD + (elapsedSec * earthRotation.speedFactor / 86400);
    const gmst = calcGMST(currentJD);
    
    // 更新地球旋转
    if (sceneObjects.earth && sceneObjects.earth.parent) {
        sceneObjects.earth.rotation.y = gmst;
    }
    if (sceneObjects.earthRef && sceneObjects.earthRef.parent) {
        sceneObjects.earthRef.rotation.y = gmst;
    }
    
    // 更新地面站标记位置，使其随地球一起旋转
    if (sceneObjects.groundStationMarker3D && sceneObjects.earth && sceneObjects.earth.parent) {
        const gsPos = latLonToSurface3D(interaction.currentLat, interaction.currentLon);
        gsPos.applyAxisAngle(new THREE.Vector3(0, 1, 0), gmst);
        sceneObjects.groundStationMarker3D.position.copy(gsPos);
    }
}

/**
 * 初始化地球自转系统
 */
export function initEarthRotation(appState) {
    return {
        reset() {
            appState.earthRotation.startTime = null;
            appState.earthRotation.startJD = null;
            appState.earthRotation.speedFactor = 1;
        },
        
        setStartTime(time) {
            appState.earthRotation.startTime = time;
        },
        
        setStartJD(jd) {
            appState.earthRotation.startJD = jd;
        },
        
        setSpeedFactor(factor) {
            appState.earthRotation.speedFactor = factor;
        }
    };
}

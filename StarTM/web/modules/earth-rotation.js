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

const UP = new THREE.Vector3(0, 1, 0);

/**
 * 地面站标记：贴地圆环 +  outward 光柱，总览比例下仍能认出站点位置
 */
export function buildGroundStationMarker() {
    const accent = 0xf2a33c;
    const g = new THREE.Group();

    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 8), new THREE.MeshBasicMaterial({ color: accent }));
    g.add(dot);

    const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.35, 7, 10, 1, true),
        new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false })
    );
    beam.position.y = 3.8;
    g.add(beam);

    const ring = new THREE.Mesh(
        new THREE.RingGeometry(1.6, 1.95, 40),
        new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.65, side: THREE.DoubleSide, depthWrite: false })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.12;
    g.add(ring);

    return g;
}

/**
 * 放置地面站标记：位置随地球自转，光柱沿当地天顶方向
 */
export function placeGroundStationMarker(marker, lat, lon, gmst) {
    const surface = latLonToSurface3D(lat, lon);
    marker.position.copy(surface.clone().applyAxisAngle(UP, gmst));
    marker.quaternion.setFromUnitVectors(UP, surface.clone().normalize().applyAxisAngle(UP, gmst));
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
        placeGroundStationMarker(sceneObjects.groundStationMarker3D, interaction.currentLat, interaction.currentLon, gmst);
    }
}



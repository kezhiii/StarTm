// ======================== 常量与配置 ========================
import * as THREE from 'three';

export const DEG = Math.PI / 180;
export const RE_KM = 6378.137;
export const RE_3D = 50;
export const SAT_SCALE = RE_3D / RE_KM;
export const SAT_SCALE_CENTER = 1;

// 相机位置常量
export const THIRD_PERSON_CAMERA_POS = new THREE.Vector3(RE_3D * 3, RE_3D * 1.5, RE_3D * 3);
export const THIRD_PERSON_CAMERA_TARGET = new THREE.Vector3(0, 0, 0);
export const FIRST_PERSON_CAMERA_POS = new THREE.Vector3(0, 0, 0);
export const FIRST_PERSON_CAMERA_TARGET = new THREE.Vector3(0, 0, 100);

// 交互常量
export const MAX_PAN_DISTANCE = 3;
export const WS_MAX_QUEUE_SIZE = 3600;

// 共享几何体与材质（全局单例，减少内存浪费）
export const sharedResources = {
    // 卫星相关
    SAT_GEOM_3RD: new THREE.SphereGeometry(0.1, 16, 16),
    SAT_MAT_3RD: new THREE.MeshBasicMaterial({ color: 0x00ff00 }),
    SAT_GEOM_1ST: new THREE.SphereGeometry(2, 8, 8),
    SAT_MAT_1ST: new THREE.MeshBasicMaterial({ color: 0x00ff00 }),
    CENTER_SAT_GEOM: new THREE.SphereGeometry(0.1, 16, 16),
    CENTER_SAT_MAT: new THREE.MeshBasicMaterial({ color: 0xffff00 }),
    DEPUTY_SAT_GEOM: new THREE.SphereGeometry(0.1, 8, 8),
    DEPUTY_SAT_MAT: new THREE.MeshBasicMaterial({ color: 0x00ff88 }),
    
    // 轨道环
    ORBIT_RING_MAT: new THREE.LineBasicMaterial({ color: 0x4488ff, transparent: true, opacity: 0.5 }),
    
    // 地球相关
    EARTH_GEOM_3RD: new THREE.SphereGeometry(RE_3D, 64, 32),
    EARTH_WIRE_MAT: new THREE.LineBasicMaterial({ color: 0x4488cc, transparent: true, opacity: 0.15 }),
    EARTH_CENTER_GEOM: new THREE.SphereGeometry(RE_KM, 64, 32),
    GS_MARKER_GEOM: new THREE.SphereGeometry(1.2, 16, 16),
    GS_MARKER_MAT: new THREE.MeshBasicMaterial({ color: 0xffff00 }),
    GS_MARKER_1ST_GEOM: new THREE.SphereGeometry(8, 16, 16),
    GS_MARKER_1ST_MAT: new THREE.MeshBasicMaterial({ color: 0xffff00 }),
    
    // 天体/环境
    MOON_GEOM: new THREE.SphereGeometry(RE_3D * 0.25, 32, 16),
    SKY_GEOM: new THREE.SphereGeometry(3000, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    SKY_MAT: new THREE.MeshBasicMaterial({ color: 0x0a0a2a, side: THREE.BackSide, transparent: true, opacity: 0.3 }),
    HORIZON_PLANE_GEOM: new THREE.CircleGeometry(3000, 64),
    HORIZON_PLANE_MAT: new THREE.MeshBasicMaterial({ color: 0x1a3a1a, side: THREE.DoubleSide, transparent: true, opacity: 0.5 }),
    HORIZON_RING_GEOM: new THREE.RingGeometry(2980, 3000, 64),
    HORIZON_RING_MAT: new THREE.MeshBasicMaterial({ color: 0x00ff00, side: THREE.DoubleSide, transparent: true, opacity: 0.6 }),
};

// 纹理 URL
export const TEXTURE_URLS = {
    earth: 'https://unpkg.com/three-globe@2.31.1/example/img/earth-blue-marble.jpg',
    moon: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/FullMoon2010.jpg/1200px-FullMoon2010.jpg'
};

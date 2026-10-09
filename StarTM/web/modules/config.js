// ======================== 常量与配置 ========================
import * as THREE from 'three';

export const DEG = Math.PI / 180;
export const RE_KM = 6378.137;
export const RE_3D = 50;
export const SAT_SCALE = RE_3D / RE_KM;
export const SAT_SCALE_CENTER = 1;

// 相机位置常量（第三视角以地球为主视觉，机位拉近到 1.55 倍地心距）
export const THIRD_PERSON_CAMERA_POS = new THREE.Vector3(RE_3D * 1.55, RE_3D * 0.55, RE_3D * 1.55);
export const THIRD_PERSON_CAMERA_TARGET = new THREE.Vector3(0, 0, 0);
export const FIRST_PERSON_CAMERA_POS = new THREE.Vector3(0, 0, 0);
export const FIRST_PERSON_CAMERA_TARGET = new THREE.Vector3(0, 0, 100);

// 交互常量
export const MAX_PAN_DISTANCE = 3;
export const WS_MAX_QUEUE_SIZE = 3600;

// 星空粒子系统配置
export const STAR_COUNT = 3000;
export const STAR_FIELD_SIZE = 8000;

// 共享资源单例（懒加载，避免在无 WebGL 环境立即初始化）
let _sharedResources = null;

/**
 * 获取共享资源单例（懒加载）
 * 首次调用时才会创建 Three.js 对象，支持 SSR/测试环境
 */
export function getSharedResources() {
    if (!_sharedResources) {
        _sharedResources = {
            // 卫星相关（第三/主星视角的模型由 sat-model 组装，这里只提供材质模板）
            SAT_MAT_3RD: new THREE.MeshPhongMaterial({ color: 0x00ff00 }),
            SAT_GEOM_1ST: new THREE.SphereGeometry(0.002, 8, 8),
            SAT_MAT_1ST: new THREE.MeshPhongMaterial({ color: 0x00ff00 }),
            CENTER_SAT_MAT: new THREE.MeshPhongMaterial({ color: 0xffff00 }),
            DEPUTY_SAT_MAT: new THREE.MeshPhongMaterial({ color: 0x00ff88 }),

            // 轨道环
            ORBIT_RING_MAT: new THREE.LineBasicMaterial({ color: 0x4488ff, transparent: true, opacity: 0.5 }),

            // 地球相关
            EARTH_GEOM_3RD: new THREE.SphereGeometry(RE_3D, 64, 32),
            EARTH_WIRE_MAT: new THREE.LineBasicMaterial({ color: 0x4488cc, transparent: true, opacity: 0.07 }),
            EARTH_CENTER_GEOM: new THREE.SphereGeometry(RE_KM, 64, 32),
            GS_MARKER_1ST_GEOM: new THREE.SphereGeometry(8, 16, 16),
            GS_MARKER_1ST_MAT: new THREE.MeshBasicMaterial({ color: 0xffff00 }),

            // 天体/环境
            MOON_GEOM: new THREE.SphereGeometry(RE_3D * 0.25, 32, 16),
            SKY_GEOM: new THREE.SphereGeometry(5000, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
            SKY_MAT: new THREE.MeshBasicMaterial({ color: 0x0a0a2a, side: THREE.BackSide, transparent: true, opacity: 0.3 }),
            HORIZON_PLANE_GEOM: new THREE.CircleGeometry(3000, 64),
            HORIZON_PLANE_MAT: new THREE.MeshBasicMaterial({ color: 0x1a3a1a, side: THREE.DoubleSide, transparent: true, opacity: 0.5 }),
            HORIZON_RING_GEOM: new THREE.RingGeometry(2980, 3000, 64),
            HORIZON_RING_MAT: new THREE.MeshBasicMaterial({ color: 0x00ff00, side: THREE.DoubleSide, transparent: true, opacity: 0.6 }),
        };
    }
    return _sharedResources;
}

// 向后兼容：保持导出，但首次访问时才触发懒加载
export const sharedResources = new Proxy({}, {
    get(target, prop) {
        const resources = getSharedResources();
        return resources[prop];
    }
});

// 纹理 URL
export const TEXTURE_URLS = {
    earth: 'https://unpkg.com/three-globe@2.31.1/example/img/earth-blue-marble.jpg',
    moon: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/FullMoon2010.jpg/1200px-FullMoon2010.jpg'
};

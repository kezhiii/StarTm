// ======================== 月球轨道模块 ========================
import * as THREE from 'three';
import { RE_3D, RE_KM, sharedResources } from './config.js';
import { dateToJD } from './math-utils.js';

// 真实物理常数
const MOON_DISTANCE_KM = 384400; // 地月平均距离（公里）
const MOON_DISTANCE_RATIO = MOON_DISTANCE_KM / RE_KM; // 约 60.27 倍地球半径
const MOON_ORBITAL_PERIOD_MS = 27.32 * 24 * 3600 * 1000; // 恒星月周期：27.32 天

/**
 * 初始化月球并添加到场景
 * @param {THREE.Scene} scene 
 * @param {Object} appState 
 */
export function initMoon(scene, appState) {
    const { MOON_GEOM } = sharedResources;
    const moonTexture = appState.textures.moonTextureLoaded;

    const material = moonTexture
        ? new THREE.MeshPhongMaterial({ map: moonTexture })
        : new THREE.MeshPhongMaterial({ color: 0xcccccc });

    const moon = new THREE.Mesh(MOON_GEOM, material);

    // 初始位置（后续在 update 中更新）
    const dist = RE_3D * MOON_DISTANCE_RATIO;
    moon.position.set(dist, 0, 0);

    // 初始化 userData 用于插值
    moon.userData = {
        initialized: false,
        prevPos: { x: dist, y: 0, z: 0 },
        targetPos: { x: dist, y: 0, z: 0 }
    };

    scene.add(moon);

    // 保存到全局状态
    appState.sceneObjects.moon = moon;

    return moon;
}

/**
 * 根据给定的起始时间和经过的时间计算月球ECI坐标
 * @param {number} startJD - 起始儒略日
 * @param {number} elapsedMs - 从起始时间经过的毫秒数（模拟时间）
 * @returns {Object} 月球ECI坐标（米）
 */
export function calcMoonECI(startJD, elapsedMs) {
    const simulatedTime = elapsedMs;
    const angularVelocity = (2 * Math.PI) / MOON_ORBITAL_PERIOD_MS;
    const angle = simulatedTime * angularVelocity + Math.PI;

    const radius = RE_3D * MOON_DISTANCE_RATIO;
    const inclinationRad = 5.14 * (Math.PI / 180);

    const x = radius * Math.cos(angle);
    const z = radius * Math.sin(angle);
    const y = Math.sin(angle) * Math.sin(inclinationRad) * radius;

    // 将场景单位转换为米
    const SCALE = RE_KM * 1000 / 50;

    // Three.js Scene: X=DataX, Y=DataZ, Z=-DataY
    return {
        x: x * SCALE,
        y: -z * SCALE,
        z: y * SCALE
    };
}

/**
 * 根据给定的数据时间戳计算月球ECI坐标（用于插值模式）
 * @param {Object} dataTimestamp - 数据时间戳 {year, month, day, hour, minute, second}
 * @param {number} startJD - 起始儒略日
 * @param {number} speedFactor - 速度因子（未使用，保留接口兼容性）
 * @returns {Object|null} 月球ECI坐标（米），如果 startJD 为 null 则返回 null
 */
export function calcMoonECIForDataTimestamp(dataTimestamp, startJD, speedFactor) {
    if (startJD === null) return null;

    // 计算数据时间戳对应的儒略日
    const dataJD = dateToJD(dataTimestamp.year, dataTimestamp.month, dataTimestamp.day,
                           dataTimestamp.hour, dataTimestamp.minute, dataTimestamp.second);

    // 关键修复：计算从基准时间到数据时间的真实时间差（毫秒）
    // 注意：这里使用真实时间差， NOT 应用 speedFactor
    // 原因：数据时间戳是真实世界时间，月球位置应该基于真实时间计算
    // speedFactor 只用于控制播放速度（帧率），不应该影响天体运动计算
    const realElapsedMs = (dataJD - startJD) * 24 * 3600 * 1000;

    const angularVelocity = (2 * Math.PI) / MOON_ORBITAL_PERIOD_MS;
    const angle = realElapsedMs * angularVelocity + Math.PI;

    const radius = RE_3D * MOON_DISTANCE_RATIO;
    const inclinationRad = 5.14 * (Math.PI / 180);

    const x = radius * Math.cos(angle);
    const z = radius * Math.sin(angle);
    const y = Math.sin(angle) * Math.sin(inclinationRad) * radius;

    // 将场景单位转换为米
    const SCALE = RE_KM * 1000 / 50;

    return {
        x: x * SCALE,
        y: -z * SCALE,
        z: y * SCALE
    };
}

/**
 * 更新月球公转位置
 * 逻辑：
 * 1. 获取经过时间因子缩放后的模拟时间
 * 2. 根据模拟时间计算公转角度
 * 3. 更新坐标
 */
export function updateMoon(appState) {
    const moon = appState.sceneObjects.moon;
    if (!moon) return;

    const { startTime, speedFactor } = appState.earthRotation;
    if (startTime === null) return;

    const realElapsed = performance.now() - startTime;
    const simulatedTime = realElapsed * speedFactor;

    const angularVelocity = (2 * Math.PI) / MOON_ORBITAL_PERIOD_MS;
    // 添加初始相位偏移 (Math.PI)，使月球起始位置位于地球暗面（背向太阳方向），模拟满月效果
    const angle = simulatedTime * angularVelocity + Math.PI;

    const radius = RE_3D * MOON_DISTANCE_RATIO;
    const inclinationRad = 5.14 * (Math.PI / 180);

    const x = radius * Math.cos(angle);
    const z = radius * Math.sin(angle);
    const y = Math.sin(angle) * Math.sin(inclinationRad) * radius;

    // ... existing code ...
    moon.position.set(x, y, z);

    // 关键修复：将场景单位转换为米，以匹配卫星数据格式 (CSV/WS 均为米)
    // 比例因子 = 地球真实半径(米) / 场景地球半径(50)
    const SCALE = RE_KM * 1000 / 50; // 约 127,562 倍

    // 存储月球的 ECI 坐标 (Data Format: X, Y, Z) -> 单位：米
    // Three.js Scene: X=DataX, Y=DataZ, Z=-DataY
    appState.moonECI = {
        x: x * SCALE,
        y: -z * SCALE,
        z: y * SCALE
    };

    // 潮汐锁定：月球始终以同一面朝向地球中心 (0,0,0)
    moon.lookAt(0, 0, 0);
}

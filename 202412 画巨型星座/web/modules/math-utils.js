// ======================== 数学与坐标工具函数 ========================
import { DEG, RE_KM } from './config.js';

/**
 * 线性插值
 */
export function lerp(a, b, t) {
    return a + (b - a) * t;
}

/**
 * 日期转儒略日
 */
export function dateToJD(year, month, day, hour, minute, second) {
    let y = year, m = month;
    if (m <= 2) { y -= 1; m += 12; }
    const A = Math.floor(y / 100);
    const B = 2 - A + Math.floor(A / 4);
    return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + B - 1524.5 + (hour + minute / 60 + second / 3600) / 24;
}

/**
 * 计算格林尼治平恒星时
 */
export function calcGMST(JD) {
    let GMST = 280.46061837 + 360.98564736629 * (JD - 2451545.0);
    GMST = ((GMST % 360) + 360) % 360;
    return GMST * DEG;
}

/**
 * ECI (惯性系) 转 ECEF (地固系)
 */
export function eciToEcef(X, Y, Z, gmst) {
    const c = Math.cos(gmst), s = Math.sin(gmst);
    return { x: X * c + Y * s, y: -X * s + Y * c, z: Z };
}

/**
 * ECEF 转本地地平坐标 (方位角/仰角/距离)
 * 注意：输入的 x, y, z 应该与 RE_KM 单位一致（公里）
 */
export function ecefToLocal(x, y, z, lat, lon) {
    const latR = lat * DEG, lonR = lon * DEG;
    const xs = RE_KM * Math.cos(latR) * Math.cos(lonR);
    const ys = RE_KM * Math.cos(latR) * Math.sin(lonR);
    const zs = RE_KM * Math.sin(latR);
    const dx = x - xs, dy = y - ys, dz = z - zs;
    const sinL = Math.sin(latR), cosL = Math.cos(latR);
    const sinN = Math.sin(lonR), cosN = Math.cos(lonR);
    const s = sinL * cosN * dx + sinL * sinN * dy - cosL * dz;
    const e = -sinN * dx + cosN * dy;
    const zUp = cosL * cosN * dx + cosL * sinN * dy + sinL * dz;
    const range = Math.sqrt(s * s + e * e + zUp * zUp);
    // 防止除零
    if (range === 0) return { az: 0, el: 90, range: 0 };
    const el = Math.asin(zUp / range) / DEG;
    let az = Math.atan2(e, -s) / DEG;
    if (az < 0) az += 360;
    return { az, el, range };
}

/**
 * ECI 相对位置转 Hill 坐标 (RSW 帧)
 * @param {Object} chief - 主星 {X, Y, Z, Vx, Vy, Vz}
 * @param {Object} deputy - 从星 {X, Y, Z}
 * @returns {Object} {radial, alongTrack, crossTrack} (km)
 */
export function eciToHill(chief, deputy) {
    // 相对位置
    const dx = deputy.X - chief.X;
    const dy = deputy.Y - chief.Y;
    const dz = deputy.Z - chief.Z;
    
    // R: 径向单位向量 (沿位置矢量)
    const rChief = Math.sqrt(chief.X ** 2 + chief.Y ** 2 + chief.Z ** 2);
    const rHat = { x: chief.X / rChief, y: chief.Y / rChief, z: chief.Z / rChief };
    
    // 速度矢量
    const vChief = { x: chief.Vx, y: chief.Vy, z: chief.Vz };
    
    // W: 法向单位向量 (轨道面法向 = R × V)
    const h = cross(rHat, vChief);
    const hLen = Math.sqrt(h.x ** 2 + h.y ** 2 + h.z ** 2);
    const wHat = { x: h.x / hLen, y: h.y / hLen, z: h.z / hLen };
    
    // S: 沿轨单位向量 (W × R)
    const sHat = cross(wHat, rHat);
    
    // 投影到 Hill 帧
    const rel = { x: dx, y: dy, z: dz };
    return {
        radial: dot(rel, rHat),
        alongTrack: dot(rel, sHat),
        crossTrack: dot(rel, wHat)
    };
}

/**
 * 向量归一化
 */
export function normalize(v) {
    const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    if (len === 0) return { x: 0, y: 0, z: 1 };
    return { x: v.x / len, y: v.y / len, z: v.z / len };
}

/**
 * 向量叉乘
 */
export function cross(a, b) {
    return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}

/**
 * 向量点乘
 */
export function dot(a, b) {
    return a.x * b.x + a.y * b.y + a.z * b.z;
}

/**
 * 解析时间戳字符串
 */
export function parseTimestamp(ts) {
    const s = String(ts);
    return {
        year: parseInt(s.substring(0, 4), 10),
        month: parseInt(s.substring(4, 6), 10),
        day: parseInt(s.substring(6, 8), 10),
        hour: parseInt(s.substring(8, 10), 10),
        minute: parseInt(s.substring(10, 12), 10),
        second: parseInt(s.substring(12, 14), 10)
    };
}

/**
 * 格式化时间戳
 */
export function formatTimestamp(ts) {
    const d = parseTimestamp(ts);
    return `${d.year}-${String(d.month).padStart(2,'0')}-${String(d.day).padStart(2,'0')} ${String(d.hour).padStart(2,'0')}:${String(d.minute).padStart(2,'0')}:${String(d.second).padStart(2,'0')}`;
}

/**
 * 将 ECEF 方向向量投影到观察者处的 SEZ (South-East-Zenith) 切平面
 * @param {Object} dir - ECEF 方向向量 {x, y, z}（单位向量或任意长度）
 * @param {number} latDeg - 观察者纬度 (度)
 * @param {number} lonDeg - 观察者经度 (度)
 * @returns {Object} {south, east, zenith}
 */
export function projectToSEZ(dir, latDeg, lonDeg) {
    const latR = latDeg * DEG;
    const lonR = lonDeg * DEG;
    const sinLat = Math.sin(latR), cosLat = Math.cos(latR);
    const sinLon = Math.sin(lonR), cosLon = Math.cos(lonR);
    return {
        south:  sinLat * cosLon * dir.x + sinLat * sinLon * dir.y - cosLat * dir.z,
        east:  -sinLon * dir.x + cosLon * dir.y,
        zenith: cosLat * cosLon * dir.x + cosLat * sinLon * dir.y + sinLat * dir.z
    };
}

/**
 * 计算 Hill 帧到地面观察者视角的旋转补偿角
 *
 * Hill 帧的沿轨 (S) 和法向 (W) 方向在地面观察者的方位角/仰角平面上
 * 通常不是水平和垂直的。本函数计算这个旋转角，使得在匹配前对图案
 * 施加反向旋转后，地面观察者看到的图案是正的。
 *
 * @param {Object} chief - 主星 ECI 状态 {X, Y, Z, Vx, Vy, Vz} (km, km/s)
 * @param {number} observerLat - 观察者纬度 (度)
 * @param {number} observerLon - 观察者经度 (度)
 * @param {number} gmst - 格林尼治平恒星时 (弧度)
 * @returns {number} 补偿角 (度)，用于 rotatePoints
 */
export function computeHillToGroundRotation(chief, observerLat, observerLon, gmst) {
    // 1. 构建 Hill 帧基向量 (ECI)
    const rLen = Math.sqrt(chief.X ** 2 + chief.Y ** 2 + chief.Z ** 2);
    const rHat = { x: chief.X / rLen, y: chief.Y / rLen, z: chief.Z / rLen };

    // h = r × v (轨道角动量方向)
    const hx = chief.Y * chief.Vz - chief.Z * chief.Vy;
    const hy = chief.Z * chief.Vx - chief.X * chief.Vz;
    const hz = chief.X * chief.Vy - chief.Y * chief.Vx;
    const hLen = Math.sqrt(hx ** 2 + hy ** 2 + hz ** 2);
    const wHat = { x: hx / hLen, y: hy / hLen, z: hz / hLen };

    // S = W × R (沿轨方向)
    const sHat = {
        x: wHat.y * rHat.z - wHat.z * rHat.y,
        y: wHat.z * rHat.x - wHat.x * rHat.z,
        z: wHat.x * rHat.y - wHat.y * rHat.x
    };

    // 2. ECI → ECEF 旋转
    const sEcef = eciToEcef(sHat.x, sHat.y, sHat.z, gmst);
    const wEcef = eciToEcef(wHat.x, wHat.y, wHat.z, gmst);

    // 3. 投影到观察者 SEZ 切平面
    const sSEZ = projectToSEZ(sEcef, observerLat, observerLon);
    const wSEZ = projectToSEZ(wEcef, observerLat, observerLon);

    // 边缘情况：编队接近天顶（仰角 > 85°）
    // 此时方位角定义不稳定，水平投影消失时无法确定旋转角
    const sHoriz = Math.sqrt(sSEZ.south ** 2 + sSEZ.east ** 2);
    const wHoriz = Math.sqrt(wSEZ.south ** 2 + wSEZ.east ** 2);

    if (sHoriz < 0.01 && wHoriz < 0.01) {
        console.warn('[ROTATION] 编队接近天顶，跳过地面视角补偿');
        return 0;
    }

    // 4. 计算沿轨方向在 az/el 平面上的投影角
    const phiS = Math.atan2(sSEZ.east, -sSEZ.south);

    // 补偿角 = -phiS
    const phiComp = -phiS;

    // 转换为角度（rotatePoints 使用角度制）
    return phiComp / DEG;
}

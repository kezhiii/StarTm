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
 * 将 Hill 帧的沿轨 (S) 和法向 (W) 方向投影到观察者的视线平面
 * （垂直于观察者→卫星连线的平面），计算 S 方向在该平面上的旋转角。
 *
 * 与旧版的区别：旧版投影到 SEZ 水平面，当卫星仰角较高时误差很大。
 * 新版投影到视线平面，正确反映观察者看到的图案旋转。
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

    // 3. 投影到观察者 SEZ 帧
    const sSEZ = projectToSEZ(sEcef, observerLat, observerLon);

    // 4. 计算观察者→卫星的视线向量 (SEZ 帧)
    // 先将主星 ECEF 位置转为本地坐标，获取方位角和仰角
    const chiefEcef = eciToEcef(chief.X, chief.Y, chief.Z, gmst);
    const local = ecefToLocal(chiefEcef.x, chiefEcef.y, chiefEcef.z, observerLat, observerLon);
    const azRad = local.az * DEG;
    const elRad = local.el * DEG;

    // 地平线以下：跳过补偿
    if (local.el < 0) {
        console.warn('[ROTATION] 编队在地平线以下，跳过地面视角补偿');
        return 0;
    }

    // 视线单位向量 (SEZ: S=南, E=东, Z=天顶)
    // 方位角从北顺时针：az=0→北(-S), az=90→东(+E), az=180→南(+S)
    const losS = -Math.cos(elRad) * Math.cos(azRad);
    const losE = Math.cos(elRad) * Math.sin(azRad);
    const losZ = Math.sin(elRad);

    // 5. 构建视线平面坐标系
    // "上"方向：天顶在视线平面上的投影
    const zenithDotLos = losZ; // zenith = (0,0,1), dot los = losZ
    let upS = -zenithDotLos * losS;
    let upE = -zenithDotLos * losE;
    let upZ = 1 - zenithDotLos * losZ;
    const upLen = Math.sqrt(upS * upS + upE * upE + upZ * upZ);
    if (upLen < 0.01) {
        console.warn('[ROTATION] 编队接近天顶，跳过地面视角补偿');
        return 0;
    }
    upS /= upLen; upE /= upLen; upZ /= upLen;

    // "右"方向：los × up
    const rightS = losE * upZ - losZ * upE;
    const rightE = losZ * upS - losS * upZ;
    const rightZ = losS * upE - losE * upS;

    // 6. 将 Hill 帧的 S 和 W 投影到视线平面 (right, up)
    const sProjRight = sSEZ.south * rightS + sSEZ.east * rightE + sSEZ.zenith * rightZ;
    const sProjUp = sSEZ.south * upS + sSEZ.east * upE + sSEZ.zenith * upZ;

    // 7. 计算 S 方向在视线平面上的旋转角（从 "上" 到 "右"）
    const phiS = Math.atan2(sProjRight, sProjUp);

    // 补偿角 = -phiS
    const phiComp = -phiS;

    // 转换为角度
    return phiComp / DEG;
}

/**
 * 计算 Hill→LOS 完整投影矩阵的逆矩阵 M⁻¹。
 * 
 * 将 shape 乘以 M⁻¹ 得到 Hill 空间中应该点亮卫星的位置，
 * 使观察者在地面看到正确的图案：
 *   M⁻¹(shape_in_SW) → Hill 空间卫星位置
 *   观察者看到: M(Hill_sat_positions) = shape_in_SW
 *
 * @param {Object} chief - 主星 ECI 状态 {X, Y, Z, Vx, Vy, Vz}
 * @param {number} observerLat - 观察者纬度 (度)
 * @param {number} observerLon - 观察者经度 (度)
 * @param {number} gmst - 格林尼治平恒星时 (弧度)
 * @returns {Object|null} { a, b, c, d } | null (不可见时返回 null)
 *   其中 M⁻¹ = [[a, b], [c, d]]
 *   shape_corrected_x = a * x_shape + b * y_shape
 *   shape_corrected_y = c * x_shape + d * y_shape
 */
export function computeHillToGroundMatrix(chief, observerLat, observerLon, gmst) {
    const rLen = Math.sqrt(chief.X ** 2 + chief.Y ** 2 + chief.Z ** 2);
    const rHat = { x: chief.X / rLen, y: chief.Y / rLen, z: chief.Z / rLen };
    const hx = chief.Y * chief.Vz - chief.Z * chief.Vy;
    const hy = chief.Z * chief.Vx - chief.X * chief.Vz;
    const hz = chief.X * chief.Vy - chief.Y * chief.Vx;
    const hLen = Math.sqrt(hx ** 2 + hy ** 2 + hz ** 2);
    const wHat = { x: hx / hLen, y: hy / hLen, z: hz / hLen };
    const sHat = {
        x: wHat.y * rHat.z - wHat.z * rHat.y,
        y: wHat.z * rHat.x - wHat.x * rHat.z,
        z: wHat.x * rHat.y - wHat.y * rHat.x
    };

    const sEcef = eciToEcef(sHat.x, sHat.y, sHat.z, gmst);
    const wEcef = eciToEcef(wHat.x, wHat.y, wHat.z, gmst);

    const sSEZ = projectToSEZ(sEcef, observerLat, observerLon);
    const wSEZ = projectToSEZ(wEcef, observerLat, observerLon);

    const chiefEcef = eciToEcef(chief.X, chief.Y, chief.Z, gmst);
    const local = ecefToLocal(chiefEcef.x, chiefEcef.y, chiefEcef.z, observerLat, observerLon);
    const elRad = local.el * DEG;
    if (local.el < 0) { console.warn('[MATRIX] 编队在地平线以下，跳过补偿'); return null; }
    const azRad = local.az * DEG;

    const losS = -Math.cos(elRad) * Math.cos(azRad);
    const losE =  Math.cos(elRad) * Math.sin(azRad);
    const losZ =  Math.sin(elRad);

    const zdot = losZ;
    let upS = -zdot * losS, upE = -zdot * losE, upZ = 1 - zdot * losZ;
    const upLen = Math.sqrt(upS*upS + upE*upE + upZ*upZ);
    if (upLen < 0.01) { console.warn('[MATRIX] 编队接近天顶，跳过补偿'); return null; }
    upS /= upLen; upE /= upLen; upZ /= upLen;

    const rS = losE*upZ - losZ*upE;
    const rE = losZ*upS - losS*upZ;
    const rZ = losS*upE - losE*upS;

    const sR = sSEZ.south*rS + sSEZ.east*rE + sSEZ.zenith*rZ;
    const sU = sSEZ.south*upS + sSEZ.east*upE + sSEZ.zenith*upZ;
    const wR = wSEZ.south*rS + wSEZ.east*rE + wSEZ.zenith*rZ;
    const wU = wSEZ.south*upS + wSEZ.east*upE + wSEZ.zenith*upZ;

    const det = sR * wU - sU * wR;
    if (Math.abs(det) < 1e-10) { console.warn('[MATRIX] 投影矩阵奇异，跳过补偿'); return null; }

    const result = { a: wU/det, b: -wR/det, c: -sU/det, d: sR/det };
    console.log(`[MATRIX] M⁻¹: a=${result.a.toFixed(4)}, b=${result.b.toFixed(4)}, c=${result.c.toFixed(4)}, d=${result.d.toFixed(4)}`);
    return result;
}

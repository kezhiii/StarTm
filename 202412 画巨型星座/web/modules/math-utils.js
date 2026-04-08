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

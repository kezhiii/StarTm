// ======================== 插值系统 ========================
import { lerp, parseTimestamp, dateToJD, calcGMST, eciToEcef, ecefToLocal, formatTimestamp } from './math-utils.js';
import { SAT_SCALE, SAT_SCALE_CENTER, DEG, RE_KM, RE_3D } from './config.js';

/**
 * 插值卫星位置
 */
export function interpolateSatellites(prevData, currData, progress) {
    if (!prevData || !currData) return currData;
    if (prevData.length === 0 || currData.length === 0) return currData;
    
    // 关键修复：保护progress范围，防止异常值
    progress = Math.min(Math.max(progress, 0), 1.0);

    const interpolated = [];
    for (let i = 0; i < currData.length; i++) {
        const prev = prevData[i];
        const curr = currData[i];
        if (!prev) {
            interpolated.push(curr);
            continue;
        }
        
        // 检查数据有效性
        if (!Array.isArray(prev) || !Array.isArray(curr) || prev.length < 14 || curr.length < 14) {
            console.warn('[INTERP] 数据格式异常，跳过当前帧');
            interpolated.push(curr);
            continue;
        }
        
        const interpSat = [...curr];
        interpSat[8] = lerp(prev[8], curr[8], progress);   // X
        interpSat[9] = lerp(prev[9], curr[9], progress);   // Y
        interpSat[10] = lerp(prev[10], curr[10], progress); // Z
        interpSat[11] = lerp(prev[11], curr[11], progress); // Vx
        interpSat[12] = lerp(prev[12], curr[12], progress); // Vy
        interpSat[13] = lerp(prev[13], curr[13], progress); // Vz
        
        // 关键修复：检查插值结果是否为NaN或Infinity
        if (isNaN(interpSat[8]) || isNaN(interpSat[9]) || isNaN(interpSat[10]) ||
            !isFinite(interpSat[8]) || !isFinite(interpSat[9]) || !isFinite(interpSat[10])) {
            console.warn(`[INTERP] 插值结果异常 (sat ${i})，使用当前帧数据`);
            interpolated.push(curr);
            continue;
        }
        
        interpolated.push(interpSat);
    }
    return interpolated;
}

/**
 * 更新第三视角插值帧
 */
export function updateSatellitesThirdPersonInterp(interpData, sceneObjects, interaction) {
    if (!interpData || interpData.length === 0) return;

    interpData.forEach((satData, idx) => {
        if (idx >= sceneObjects.satelliteMeshes3D.length) return;
        sceneObjects.satelliteMeshes3D[idx].visible = true;
        sceneObjects.satelliteMeshes3D[idx].position.set(
            satData[8] * SAT_SCALE,
            satData[10] * SAT_SCALE,
            -satData[9] * SAT_SCALE
        );
    });
    for (let i = interpData.length; i < sceneObjects.satelliteMeshes3D.length; i++) {
        sceneObjects.satelliteMeshes3D[i].visible = false;
    }
    document.getElementById('coordDisplay').textContent =
        `纬度 ${interaction.currentLat.toFixed(1)}°  经度 ${interaction.currentLon.toFixed(1)}°  时间 ${formatTimestamp(interpData[0][0])}`;
    document.getElementById('timeDisplay').textContent = formatTimestamp(interpData[0][0]);
}

/**
 * 更新第一视角插值帧
 */
export function updateSatellitesFirstPersonInterp(interpData, appState) {
    if (!interpData || interpData.length === 0) return;
    const d = parseTimestamp(interpData[0][0]);
    const gmst = calcGMST(dateToJD(d.year, d.month, d.day, d.hour, d.minute, d.second));
    const { currentLat, currentLon } = appState.interaction;
    const { sceneObjects } = appState;
    const lightMgr = appState.lightManager;  // 修复：在函数作用域定义
    
    // 关键监控：检测GMST突变
    if (sceneObjects._lastGMST !== undefined) {
        const gmstDiff = Math.abs(gmst - sceneObjects._lastGMST);
        if (gmstDiff > 0.1) { // 正常每帧GMST变化约0.00007
            console.warn(`[FIRST-PERSON] GMST突变: prev=${sceneObjects._lastGMST.toFixed(4)}, curr=${gmst.toFixed(4)}, diff=${gmstDiff.toFixed(4)}`);
        }
    }
    sceneObjects._lastGMST = gmst;

    // 编队张角放大5倍（与月球保持一致）
    const SCENE_SCALE = RE_3D / RE_KM;
    const FORMATION_SCALE = 5;

    // 第一遍：计算编队中心方向（度数）
    // 关键修复：使用所有卫星计算中心，而不是只用地平线上的卫星
    // 原因：只用地平线上的卫星会导致中心在地平线附近剧烈跳动
    let centerAz = 0, centerEl = 0;
    let centerAzSumX = 0, centerAzSumY = 0, centerElSum = 0, validCount = 0;
    interpData.forEach((satData) => {
        const ecef = eciToEcef(satData[8], satData[9], satData[10], gmst);
        const local = ecefToLocal(ecef.x, ecef.y, ecef.z, currentLat, currentLon);
        // 圆周平均：将角度转为单位向量
        const azRad = local.az * DEG;
        centerAzSumX += Math.cos(azRad);
        centerAzSumY += Math.sin(azRad);
        centerElSum += local.el;
        validCount++;
    });
    if (validCount > 0) {
        // 从向量和反算平均方位角
        centerAz = Math.atan2(centerAzSumY, centerAzSumX) / DEG;
        if (centerAz < 0) centerAz += 360;
        centerEl = centerElSum / validCount;
    }
    
    // 关键监控：检测中心方向突变（度数）
    if (sceneObjects._lastCenterAz !== undefined) {
        // 正确处理360°环绕问题
        let azDiff = Math.abs(centerAz - sceneObjects._lastCenterAz);
        if (azDiff > 180) azDiff = 360 - azDiff; // 处理360°环绕
        if (azDiff > 5) { // 正常每帧变化<1度
            console.warn(`[FIRST-PERSON] 编队中心方位角突变: prev=${sceneObjects._lastCenterAz.toFixed(3)}°, curr=${centerAz.toFixed(3)}°, diff=${azDiff.toFixed(3)}°`);
        }
    }
    sceneObjects._lastCenterAz = centerAz;
    sceneObjects._lastCenterEl = centerEl;

    // 第二遍：渲染卫星
    let visibleCount = 0;
    interpData.forEach((satData, idx) => {
        if (idx >= sceneObjects.satelliteMeshes1D.length) return;
        
        // 关键修复：检查数据有效性
        if (!Array.isArray(satData) || satData.length < 14) {
            console.warn(`[FIRST-PERSON] 卫星 ${idx} 数据格式异常`);
            sceneObjects.satelliteMeshes1D[idx].visible = false;
            return;
        }
        
        // 检查坐标是否为NaN或Infinity
        const x = satData[8], y = satData[9], z = satData[10];
        if (isNaN(x) || isNaN(y) || isNaN(z) || !isFinite(x) || !isFinite(y) || !isFinite(z)) {
            console.warn(`[FIRST-PERSON] 卫星 ${idx} 坐标异常: (${x}, ${y}, ${z})，隐藏`);
            sceneObjects.satelliteMeshes1D[idx].visible = false;
            return;
        }
        
        const ecef = eciToEcef(x, y, z, gmst);
        const local = ecefToLocal(ecef.x, ecef.y, ecef.z, currentLat, currentLon);
        
        // 检查转换后的坐标
        if (isNaN(local.az) || isNaN(local.el) || isNaN(local.range)) {
            console.warn(`[FIRST-PERSON] 卫星 ${idx} 坐标转换异常: az=${local.az}, el=${local.el}, range=${local.range}`);
            sceneObjects.satelliteMeshes1D[idx].visible = false;
            return;
        }
        
        sceneObjects.satelliteMeshes1D[idx].visible = true;

        // 检查灯光状态：如果卫星已开灯，跳过默认颜色设置
        const isLightOn = lightMgr && lightMgr.getLightState(idx);

        if (!isLightOn) {
            // 关灯：使用默认颜色
            if (local.el >= 0) {
                sceneObjects.satelliteMeshes1D[idx].material.color.setHex(0x00ff00);
                visibleCount++;
            } else {
                sceneObjects.satelliteMeshes1D[idx].material.color.setHex(0xff3333);
            }
        } else {
            // 开灯状态：由灯光管理器控制颜色，此处不覆盖
            if (local.el >= 0) visibleCount++;
        }
        // 距离缩小5倍，角度偏移也放大5倍，使卫星分散开
        const displayDist = (local.range * SCENE_SCALE) / FORMATION_SCALE;
        // 关键修复：centerAz 和 centerEl 是度数，使用时需乘 DEG 转弧度
        const azR = centerAz * DEG + (local.az * DEG - centerAz * DEG) * FORMATION_SCALE;
        const elR = centerEl * DEG + (local.el * DEG - centerEl * DEG) * FORMATION_SCALE;
        
        // 关键修复：检查最终位置是否为NaN
        const posX = displayDist * Math.cos(elR) * Math.sin(azR);
        const posY = displayDist * Math.sin(elR);
        const posZ = -displayDist * Math.cos(elR) * Math.cos(azR);
        
        if (isNaN(posX) || isNaN(posY) || isNaN(posZ)) {
            console.warn(`[FIRST-PERSON] 卫星 ${idx} 最终位置异常，隐藏`);
            sceneObjects.satelliteMeshes1D[idx].visible = false;
            return;
        }
        
        // 关键监控：检测位置跳跃（与上一帧比较）
        const prevPos = sceneObjects.satelliteMeshes1D[idx].position;
        if (prevPos && prevPos.x !== undefined && prevPos.y !== undefined && prevPos.z !== undefined) {
            const jumpDist = Math.sqrt(
                Math.pow(posX - prevPos.x, 2) + 
                Math.pow(posY - prevPos.y, 2) + 
                Math.pow(posZ - prevPos.z, 2)
            );
            // 如果跳跃距离超过正常值（假设正常移动<5单位），打印警告
            if (jumpDist > 5 && idx === 0) { // 只监控主星，避免日志洪水
                console.warn(`[FIRST-PERSON] 主星位置跳跃: dist=${jumpDist.toFixed(2)}, prev=(${prevPos.x.toFixed(2)}, ${prevPos.y.toFixed(2)}, ${prevPos.z.toFixed(2)}), curr=(${posX.toFixed(2)}, ${posY.toFixed(2)}, ${posZ.toFixed(2)})`);
            }
        }
        
        sceneObjects.satelliteMeshes1D[idx].position.set(posX, posY, posZ);
    });
    for (let i = interpData.length; i < sceneObjects.satelliteMeshes1D.length; i++) {
        sceneObjects.satelliteMeshes1D[i].visible = false;
    }
    document.getElementById('visibleCount').textContent = visibleCount;
    document.getElementById('timeDisplay').textContent = formatTimestamp(interpData[0][0]);

    // 应用灯光状态（在渲染后）
    if (lightMgr) {
        lightMgr.applyAll();
    }

    // 注意：月球位置更新已移至 updateMoonFirstPerson (animate 循环中)
    // 原因：
    // 1. 月球运动非常缓慢（27.32天一圈），两帧之间（60秒）的变化极小，不需要插值
    // 2. 避免在播放循环和animate循环中重复更新月球导致的冲突和性能浪费
    // 3. updateMoonFirstPerson 会根据当前帧索引和播放状态计算正确的月球位置
}

/**
 * 更新主星视角插值帧
 */
export function updateSatellitesCenterPersonInterp(interpData, appState, camera, cameraPanOffset, updateCameraFn) {
    if (!interpData || interpData.length === 0) return;
    const d = parseTimestamp(interpData[0][0]);
    const gmst = calcGMST(dateToJD(d.year, d.month, d.day, d.hour, d.minute, d.second));
    const { sceneObjects } = appState;

    if (sceneObjects.earthRef && sceneObjects.earthRef.parent) {
        sceneObjects.earthRef.position.set(0, 0, 0);
        sceneObjects.earthRef.rotation.y = gmst;
    }

    const centerSat = interpData[0];
    const centerPos = { x: centerSat[8], y: centerSat[10], z: -centerSat[9] };
    const lightMgr = appState.lightManager;

    if (sceneObjects.centerSatMarker) {
        sceneObjects.centerSatMarker.position.set(centerPos.x, centerPos.y, centerPos.z);
        // 主星灯光状态（索引 0）
        if (lightMgr) {
            const isMainLightOn = lightMgr.getLightState(0);
            if (isMainLightOn) {
                sceneObjects.centerSatMarker.material.emissive.setHex(0xffdd44);
                sceneObjects.centerSatMarker.material.emissiveIntensity = 0.6;
                sceneObjects.centerSatMarker.material.color.setHex(0xffff00);
            } else {
                sceneObjects.centerSatMarker.material.emissive.setHex(0x000000);
                sceneObjects.centerSatMarker.material.emissiveIntensity = 0;
                sceneObjects.centerSatMarker.material.color.setHex(0xffff00); // 主星默认黄色
            }
        }
    }

    let visibleCount = 0;
    const maxDeputyIdx = Math.min(interpData.length, sceneObjects.satelliteMeshesCenter.length + 1);
    for (let i = 1; i < maxDeputyIdx; i++) {
        const dX = (interpData[i][8] - centerSat[8]) * SAT_SCALE_CENTER;
        const dY = (interpData[i][9] - centerSat[9]) * SAT_SCALE_CENTER;
        const dZ = (interpData[i][10] - centerSat[10]) * SAT_SCALE_CENTER;
        const meshIdx = i - 1; // 网格索引从0开始，对应数据索引i
        sceneObjects.satelliteMeshesCenter[meshIdx].visible = true;
        sceneObjects.satelliteMeshesCenter[meshIdx].position.set(
            centerPos.x + dX,
            centerPos.y + dZ,
            centerPos.z - dY
        );
        
        // 应用灯光状态（数据索引 i 对应灯光状态 i）
        if (lightMgr) {
            const isLightOn = lightMgr.getLightState(i);
            if (isLightOn) {
                sceneObjects.satelliteMeshesCenter[meshIdx].material.emissive.setHex(0xffdd44);
                sceneObjects.satelliteMeshesCenter[meshIdx].material.emissiveIntensity = 0.6;
                sceneObjects.satelliteMeshesCenter[meshIdx].material.color.setHex(0xffff00);
            } else {
                sceneObjects.satelliteMeshesCenter[meshIdx].material.emissive.setHex(0x000000);
                sceneObjects.satelliteMeshesCenter[meshIdx].material.emissiveIntensity = 0;
                // 主星视角下：所有副星默认绿色，不再根据相对位置显示红色
                sceneObjects.satelliteMeshesCenter[meshIdx].material.color.setHex(0x00ff00);
            }
        }
        
        visibleCount++;
    }
    for (let i = maxDeputyIdx - 1; i < sceneObjects.satelliteMeshesCenter.length; i++) {
        sceneObjects.satelliteMeshesCenter[i].visible = false;
    }

    // 更新相机位置
    if (camera && updateCameraFn) {
        updateCameraFn(camera, appState, cameraPanOffset, centerPos);
    }

    document.getElementById('coordDisplay').textContent =
        `纬度 ${appState.interaction.currentLat.toFixed(1)}°  经度 ${appState.interaction.currentLon.toFixed(1)}°  时间 ${formatTimestamp(interpData[0][0])}`;
    document.getElementById('visibleCount').textContent = visibleCount;
    document.getElementById('timeDisplay').textContent = formatTimestamp(interpData[0][0]);
}

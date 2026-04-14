// ======================== 第一视角模块 ========================
// 【V3修复标记 - 2026-04-12 22:30】月球时间戳和插值修复
// 如果看到此日志，说明模块已正确加载
console.log('[FIRST-PERSON-MODULE] 模块已加载 V3');
import * as THREE from 'three';
import { DEG, RE_KM, RE_3D, sharedResources } from '../config.js';
import { parseTimestamp, dateToJD, calcGMST, eciToEcef, ecefToLocal, formatTimestamp } from '../math-utils.js';
import { initMoon, calcMoonECIForDataTimestamp } from '../moon-orbit.js';

const { SKY_GEOM, SKY_MAT, HORIZON_PLANE_GEOM, HORIZON_PLANE_MAT,
        HORIZON_RING_GEOM, HORIZON_RING_MAT, GS_MARKER_1ST_GEOM, GS_MARKER_1ST_MAT,
        SAT_GEOM_1ST, SAT_MAT_1ST } = sharedResources;

/**
 * 生成简单的网格地面纹理（避免加载外部图片）
 */
function createGroundTexture() {
    const GROUND_TEX_SIZE = 512;
    const GRID_STEP = 64;
    const TEXTURE_REPEAT = 20;

    const canvas = document.createElement('canvas');
    canvas.width = GROUND_TEX_SIZE;
    canvas.height = GROUND_TEX_SIZE;
    const context = canvas.getContext('2d');

    // 填充深色背景
    context.fillStyle = '#0a0a12';
    context.fillRect(0, 0, GROUND_TEX_SIZE, GROUND_TEX_SIZE);

    // 绘制网格线
    context.strokeStyle = '#222233';
    context.lineWidth = 2;
    for (let i = 0; i <= GROUND_TEX_SIZE; i += GRID_STEP) {
        context.beginPath(); context.moveTo(i, 0); context.lineTo(i, GROUND_TEX_SIZE); context.stroke();
        context.beginPath(); context.moveTo(0, i); context.lineTo(GROUND_TEX_SIZE, i); context.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(TEXTURE_REPEAT, TEXTURE_REPEAT); // 重复纹理以覆盖广阔地面
    texture.needsUpdate = true; // 确保纹理正确上传到 GPU
    return texture;
}

// 模块级常量：地面纹理只创建一次
let GROUND_TEXTURE = null;
function getGroundTexture() {
    if (!GROUND_TEXTURE) {
        GROUND_TEXTURE = createGroundTexture();
    }
    return GROUND_TEXTURE;
}

/**
 * 添加箭头辅助线
 */
function addArrowTo(group, from, to, color) {
    group.add(new THREE.ArrowHelper(to.clone().sub(from).normalize(), from, from.distanceTo(to), color, 20, 15));
}

/**
 * 初始化第一视角场景
 */
export function initFirstPersonScene(scene, controls, camera, appState) {
    // 第一人称视角恢复默认FOV（75°）
    if (camera) {
        const firstPersonFOV = 75;
        // 保存原始FOV以便恢复
        if (scene.userData.originalFOV === undefined) {
            scene.userData.originalFOV = camera.fov;
        }
        camera.fov = firstPersonFOV;
        camera.updateProjectionMatrix();
        console.log(`[FIRST-PERSON] FOV 设置为: ${firstPersonFOV}° (原始FOV=${scene.userData.originalFOV}°)`);
    } else {
        console.warn('[FIRST-PERSON] 相机未传入，无法设置FOV');
    }

    // 注意：不要设置 scene.background 为纯色，否则会覆盖星空
    // 星空背景的恢复由 app.js 的 switchView 逻辑处理

    const { sceneObjects, ws, csv, earthRotation } = appState;

    // 移除天空穹顶，让星空粒子可见
    // scene.add(new THREE.Mesh(SKY_GEOM, SKY_MAT));

    // 使用生成的网格纹理作为地面
    const groundTexture = getGroundTexture();
    const groundMat = new THREE.MeshBasicMaterial({
        map: groundTexture,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.5
    });
    sceneObjects.horizonPlane = new THREE.Mesh(HORIZON_PLANE_GEOM, groundMat);
    sceneObjects.horizonPlane.rotation.x = -Math.PI / 2;
    sceneObjects.horizonPlane.position.y = -1; // 将地面降低1单位，让相机在地面上方
    scene.add(sceneObjects.horizonPlane);

    sceneObjects.horizonRing = new THREE.Mesh(HORIZON_RING_GEOM, HORIZON_RING_MAT);
    sceneObjects.horizonRing.rotation.x = -Math.PI / 2;
    scene.add(sceneObjects.horizonRing);

    sceneObjects.gridGroup = new THREE.Group();
    const gridMat = new THREE.LineBasicMaterial({ color: 0x333366, transparent: true, opacity: 0.3 });
    [30, 60, 90].forEach(el => {
        const r = 2000 * Math.cos(el * DEG), y = 2000 * Math.sin(el * DEG);
        const pts = new THREE.EllipseCurve(0, 0, r, r, 0, 2 * Math.PI, false, 0).getPoints(64);
        sceneObjects.gridGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts.map(p => new THREE.Vector3(p.x, y, p.y))), gridMat));
    });
    for (let az = 0; az < 360; az += 30) {
        const azR = az * DEG, pts = [];
        for (let el = 0; el <= 90; el += 5) {
            const r = 2000 * Math.cos(el * DEG), y = 2000 * Math.sin(el * DEG);
            pts.push(new THREE.Vector3(r * Math.sin(azR), y, -r * Math.cos(azR)));
        }
        sceneObjects.gridGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), gridMat));
    }
    scene.add(sceneObjects.gridGroup);

    sceneObjects.arrowGroup = new THREE.Group();
    addArrowTo(sceneObjects.arrowGroup, new THREE.Vector3(0, 0, -100), new THREE.Vector3(0, 0, -250), 0xff0000);
    addArrowTo(sceneObjects.arrowGroup, new THREE.Vector3(100, 0, 0), new THREE.Vector3(250, 0, 0), 0x00ff00);
    addArrowTo(sceneObjects.arrowGroup, new THREE.Vector3(0, 100, 0), new THREE.Vector3(0, 250, 0), 0x0066ff);
    scene.add(sceneObjects.arrowGroup);

    sceneObjects.groundStationMarker1D = new THREE.Mesh(GS_MARKER_1ST_GEOM, GS_MARKER_1ST_MAT);
    sceneObjects.groundStationMarker1D.position.set(0, 0, 0);
    scene.add(sceneObjects.groundStationMarker1D);

    sceneObjects.satelliteMeshes1D = [];
    for (let i = 0; i < 22; i++) {
        // 修复：克隆材质，使每颗卫星的颜色独立
        const mesh = new THREE.Mesh(SAT_GEOM_1ST, SAT_MAT_1ST.clone());
        mesh.userData.satIdx = i;
        mesh.visible = false;
        scene.add(mesh);
        sceneObjects.satelliteMeshes1D.push(mesh);
    }
    console.log(`[FIRST-PERSON] 已初始化 ${sceneObjects.satelliteMeshes1D.length} 颗卫星网格, sceneObj ID: ${sceneObjects.__id || (sceneObjects.__id = Math.random().toString(36).substr(2, 5))}`);

    // 初始化月球 (使用模块化方法)
    initMoon(scene, appState);

    controls.enabled = false;
    const groundInfo = document.getElementById('groundInfo');
    const info = document.getElementById('info');
    if (groundInfo) groundInfo.classList.add('hidden');
    if (info) info.style.display = '';  // 第一视角显示卫星统计

    // 修复：确保初始化地球自转基准时间和卫星位置
    // 注意：相机更新由 switchView 中的调用完成，这里只初始化卫星位置
    if (ws.connection && ws.connection.readyState === WebSocket.OPEN && ws.lastStepData) {
        const d = parseTimestamp(ws.lastStepData[0][0]);
        earthRotation.startJD = dateToJD(d.year, d.month, d.day, d.hour, d.minute, d.second);
        earthRotation.startTime = performance.now();
        updateSatellitesFirstPersonWs(ws.lastStepData, appState);
    } else if (csv.satelliteData.length > 0) {
        // CSV 模式：初始化地球自转基准时间
        const currentGroup = csv.satelliteData[csv.state.currentTimeIdx];
        if (currentGroup) {
            const d = parseTimestamp(currentGroup.timestamp);
            earthRotation.startJD = dateToJD(d.year, d.month, d.day, d.hour, d.minute, d.second);
            earthRotation.startTime = performance.now();
        }
        updateSatellitesFirstPerson(csv.state.currentTimeIdx, appState);
    }
}

/**
 * 更新第一视角相机 (鼠标拖拽)
 */
export function updateFirstPersonCamera(camera, appState) {
    camera.position.set(0, 0, 0);
    const elRad = appState.interaction.fpElevation * DEG;
    // 修复：z 坐标加负号，与卫星/月球渲染公式保持一致
    // az=0° 对应 -z 方向（北方），与 Three.js 相机默认朝向一致
    const lookAtTarget = new THREE.Vector3(
        Math.cos(elRad) * Math.sin(appState.interaction.fpAzimuth),
        Math.sin(elRad),
        -Math.cos(elRad) * Math.cos(appState.interaction.fpAzimuth)
    );
    camera.lookAt(lookAtTarget);

    // 新增：更新方位角和仰角显示
    const azDeg = (appState.interaction.fpAzimuth / DEG) % 360;
    const elDeg = appState.interaction.fpElevation;
    const azDisplay = document.getElementById('azimuth-display');
    const elDisplay = document.getElementById('elevation-display');
    if (azDisplay) azDisplay.textContent = azDeg.toFixed(1) + '°';
    if (elDisplay) elDisplay.textContent = elDeg.toFixed(1) + '°';
}

/**
 * 更新第一视角卫星位置 (CSV)
 */
export function updateSatellitesFirstPerson(timeIdx, appState) {
    const data = appState.csv.satelliteData;
    if (timeIdx < 0 || timeIdx >= data.length) return;

    const group = data[timeIdx];
    const { currentLat, currentLon } = appState.interaction;
    const { sceneObjects } = appState;

    const d = parseTimestamp(group.timestamp);
    const gmst = calcGMST(dateToJD(d.year, d.month, d.day, d.hour, d.minute, d.second));

    // 编队张角放大5倍（与月球保持一致）
    const SCENE_SCALE = RE_3D / RE_KM;
    const FORMATION_SCALE = 5;

    // 第一遍：计算编队中心方向（度数）
    // 关键修复：使用圆周平均处理360°环绕问题
    let centerAzSumX = 0, centerAzSumY = 0, centerElSum = 0, validCount = 0;
    group.sats.forEach((sat) => {
        const ecef = eciToEcef(sat.X, sat.Y, sat.Z, gmst);
        const local = ecefToLocal(ecef.x, ecef.y, ecef.z, currentLat, currentLon);
        // 所有卫星都计入（包括地平线下的）
        const azRad = local.az * DEG;
        centerAzSumX += Math.cos(azRad);
        centerAzSumY += Math.sin(azRad);
        centerElSum += local.el;
        validCount++;
    });
    let centerAz = 0, centerEl = 0;
    if (validCount > 0) {
        centerAz = Math.atan2(centerAzSumY, centerAzSumX) / DEG;
        if (centerAz < 0) centerAz += 360;
        centerEl = centerElSum / validCount;
    }

    // 第二遍：渲染卫星
    let visibleCount = 0;
    group.sats.forEach((sat, idx) => {
        if (idx >= sceneObjects.satelliteMeshes1D.length) return;
        const ecef = eciToEcef(sat.X, sat.Y, sat.Z, gmst);
        const local = ecefToLocal(ecef.x, ecef.y, ecef.z, currentLat, currentLon);
        sceneObjects.satelliteMeshes1D[idx].visible = true;

        // 检查灯光状态：如果卫星已开灯，跳过默认颜色设置
        const isLightOn = appState.lightManager && appState.lightManager.getLightState(idx);
        if (!isLightOn) {
            // 关灯：使用默认颜色
            if (local.el >= 0) {
                sceneObjects.satelliteMeshes1D[idx].material.color.setHex(0x00ff00);
            } else {
                sceneObjects.satelliteMeshes1D[idx].material.color.setHex(0xff3333);
            }
        }
        // 开灯状态：由灯光管理器控制颜色，此处不覆盖

        if (local.el >= 0) {
            visibleCount++;
        }
        // 距离缩小5倍，角度偏移也放大5倍，使卫星分散开
        const displayDist = (local.range * SCENE_SCALE) / FORMATION_SCALE;
        // 关键修复：centerAz 和 centerEl 是度数，使用时需乘 DEG 转弧度
        const azR = centerAz * DEG + (local.az * DEG - centerAz * DEG) * FORMATION_SCALE;
        const elR = centerEl * DEG + (local.el * DEG - centerEl * DEG) * FORMATION_SCALE;
        sceneObjects.satelliteMeshes1D[idx].position.set(
            displayDist * Math.cos(elR) * Math.sin(azR),
            displayDist * Math.sin(elR),
            -displayDist * Math.cos(elR) * Math.cos(azR)
        );
    });
    for (let i = group.sats.length; i < sceneObjects.satelliteMeshes1D.length; i++) {
        sceneObjects.satelliteMeshes1D[i].visible = false;
    }
    const visibleCountEl = document.getElementById('visibleCount');
    const timeDisplayEl = document.getElementById('timeDisplay');
    if (visibleCountEl) visibleCountEl.textContent = visibleCount;
    if (timeDisplayEl) timeDisplayEl.textContent = formatTimestamp(group.timestamp);

    // === 新增：更新月球位置 (CSV 模式) ===
    if (sceneObjects.moon && appState.moonECI) {
        // appState.moonECI 是以米为单位的，ecefToLocal 期望输入为公里
        const moonEcef = eciToEcef(
            appState.moonECI.x / 1000,
            appState.moonECI.y / 1000,
            appState.moonECI.z / 1000,
            gmst
        );
        const moonLocal = ecefToLocal(moonEcef.x, moonEcef.y, moonEcef.z, currentLat, currentLon);

        const azR = moonLocal.az * DEG;
        const elR = moonLocal.el * DEG;

        // 关键修复：只有月球在地平线以上时才可见
        // 如果仰角 < 0，说明月球在地平线以下，被地球遮挡
        if (moonLocal.el >= 0) {
            // 使用真实的地月距离（按场景比例缩放）
            const SCENE_SCALE = RE_3D / RE_KM; // 场景单位/公里
            // 月球视角放大5倍：将显示距离缩小为原来的1/5
            const MOON_SCALE = 5;
            const visualDist = (moonLocal.range * SCENE_SCALE) / MOON_SCALE;

            sceneObjects.moon.visible = true;
            sceneObjects.moon.position.set(
                visualDist * Math.cos(elR) * Math.sin(azR),
                visualDist * Math.sin(elR),
                -visualDist * Math.cos(elR) * Math.cos(azR)
            );
        } else {
            // 月球在地平线以下，不可见
            sceneObjects.moon.visible = false;
        }
    }
}

// 移除模块级变量，已移至 appState.interpolation

/**
 * 每帧更新第一视角月球位置（在 animate 中调用）
 * 支持 CSV 和 WS 两种模式，支持插值平滑
 */
export function updateMoonFirstPerson(appState) {
    if (!appState.sceneObjects.moon) return;

    const { currentLat, currentLon } = appState.interaction;
    const { sceneObjects } = appState;
    // 从 appState 获取插值状态（防止多实例冲突）
    const moonInterpState = appState.interpolation.moonInterpState;

    // 获取当前时间戳：根据模式选择数据源
    let d = null;
    const currentMode = appState.currentMode;

    if (currentMode === 'ws' && appState.ws.lastStepData) {
        // WS 模式：从 WebSocket 数据获取时间戳
        d = parseTimestamp(appState.ws.lastStepData[0][0]);
    } else if (currentMode === 'csv') {
        // CSV 模式：直接从 CSV 数据中获取当前帧的时间戳
        const debugNow = performance.now();

        if (!appState.csv.satelliteData || appState.csv.satelliteData.length === 0) {
            if (debugNow - appState.interpolation.lastMoonLogTime >= 2000) {
                appState.interpolation.lastMoonLogTime = debugNow;
                console.warn(`[MOON-CSV] CSV数据为空! currentMode=${currentMode}, 是否已加载CSV文件?`);
            }
            return;
        }

        const idx = appState.csv.state.currentTimeIdx;
        if (idx < 0 || idx >= appState.csv.satelliteData.length) {
            if (debugNow - appState.interpolation.lastMoonLogTime >= 2000) {
                appState.interpolation.lastMoonLogTime = debugNow;
                console.warn(`[MOON-CSV] 索引越界! idx=${idx}, dataLength=${appState.csv.satelliteData.length}`);
            }
            return;
        }

        const frameData = appState.csv.satelliteData[idx];
        const timestamp = frameData.timestamp;

        // 调试：查看时间戳原始值
        if (debugNow - appState.interpolation.lastMoonLogTime >= 2000) {
            appState.interpolation.lastMoonLogTime = debugNow;
            console.log(`[MOON-TS-DEBUG] idx=${idx}, timestamp=`, timestamp, `, type=${typeof timestamp}, length=${timestamp ? timestamp.length : 'N/A'}`);
        }

        d = parseTimestamp(timestamp);
    }

    if (!d || isNaN(d.year) || isNaN(d.month) || isNaN(d.day)) {
        // 调试日志：帮助诊断时间戳问题
        const nowDebug = performance.now();
        if (nowDebug - appState.interpolation.lastMoonLogTime >= 2000) {
            appState.interpolation.lastMoonLogTime = nowDebug;
            console.warn(`[MOON-FIRST] 时间戳解析失败! d=`, d, `, currentTimeIdx=`, appState.csv.state.currentTimeIdx);
        }
        return;
    }

    const gmst = calcGMST(dateToJD(d.year, d.month, d.day, d.hour, d.minute, d.second));

    const moonECI = calcMoonECIForDataTimestamp(
        d,
        appState.earthRotation.startJD,
        appState.earthRotation.speedFactor
    );

    if (!moonECI) return;

    const moonEcef = eciToEcef(
        moonECI.x / 1000,
        moonECI.y / 1000,
        moonECI.z / 1000,
        gmst
    );
    const moonLocal = ecefToLocal(moonEcef.x, moonEcef.y, moonEcef.z, currentLat, currentLon);

    // 每秒输出月球日志
    const now = performance.now();
    if (now - appState.interpolation.lastMoonLogTime >= 1000) {
        appState.interpolation.lastMoonLogTime = now;
        // 【V2修复】直接格式化日期对象，而不是使用formatTimestamp
        const timeStr = `${d.year}-${String(d.month).padStart(2,'0')}-${String(d.day).padStart(2,'0')} ${String(d.hour).padStart(2,'0')}:${String(d.minute).padStart(2,'0')}:${String(d.second).padStart(2,'0')}`;
        console.log(`[MOON-FIRST-V2] time=${timeStr}, obs: lat=${currentLat.toFixed(2)}°, lon=${currentLon.toFixed(2)}°, moonLocal: az=${moonLocal.az.toFixed(2)}°, el=${moonLocal.el.toFixed(2)}°, range=${moonLocal.range.toFixed(1)} km`);
    }

    // 计算目标位置
    const azR = moonLocal.az * DEG;
    const elR = moonLocal.el * DEG;
    const MOON_SCALE = 5;
    const MOON_DIST_RATIO = 60.27;
    const visualDist = (RE_3D * MOON_DIST_RATIO) / MOON_SCALE;

    const targetPosX = visualDist * Math.cos(elR) * Math.sin(azR);
    const targetPosY = visualDist * Math.sin(elR);
    const targetPosZ = -visualDist * Math.cos(elR) * Math.cos(azR);

    // 月球可见性判断
    if (moonLocal.el >= 0) {
        sceneObjects.moon.visible = true;

        // 更新插值状态
        if (!moonInterpState.initialized) {
            // 首次调用，直接设置目标位置
            moonInterpState.prevAz = moonLocal.az;
            moonInterpState.prevEl = moonLocal.el;
            moonInterpState.prevRange = moonLocal.range;
            moonInterpState.targetAz = moonLocal.az;
            moonInterpState.targetEl = moonLocal.el;
            moonInterpState.targetRange = moonLocal.range;
            moonInterpState.initialized = true;

            sceneObjects.moon.position.set(targetPosX, targetPosY, targetPosZ);
            console.log('[MOON-INTERP] 初始化月球插值状态');
        } else {
            // 获取插值进度（0-1之间）
            const progress = appState.interpolation.currentProgress || 0;
            const prevProgress = moonInterpState.lastProgress || 0;

            // 检测帧切换：进度重置或跳跃
            const frameChanged = progress < prevProgress || Math.abs(progress - prevProgress) > 0.5;

            moonInterpState.lastProgress = progress;

            if (frameChanged) {
                // 帧已切换，保存旧目标作为新的前一帧
                moonInterpState.prevAz = moonInterpState.targetAz;
                moonInterpState.prevEl = moonInterpState.targetEl;
                moonInterpState.prevRange = moonInterpState.targetRange;

                moonInterpState.targetAz = moonLocal.az;
                moonInterpState.targetEl = moonLocal.el;
                moonInterpState.targetRange = moonLocal.range;

                // 每秒输出一次插值状态日志
                if (now - appState.interpolation.lastMoonInterpLogTime >= 1000) {
                    appState.interpolation.lastMoonInterpLogTime = now;
                    console.log(`[MOON-INTERP] 帧切换! progress=${progress.toFixed(3)}, prevEl=${moonInterpState.prevEl.toFixed(2)}°, targetEl=${moonInterpState.targetEl.toFixed(2)}°`);
                }
            }

            // 使用插值进度计算平滑位置
            const interpProgress = frameChanged ? 0 : progress;
            const smoothAz = moonInterpState.prevAz + (moonInterpState.targetAz - moonInterpState.prevAz) * interpProgress;
            const smoothEl = moonInterpState.prevEl + (moonInterpState.targetEl - moonInterpState.prevEl) * interpProgress;
            const smoothRange = moonInterpState.prevRange + (moonInterpState.targetRange - moonInterpState.prevRange) * interpProgress;

            // 转换为场景坐标
            const smoothAzR = smoothAz * DEG;
            const smoothElR = smoothEl * DEG;
            const smoothDist = (smoothRange * (RE_3D / RE_KM)) / MOON_SCALE;

            const smoothX = smoothDist * Math.cos(smoothElR) * Math.sin(smoothAzR);
            const smoothY = smoothDist * Math.sin(smoothElR);
            const smoothZ = -smoothDist * Math.cos(smoothElR) * Math.cos(smoothAzR);

            sceneObjects.moon.position.set(smoothX, smoothY, smoothZ);

            // 每秒输出一次插值后位置日志
            if (now - appState.interpolation.lastMoonInterpLogTime >= 1000) {
                appState.interpolation.lastMoonInterpLogTime = now;
                console.log(`[MOON-INTERP] progress=${progress.toFixed(3)}, interpProgress=${interpProgress.toFixed(3)}, smoothEl=${smoothEl.toFixed(2)}°, smoothPos=(${smoothX.toFixed(1)}, ${smoothY.toFixed(1)}, ${smoothZ.toFixed(1)})`);
            }
        }
    } else {
        sceneObjects.moon.visible = false;
    }
}
export function updateSatellitesFirstPersonWs(stepData, appState) {
    const d = parseTimestamp(stepData[0][0]);
    const gmst = calcGMST(dateToJD(d.year, d.month, d.day, d.hour, d.minute, d.second));
    const { currentLat, currentLon } = appState.interaction;
    const { sceneObjects } = appState;

    // 编队张角放大5倍（与月球保持一致）
    const SCENE_SCALE = RE_3D / RE_KM;
    const FORMATION_SCALE = 5;

    // 第一遍：计算编队中心方向（度数）
    // 关键修复：使用圆周平均处理360°环绕问题
    let centerAzSumX = 0, centerAzSumY = 0, centerElSum = 0, validCount = 0;
    stepData.forEach((satData) => {
        const ecef = eciToEcef(satData[8], satData[9], satData[10], gmst);
        const local = ecefToLocal(ecef.x, ecef.y, ecef.z, currentLat, currentLon);
        // 所有卫星都计入（包括地平线下的）
        const azRad = local.az * DEG;
        centerAzSumX += Math.cos(azRad);
        centerAzSumY += Math.sin(azRad);
        centerElSum += local.el;
        validCount++;
    });
    let centerAz = 0, centerEl = 0;
    if (validCount > 0) {
        centerAz = Math.atan2(centerAzSumY, centerAzSumX) / DEG;
        if (centerAz < 0) centerAz += 360;
        centerEl = centerElSum / validCount;
    }

    // 第二遍：渲染卫星
    let visibleCount = 0;
    stepData.forEach((satData, idx) => {
        if (idx >= sceneObjects.satelliteMeshes1D.length) return;
        const ecef = eciToEcef(satData[8], satData[9], satData[10], gmst);
        const local = ecefToLocal(ecef.x, ecef.y, ecef.z, currentLat, currentLon);
        sceneObjects.satelliteMeshes1D[idx].visible = true;

        // 检查灯光状态：如果卫星已开灯，跳过默认颜色设置
        const lightMgr = appState.lightManager;
        const isLightOn = lightMgr && lightMgr.getLightState(idx);

        if (!isLightOn) {
            // 关灯：使用默认颜色
            if (local.el >= 0) {
                sceneObjects.satelliteMeshes1D[idx].material.color.setHex(0x00ff00);
            } else {
                sceneObjects.satelliteMeshes1D[idx].material.color.setHex(0xff3333);
            }
        }
        // 开灯状态：由灯光管理器控制颜色，此处不覆盖

        if (local.el >= 0) {
            visibleCount++;
        }
        // 距离缩小5倍，角度偏移也放大5倍，使卫星分散开
        const displayDist = (local.range * SCENE_SCALE) / FORMATION_SCALE;
        // 关键修复：centerAz 和 centerEl 是度数，使用时需乘 DEG 转弧度
        const azR = centerAz * DEG + (local.az * DEG - centerAz * DEG) * FORMATION_SCALE;
        const elR = centerEl * DEG + (local.el * DEG - centerEl * DEG) * FORMATION_SCALE;
        sceneObjects.satelliteMeshes1D[idx].position.set(
            displayDist * Math.cos(elR) * Math.sin(azR),
            displayDist * Math.sin(elR),
            -displayDist * Math.cos(elR) * Math.cos(azR)
        );
    });
    for (let i = stepData.length; i < sceneObjects.satelliteMeshes1D.length; i++) {
        sceneObjects.satelliteMeshes1D[i].visible = false;
    }
    const visibleCountEl = document.getElementById('visibleCount');
    if (visibleCountEl) visibleCountEl.textContent = visibleCount;

    // === 更新月球位置 (WS 模式) ===
    if (sceneObjects.moon) {
        // WS 模式下，使用与卫星数据时间戳同步的月球ECI坐标
        const d = parseTimestamp(stepData[0][0]);
        const moonECI = calcMoonECIForDataTimestamp(
            d,
            appState.earthRotation.startJD,
            appState.earthRotation.speedFactor
        );

        if (moonECI) {
            // moonECI 是以米为单位的，ecefToLocal 期望输入为公里
            const moonEcef = eciToEcef(
                moonECI.x / 1000,
                moonECI.y / 1000,
                moonECI.z / 1000,
                gmst
            );
            const moonLocal = ecefToLocal(moonEcef.x, moonEcef.y, moonEcef.z, currentLat, currentLon);

            const azR = moonLocal.az * DEG;
            const elR = moonLocal.el * DEG;

            // 关键修复：只有月球在地平线以上时才可见
            if (moonLocal.el >= 0) {
                // 按真实地月比例：地月距离 ≈ 60.27 倍地球半径
                // 月球视角放大5倍：将显示距离缩小为原来的1/5
                const MOON_SCALE = 5;
                const MOON_DIST_RATIO = 60.27;
                const visualDist = (RE_3D * MOON_DIST_RATIO) / MOON_SCALE; // ≈ 602.7 单位

                const posX = visualDist * Math.cos(elR) * Math.sin(azR);
                const posY = visualDist * Math.sin(elR);
                const posZ = -visualDist * Math.cos(elR) * Math.cos(azR); // 注意 z 的负号

                console.log(`[WS-FIRST] moon visible: az=${moonLocal.az.toFixed(1)}°, el=${moonLocal.el.toFixed(1)}°, dist=${visualDist.toFixed(1)}`);

                sceneObjects.moon.visible = true;
                sceneObjects.moon.position.set(posX, posY, posZ);
            } else {
                sceneObjects.moon.visible = false;
            }
        }
    }
}

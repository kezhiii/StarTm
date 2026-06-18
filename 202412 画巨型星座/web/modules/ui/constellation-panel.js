// ======================== 卫星编队可视化面板 ========================
import * as THREE from 'three';
import { parseTimestamp, dateToJD, calcGMST, eciToEcef, ecefToLocal, eciToHill, computeHillToGroundMatrix } from '../math-utils.js';
import { DEG, RE_KM, RE_3D } from '../config.js';
import { createProtocolConfirmBar } from './protocol-confirm-bar.js';
import { createLightTimeline } from '../light-timeline.js';
import { processImage } from '../image-processor.js';

const PANEL_WIDTH = 400;
const PANEL_HEIGHT = 400;

/**
 * 创建卫星编队可视化面板
 */
export function createConstellationPanel(appState) {
    let panel = null;
    let canvas = null;
    let ctx = null;
    let satPositions = []; // 存储卫星在面板中的 2D 位置 {x, y, idx}
    let isVisible = false;
    let confirmBar = null;
    let timeline = null;
    let timelineToggle = null;

    // 地面视角补偿：M⁻¹矩阵 {a,b,c,d}，由 computeHillToGroundMatrix 返回
    let transformMatrix = null;

    /**
     * 初始化面板
     */
    function init() {
        // 创建面板容器
        panel = document.createElement('div');
        panel.id = 'constellationPanel';
        panel.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: ${PANEL_WIDTH}px;
            height: auto;
            min-height: ${PANEL_HEIGHT + 160}px;
            background: rgba(10, 10, 30, 0.95);
            border: 2px solid #4488ff;
            border-radius: 10px;
            z-index: 1000;
            display: none;
            flex-direction: column;
            align-items: center;
            padding: 10px;
            box-shadow: 0 0 20px rgba(68, 136, 255, 0.3);
        `;

        // 标题栏
        const titleBar = document.createElement('div');
        titleBar.style.cssText = 'width: 100%; display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;';

        const title = document.createElement('span');
        title.textContent = '🛰️ 卫星编队灯光控制';
        title.style.cssText = 'color: #fff; font-size: 16px; font-weight: bold;';

        const rightButtons = document.createElement('div');
        rightButtons.style.cssText = 'display: flex; gap: 8px; align-items: center;';

        // 时间线切换按钮
        timelineToggle = document.createElement('button');
        timelineToggle.textContent = '⏱ 时间线';
        timelineToggle.style.cssText = `
            background: #2a4a6a;
            border: 1px solid #4488ff;
            color: #fff;
            padding: 3px 10px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 12px;
        `;
        timelineToggle.onclick = toggleTimeline;

        // 全屏切换按钮
        let isFullscreen = false;
        const fullscreenBtn = document.createElement('button');
        fullscreenBtn.textContent = '⛶ 全屏';
        fullscreenBtn.style.cssText = `
            background: #2a4a6a;
            border: 1px solid #4488ff;
            color: #fff;
            padding: 3px 10px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 12px;
        `;
        
        // Escape键退出全屏
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && isFullscreen) {
                fullscreenBtn.click();
            }
        });
        
        fullscreenBtn.onclick = () => {
            isFullscreen = !isFullscreen;
            if (isFullscreen) {
                // 保存原始样式
                const origWidth = panel.style.width;
                const origHeight = panel.style.height;
                panel.dataset.origWidth = origWidth;
                panel.dataset.origHeight = origHeight;
                
                // 进入全屏
                panel.style.width = '100vw';
                panel.style.height = '100vh';
                panel.style.top = '0';
                panel.style.left = '0';
                panel.style.transform = 'none';
                panel.style.borderRadius = '0';
                
                // 调整画布大小
                const newWidth = window.innerWidth - 40;
                const newHeight = window.innerHeight - 80;
                canvas.width = newWidth;
                canvas.height = newHeight;
                canvas.style.width = newWidth + 'px';
                canvas.style.height = newHeight + 'px';
                
                fullscreenBtn.textContent = '✕ 退出全屏';
                fullscreenBtn.style.background = '#6a2a2a';
                fullscreenBtn.style.borderColor = '#ff4444';
                
                // 重新渲染
                requestAnimationFrame(() => render());
            } else {
                // 退出全屏
                panel.style.width = panel.dataset.origWidth || PANEL_WIDTH + 'px';
                panel.style.height = panel.dataset.origHeight || 'auto';
                panel.style.top = '50%';
                panel.style.left = '50%';
                panel.style.transform = 'translate(-50%, -50%)';
                panel.style.borderRadius = '10px';
                
                // 恢复画布大小
                canvas.width = PANEL_WIDTH;
                canvas.height = PANEL_HEIGHT;
                canvas.style.width = PANEL_WIDTH + 'px';
                canvas.style.height = PANEL_HEIGHT + 'px';
                
                fullscreenBtn.textContent = '⛶ 全屏';
                fullscreenBtn.style.background = '#2a4a6a';
                fullscreenBtn.style.borderColor = '#4488ff';
                
                // 重新渲染
                requestAnimationFrame(() => render());
            }
        };

        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✕';
        closeBtn.style.cssText = 'background: none; border: none; color: #fff; font-size: 20px; cursor: pointer;';
        closeBtn.onclick = hide;

        // 图案上传按钮
        const uploadBtn = document.createElement('button');
        uploadBtn.textContent = '📷 上传图案';
        uploadBtn.style.cssText = `
            background: #2a6a4a;
            border: 1px solid #44ff88;
            color: #fff;
            padding: 3px 10px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 12px;
        `;
        uploadBtn.onclick = handlePatternUpload;

        // 重置灯光按钮
        const resetBtn = document.createElement('button');
        resetBtn.textContent = '↩️ 重置';
        resetBtn.style.cssText = `
            background: #6a4a2a;
            border: 1px solid #ff8844;
            color: #fff;
            padding: 3px 10px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 12px;
        `;
        resetBtn.onclick = handleResetLights;

        // 反转复选框
        const invertContainer = document.createElement('label');
        invertContainer.style.cssText = 'display: flex; align-items: center; gap: 4px; color: #aaa; font-size: 11px; cursor: pointer;';
        const invertCheckbox = document.createElement('input');
        invertCheckbox.type = 'checkbox';
        invertCheckbox.id = 'invertPattern';
        invertCheckbox.style.cssText = 'cursor: pointer;';
        const invertLabel = document.createElement('span');
        invertLabel.textContent = '反转';
        invertContainer.appendChild(invertCheckbox);
        invertContainer.appendChild(invertLabel);

        rightButtons.appendChild(fullscreenBtn);
        rightButtons.appendChild(uploadBtn);
        rightButtons.appendChild(resetBtn);
        rightButtons.appendChild(invertContainer);
        rightButtons.appendChild(timelineToggle);
        rightButtons.appendChild(closeBtn);
        titleBar.appendChild(title);
        titleBar.appendChild(rightButtons);
        panel.appendChild(titleBar);

        // 主内容区：左右两栏（右栏默认隐藏）
        const mainContent = document.createElement('div');
        mainContent.style.cssText = `
            display: flex;
            flex-direction: row;
            gap: 10px;
            width: 100%;
            justify-content: center;
        `;

        // 左栏：画布 + 确认栏
        const leftColumn = document.createElement('div');
        leftColumn.id = 'leftColumn';
        leftColumn.style.cssText = `
            width: ${PANEL_WIDTH}px;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 6px;
            flex-shrink: 0;
        `;

        // 画布
        canvas = document.createElement('canvas');
        canvas.width = PANEL_WIDTH;
        canvas.height = PANEL_HEIGHT;
        canvas.style.cssText = 'border: 1px solid #333; border-radius: 5px; cursor: pointer;';
        canvas.onclick = handleCanvasClick;
        leftColumn.appendChild(canvas);

        ctx = canvas.getContext('2d');

        // 初始化确认栏
        confirmBar = createProtocolConfirmBar(appState, {
            onConfirm: handleConfirmSend,
            onClear: handleClearSelection,
        });
        confirmBar.init(leftColumn);

        // 右栏：时间线（默认隐藏）
        const rightColumn = document.createElement('div');
        rightColumn.id = 'rightColumn';
        rightColumn.style.cssText = `
            width: ${PANEL_WIDTH}px;
            display: none;
            flex-direction: column;
            gap: 6px;
            flex-shrink: 0;
        `;

        // 初始化时间线
        timeline = createLightTimeline(appState);
        timeline.init(rightColumn);

        mainContent.appendChild(leftColumn);
        mainContent.appendChild(rightColumn);
        panel.appendChild(mainContent);

        // 添加到页面
        document.body.appendChild(panel);
    }

    /**
     * 处理确认发送
     */
    function handleConfirmSend(commands) {
        if (!appState.ws || !appState.ws.connection || appState.ws.connection.readyState !== WebSocket.OPEN) {
            console.warn('[CONSTELLATION] WebSocket未连接，无法发送指令');
            return;
        }

        const message = JSON.stringify({
            type: 'protocol_frame',
            light_commands: commands,
        });

        appState.ws.connection.send(message);
        console.log(`[CONSTELLATION] 已发送 ${commands.length} 条灯光控制指令`);
    }

    /**
     * 处理清空选择
     */
    function handleClearSelection() {
        render();
    }

    /**
     * 切换时间线显示
     */
    function toggleTimeline() {
        const rightColumn = panel.querySelector('#rightColumn');
        const leftColumn = panel.querySelector('#leftColumn');
        if (!rightColumn) return;

        const isHidden = rightColumn.style.display === 'none';
        if (isHidden) {
            // 显示右栏，调整面板宽度
            rightColumn.style.display = 'flex';
            panel.style.width = `${PANEL_WIDTH * 2 + 20}px`;
            timelineToggle.textContent = '⏱ 收起';
            timelineToggle.style.background = '#4a2a2a';
            timelineToggle.style.borderColor = '#ff4444';
            // 显示时间线并加载数据
            if (timeline) {
                timeline.show();
                timeline.loadSchedules();
            }
        } else {
            // 隐藏右栏，恢复面板宽度
            rightColumn.style.display = 'none';
            panel.style.width = `${PANEL_WIDTH}px`;
            timelineToggle.textContent = '⏱ 时间线';
            timelineToggle.style.background = '#2a4a6a';
            timelineToggle.style.borderColor = '#4488ff';
        }
    }

    /**
     * 显示面板
     */
    function show() {
        if (!panel) init();
        panel.style.display = 'flex';
        isVisible = true;
        
        requestAnimationFrame(() => {
            render();
        });
    }

    /**
     * 隐藏面板
     */
    function hide() {
        if (panel) panel.style.display = 'none';
        isVisible = false;
    }

    /**
     * 切换面板显示
     */
    function toggle() {
        if (isVisible) hide();
        else show();
    }

    /**
     * 渲染编队可视化
     */
    function render() {
        if (!ctx) return;
        if (!isVisible) return;

        // 获取当前画布尺寸
        const W = canvas.width;
        const H = canvas.height;

        // 清空画布
        ctx.fillStyle = '#0a0a1e';
        ctx.fillRect(0, 0, W, H);

        // 绘制背景网格
        ctx.strokeStyle = '#223';
        ctx.lineWidth = 1;
        for (let i = 0; i <= W; i += 40) {
            ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, H); ctx.stroke();
        }
        for (let i = 0; i <= H; i += 40) {
            ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(W, i); ctx.stroke();
        }

        // 绘制十字准星
        ctx.strokeStyle = '#4488ff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H);
        ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2);
        ctx.stroke();

        // 获取当前卫星数据
        const lightMgr = appState.lightManager;
        if (!lightMgr) return;

        const currentMode = appState.currentMode;
        let satData = null;
        let gmst = 0;

        if (currentMode === 'csv' && appState.csv.satelliteData) {
            const idx = appState.csv.state.currentTimeIdx;
            if (appState.csv.satelliteData[idx]) {
                satData = appState.csv.satelliteData[idx].sats;
                const ts = appState.csv.satelliteData[idx].timestamp;
                const d = parseTimestamp(ts);
                gmst = calcGMST(dateToJD(d.year, d.month, d.day, d.hour, d.minute, d.second));
            }
        } else if (currentMode === 'ws' && appState.ws.lastStepData) {
            satData = appState.ws.lastStepData.map(d => ({
                X: d[8], Y: d[9], Z: d[10],
                Vx: d[11], Vy: d[12], Vz: d[13]
            }));
            const d = parseTimestamp(appState.ws.lastStepData[0][0]);
            gmst = calcGMST(dateToJD(d.year, d.month, d.day, d.hour, d.minute, d.second));
        }

        if (!satData || satData.length === 0) {
            ctx.fillStyle = '#666';
            ctx.font = '14px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('无卫星数据', W / 2, H / 2);
            return;
        }

        const { currentLat, currentLon } = appState.interaction;

        // 获取主星（第一颗卫星）数据
        const chief = satData[0];
        const chiefData = {
            X: chief.X !== undefined ? chief.X : chief[8],
            Y: chief.Y !== undefined ? chief.Y : chief[9],
            Z: chief.Z !== undefined ? chief.Z : chief[10],
            Vx: chief.Vx !== undefined ? chief.Vx : (chief[11] || 0),
            Vy: chief.Vy !== undefined ? chief.Vy : (chief[12] || 0),
            Vz: chief.Vz !== undefined ? chief.Vz : (chief[13] || 0)
        };

        // 计算 Hill 坐标 (沿轨 S, 法向 W)
        const hillCoords = [];
        satData.forEach((sat, idx) => {
            try {
                const X = sat.X !== undefined ? sat.X : sat[8];
                const Y = sat.Y !== undefined ? sat.Y : sat[9];
                const Z = sat.Z !== undefined ? sat.Z : sat[10];
                
                const hill = eciToHill(chiefData, { X, Y, Z });
                hillCoords.push({ idx, s: hill.alongTrack, w: hill.crossTrack });
            } catch (e) {
                console.error(`[CONSTELLATION] 卫星${idx} Hill坐标计算失败:`, e.message);
            }
        });

        if (hillCoords.length === 0) return;

        // 计算边界框
        let minS = Infinity, maxS = -Infinity, minW = Infinity, maxW = -Infinity;
        hillCoords.forEach(h => {
            if (h.s < minS) minS = h.s;
            if (h.s > maxS) maxS = h.s;
            if (h.w < minW) minW = h.w;
            if (h.w > maxW) maxW = h.w;
        });

        const centerS = (minS + maxS) / 2;
        const centerW = (minW + maxW) / 2;
        let spanS = maxS - minS;
        let spanW = maxW - minW;

        // 确保最小跨度（避免所有卫星在同一位置）
        if (spanS < 0.001) spanS = 0.001;
        if (spanW < 0.001) spanW = 0.001;

        // 自适应缩放：让编队填满画布的 80%
        const FILL_RATIO = 0.8;
        const maxSpan = Math.max(spanS, spanW);
        const PADDING = 40;
        const scale = (W / 2 - PADDING) / (maxSpan / 2) * FILL_RATIO;

        const satInView = [];

        hillCoords.forEach(h => {
            const offsetS = (h.s - centerS) * scale;
            const offsetW = (h.w - centerW) * scale;
            
            const x = (W / 2) + offsetS;  // S → x (沿轨方向水平)
            const y = (H / 2) - offsetW;  // W → y (法向方向垂直，注意y轴向下)

            satInView.push({
                x, y,
                idx: h.idx,
                s: h.s,
                w: h.w,
                isLightOn: lightMgr.getLightState(h.idx) || false,
                pendingCommand: confirmBar ? confirmBar.getPendingCommand(h.idx) : null,
            });
        });

        satPositions = satInView;

        // 绘制卫星
        satInView.forEach((sat) => {
            try {
                const { x, y, idx, isLightOn, pendingCommand } = sat;
                const radius = 12;

                // 确定显示状态
                let fillColor, strokeColor, textColor, isPending;
                
                if (pendingCommand === 'on') {
                    // 待开灯：黄色（无论当前状态）
                    fillColor = '#ffdd44';
                    strokeColor = '#ffaa00';
                    textColor = '#000';
                    isPending = true;
                } else if (pendingCommand === 'off') {
                    // 待关灯：绿色（无论当前状态）
                    fillColor = '#2a4a3a';
                    strokeColor = '#00ff00';
                    textColor = '#fff';
                    isPending = true;
                } else if (isLightOn) {
                    // 当前已开灯：黄色
                    fillColor = '#ffdd44';
                    strokeColor = '#ffaa00';
                    textColor = '#000';
                    isPending = false;
                } else {
                    // 当前未开灯：绿色
                    fillColor = '#2a4a3a';
                    strokeColor = '#00ff00';
                    textColor = '#fff';
                    isPending = false;
                }

                // 发光效果（开灯或待开灯时）
                if (isLightOn || pendingCommand === 'on') {
                    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius * 2);
                    gradient.addColorStop(0, 'rgba(255, 221, 68, 0.8)');
                    gradient.addColorStop(0.5, 'rgba(255, 221, 68, 0.3)');
                    gradient.addColorStop(1, 'rgba(255, 221, 68, 0)');
                    ctx.fillStyle = gradient;
                    ctx.beginPath();
                    ctx.arc(x, y, radius * 2, 0, Math.PI * 2);
                    ctx.fill();
                }

                // 待发送标记（虚线边框）
                if (isPending) {
                    ctx.beginPath();
                    ctx.arc(x, y, radius + 3, 0, Math.PI * 2);
                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = 2;
                    ctx.setLineDash([4, 4]);
                    ctx.stroke();
                    ctx.setLineDash([]);
                }

                // 卫星圆圈
                ctx.beginPath();
                ctx.arc(x, y, radius, 0, Math.PI * 2);
                ctx.fillStyle = fillColor;
                ctx.fill();
                ctx.lineWidth = 2;
                ctx.strokeStyle = strokeColor;
                ctx.stroke();

                // 卫星编号
                ctx.fillStyle = textColor;
                ctx.font = 'bold 11px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(idx, x, y);
            } catch (e) {
                console.error(`[CONSTELLATION] 绘制卫星${sat.idx} 失败:`, e.message);
            }
        });

        // 图例
        ctx.fillStyle = '#ffdd44';
        ctx.beginPath();
        ctx.arc(30, H - 30, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = '12px Arial';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText('开灯', 45, H - 30);

        ctx.fillStyle = '#2a4a3a';
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(110, H - 30, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.fillText('关灯', 125, H - 30);

        ctx.fillStyle = '#888';
        ctx.fillText('点击卫星选择/取消', 220, H - 30);
    }

    /**
     * 处理画布点击
     */
    function handleCanvasClick(event) {
        const rect = canvas.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;

        for (const sat of satPositions) {
            const dist = Math.sqrt((mouseX - sat.x) ** 2 + (mouseY - sat.y) ** 2);
            if (dist <= 15) {
                // 切换待发送指令
                const currentLight = appState.lightManager ? appState.lightManager.getLightState(sat.idx) : false;
                const pending = confirmBar ? confirmBar.getPendingCommand(sat.idx) : null;
                
                if (pending) {
                    // 已选中，取消选择
                    confirmBar.toggleCommand(sat.idx, pending);
                } else {
                    // 未选中，根据当前灯光状态决定目标
                    const targetCommand = currentLight ? 'off' : 'on';
                    confirmBar.toggleCommand(sat.idx, targetCommand);
                }
                
                render();
                return;
            }
        }
    }

    /**
     * 处理图案上传
     */
    async function handlePatternUpload() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            try {
                console.log('[PATTERN] 开始处理图像:', file.name);
                
                // 获取卫星数量
                const satCount = appState.config?.satCount || satPositions.length || 100;
                
                try {
                    const currentMode = appState.currentMode;
                    let chiefState = null;
                    let gmst = 0;
                    
                    if (currentMode === 'csv' && appState.csv.satelliteData) {
                        const idx = appState.csv.state.currentTimeIdx;
                        console.log(`[PATTERN] CSV模式: 时间索引=${idx}, 总帧数=${appState.csv.satelliteData.length}`);
                        if (appState.csv.satelliteData[idx]) {
                            const s = appState.csv.satelliteData[idx].sats[0]; // 主星 (第一颗)
                            chiefState = { X: s.X, Y: s.Y, Z: s.Z, Vx: s.Vx, Vy: s.Vy, Vz: s.Vz };
                            const ts = appState.csv.satelliteData[idx].timestamp;
                            console.log(`[PATTERN] 当前时间戳: ${ts}`);
                            const d = parseTimestamp(ts);
                            gmst = calcGMST(dateToJD(d.year, d.month, d.day, d.hour, d.minute, d.second));
                        }
                    } else if (currentMode === 'ws' && appState.ws.lastStepData) {
                        const d0 = appState.ws.lastStepData[0];
                        console.log(`[PATTERN] WS模式: 时间戳=${d0[0]}`);
                        chiefState = { X: d0[8], Y: d0[9], Z: d0[10], Vx: d0[11], Vy: d0[12], Vz: d0[13] };
                        const d = parseTimestamp(d0[0]);
                        gmst = calcGMST(dateToJD(d.year, d.month, d.day, d.hour, d.minute, d.second));
                    }
                    
                    if (chiefState) {
                        const { currentLat, currentLon } = appState.interaction;
                        transformMatrix = computeHillToGroundMatrix(chiefState, currentLat, currentLon, gmst);
                        const chiefEcef = eciToEcef(chiefState.X, chiefState.Y, chiefState.Z, gmst);
                        const chiefLocal = ecefToLocal(chiefEcef.x, chiefEcef.y, chiefEcef.z, currentLat, currentLon);
                        if (transformMatrix) {
                            console.log(`[PATTERN] M⁻¹: a=${transformMatrix.a.toFixed(4)}, b=${transformMatrix.b.toFixed(4)}, c=${transformMatrix.c.toFixed(4)}, d=${transformMatrix.d.toFixed(4)} | 方位角: ${chiefLocal.az.toFixed(1)}°, 仰角: ${chiefLocal.el.toFixed(1)}°`);
                        } else {
                            console.log(`[PATTERN] 编队不可见 (仰角=${chiefLocal.el.toFixed(1)}°)，跳过补偿`);
                        }
                        console.log(`[PATTERN] 主星 ECI: X=${chiefState.X.toFixed(1)}, Y=${chiefState.Y.toFixed(1)}, Z=${chiefState.Z.toFixed(1)} | GMST=${(gmst/DEG).toFixed(2)}°`);
                    }
                } catch (e) {
                    console.warn('[PATTERN] 计算地面补偿角失败，跳过旋转:', e.message);
                }
                
                // 使用 Hill 坐标 (S, W) 而非屏幕坐标进行匹配
                const hillPositions = satPositions.map(s => ({ x: s.s, y: s.w, idx: s.idx }));
                // 处理图像（传入 M⁻¹ 矩阵，processImage 内部禁用角度搜索）
                const { lightMap, previewData, shapePoints, transform, width, height } = 
                    await processImage(file, hillPositions, satCount, { transformMatrix });
                
                console.log(`[PATTERN] 变换: scale=${transform?.bestScale?.toFixed(3)}, tx=${transform?.bestTx?.toFixed(2)}, ty=${transform?.bestTy?.toFixed(2)}`);
                
                console.log(`[PATTERN] 图像处理完成: ${width}x${height}`);
                console.log(`[PATTERN] 形状点: ${shapePoints.length}, 变换: angle=${transform?.bestAngle?.toFixed(1)}°, scale=${transform?.bestScale?.toFixed(3)}, tx=${transform?.bestTx?.toFixed(2)}, ty=${transform?.bestTy?.toFixed(2)}`);
                console.log(`[PATTERN] 点亮卫星: ${lightMap.size} 颗`);
                
                // 应用灯光状态
                const lightMgr = appState.lightManager;
                if (lightMgr) {
                    // 先关闭所有灯光
                    for (let i = 0; i < satCount; i++) {
                        lightMgr.setLight(i, false);
                    }
                    
                    // 点亮图案对应的卫星
                    lightMap.forEach((isOn, idx) => {
                        if (isOn) {
                            lightMgr.setLight(idx, true);
                        }
                    });
                    
                    console.log('[PATTERN] 灯光已应用');
                }
                
                // 重新渲染
                render();
                
            } catch (err) {
                console.error('[PATTERN] 图像处理失败:', err);
                alert('图像处理失败: ' + err.message);
            }
        };
        
        input.click();
    }

    /**
     * 重置灯光
     */
    function handleResetLights() {
        const lightMgr = appState.lightManager;
        if (!lightMgr) return;
        
        const satCount = appState.config?.satCount || satPositions.length || 100;
        
        // 关闭所有灯光
        for (let i = 0; i < satCount; i++) {
            lightMgr.setLight(i, false);
        }
        
        // 清空确认栏
        if (confirmBar) {
            confirmBar.clear();
        }
        
        console.log('[PATTERN] 灯光已重置');
        render();
    }

    /**
     * 更新面板
     */
    function update() {
        if (isVisible) {
            render();
        }
    }

    /**
     * 接收后端响应，更新灯光状态
     */
    function handleLightResponse(data) {
        console.log('[CONSTELLATION] handleLightResponse 被调用:', data);
        if (!data || !data.results) {
            console.warn('[CONSTELLATION] 数据格式错误:', data);
            return;
        }
        
        const lightMgr = appState.lightManager;
        if (!lightMgr) {
            console.warn('[CONSTELLATION] lightManager 未初始化');
            return;
        }

        data.results.forEach(r => {
            if (r.success) {
                console.log(`[CONSTELLATION] 更新卫星${r.sat_id} 灯光: ${r.light_state}`);
                lightMgr.setLight(r.sat_id, r.light_state);
            } else {
                console.warn(`[CONSTELLATION] 卫星${r.sat_id} 控制失败:`, r.error);
            }
        });

        // 清空确认栏
        if (confirmBar) {
            confirmBar.clear();
        }

        render();
    }

    return {
        init,
        show,
        hide,
        toggle,
        render,
        update,
        getPanel: () => panel,
        getConfirmBar: () => confirmBar,
        handleLightResponse,
    };
}

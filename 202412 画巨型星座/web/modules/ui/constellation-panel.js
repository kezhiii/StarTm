// ======================== 卫星编队可视化面板 ========================
import * as THREE from 'three';
import { parseTimestamp, dateToJD, calcGMST, eciToEcef, ecefToLocal } from '../math-utils.js';
import { DEG, RE_KM, RE_3D } from '../config.js';
import { createProtocolConfirmBar } from './protocol-confirm-bar.js';

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
            height: ${PANEL_HEIGHT + 100}px;
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
        
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✕';
        closeBtn.style.cssText = 'background: none; border: none; color: #fff; font-size: 20px; cursor: pointer;';
        closeBtn.onclick = hide;

        titleBar.appendChild(title);
        titleBar.appendChild(closeBtn);
        panel.appendChild(titleBar);

        // 画布
        canvas = document.createElement('canvas');
        canvas.width = PANEL_WIDTH;
        canvas.height = PANEL_HEIGHT;
        canvas.style.cssText = 'border: 1px solid #333; border-radius: 5px; cursor: pointer;';
        canvas.onclick = handleCanvasClick;
        panel.appendChild(canvas);

        ctx = canvas.getContext('2d');

        // 初始化确认栏
        confirmBar = createProtocolConfirmBar(appState, {
            onConfirm: handleConfirmSend,
            onClear: handleClearSelection,
        });
        confirmBar.init(panel);

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

        // 清空画布
        ctx.fillStyle = '#0a0a1e';
        ctx.fillRect(0, 0, PANEL_WIDTH, PANEL_HEIGHT);

        // 绘制背景网格
        ctx.strokeStyle = '#223';
        ctx.lineWidth = 1;
        for (let i = 0; i <= PANEL_WIDTH; i += 40) {
            ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, PANEL_HEIGHT); ctx.stroke();
        }
        for (let i = 0; i <= PANEL_HEIGHT; i += 40) {
            ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(PANEL_WIDTH, i); ctx.stroke();
        }

        // 绘制十字准星
        ctx.strokeStyle = '#4488ff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(PANEL_WIDTH / 2, 0); ctx.lineTo(PANEL_WIDTH / 2, PANEL_HEIGHT);
        ctx.moveTo(0, PANEL_HEIGHT / 2); ctx.lineTo(PANEL_WIDTH, PANEL_HEIGHT / 2);
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
                X: d[8], Y: d[9], Z: d[10]
            }));
            const d = parseTimestamp(appState.ws.lastStepData[0][0]);
            gmst = calcGMST(dateToJD(d.year, d.month, d.day, d.hour, d.minute, d.second));
        }

        if (!satData || satData.length === 0) {
            ctx.fillStyle = '#666';
            ctx.font = '14px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('无卫星数据', PANEL_WIDTH / 2, PANEL_HEIGHT / 2);
            return;
        }

        const { currentLat, currentLon } = appState.interaction;

        // 计算方位角和仰角
        const rawAngles = [];
        satData.forEach((sat, idx) => {
            try {
                const X = sat.X !== undefined ? sat.X : sat[8];
                const Y = sat.Y !== undefined ? sat.Y : sat[9];
                const Z = sat.Z !== undefined ? sat.Z : sat[10];

                const ecef = eciToEcef(X, Y, Z, gmst);
                const local = ecefToLocal(ecef.x, ecef.y, ecef.z, currentLat, currentLon);
                
                let az = local.az;
                if (az > 180) az -= 360;

                rawAngles.push({ idx, az, el: local.el });
            } catch (e) {
                console.error(`[CONSTELLATION] 卫星${idx} 处理失败:`, e.message);
            }
        });

        if (rawAngles.length === 0) return;

        // 计算边界框
        let minAz = Infinity, maxAz = -Infinity, minEl = Infinity, maxEl = -Infinity;
        rawAngles.forEach(s => {
            if (s.az < minAz) minAz = s.az;
            if (s.az > maxAz) maxAz = s.az;
            if (s.el < minEl) minEl = s.el;
            if (s.el > maxEl) maxEl = s.el;
        });

        const centerAz = (minAz + maxAz) / 2;
        const centerEl = (minEl + maxEl) / 2;
        let spanAz = maxAz - minAz;
        let spanEl = maxEl - minEl;

        if (spanAz < 0.0001) spanAz = 0.0001;
        if (spanEl < 0.0001) spanEl = 0.0001;

        const FORMATION_SCALE = 5;
        spanAz *= FORMATION_SCALE;
        spanEl *= FORMATION_SCALE;

        const maxSpan = Math.max(spanAz, spanEl);
        const PADDING = 20;
        const viewSpan = maxSpan * 1.15;
        const scale = (PANEL_WIDTH / 2 - PADDING) / (viewSpan / 2);

        const satInView = [];

        rawAngles.forEach(s => {
            const offsetAz = (s.az - centerAz) * FORMATION_SCALE;
            const offsetEl = (s.el - centerEl) * FORMATION_SCALE;
            
            const x = (PANEL_WIDTH / 2) + offsetAz * scale;
            const y = (PANEL_HEIGHT / 2) - offsetEl * scale;

            satInView.push({
                x, y,
                idx: s.idx,
                az: s.az,
                el: s.el,
                isLightOn: lightMgr.getLightState(s.idx) || false,
                pendingCommand: confirmBar ? confirmBar.getPendingCommand(s.idx) : null,
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
        ctx.arc(30, PANEL_HEIGHT - 30, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = '12px Arial';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText('开灯', 45, PANEL_HEIGHT - 30);

        ctx.fillStyle = '#2a4a3a';
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(110, PANEL_HEIGHT - 30, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.fillText('关灯', 125, PANEL_HEIGHT - 30);

        ctx.fillStyle = '#888';
        ctx.fillText('点击卫星选择/取消', 220, PANEL_HEIGHT - 30);
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

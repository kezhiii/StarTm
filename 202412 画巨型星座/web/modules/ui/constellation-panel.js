// ======================== 卫星编队可视化面板 ========================
import * as THREE from 'three';
import { parseTimestamp, dateToJD, calcGMST, eciToEcef, ecefToLocal } from '../math-utils.js';
import { DEG, RE_KM, RE_3D } from '../config.js';

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
            height: ${PANEL_HEIGHT + 60}px;
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

        // 添加到页面
        document.body.appendChild(panel);
    }

    /**
     * 显示面板
     */
    function show() {
        if (!panel) init();
        panel.style.display = 'flex';
        isVisible = true;
        
        // 使用 requestAnimationFrame 确保 DOM 更新后再绘制
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
        if (!ctx) {
            console.error('[CONSTELLATION] ctx 为空，无法绘制');
            return;
        }
        if (!isVisible) return;

        // 清空画布
        ctx.fillStyle = '#0a0a1e';
        ctx.fillRect(0, 0, PANEL_WIDTH, PANEL_HEIGHT);

        // 绘制背景网格（模拟天空）
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

        // 获取当前帧的卫星数据
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

        // 计算观测者位置（使用当前经纬度）
        const { currentLat, currentLon } = appState.interaction;

        // 第一遍：计算所有卫星的真实方位角和仰角
        const rawAngles = [];
        satData.forEach((sat, idx) => {
            try {
                const X = sat.X !== undefined ? sat.X : sat[8];
                const Y = sat.Y !== undefined ? sat.Y : sat[9];
                const Z = sat.Z !== undefined ? sat.Z : sat[10];

                const ecef = eciToEcef(X, Y, Z, gmst);
                const local = ecefToLocal(ecef.x, ecef.y, ecef.z, currentLat, currentLon);
                
                let az = local.az;
                if (az > 180) az -= 360; // 归一化到 -180~180

                rawAngles.push({ idx, az, el: local.el });
            } catch (e) {
                console.error(`[CONSTELLATION] 卫星${idx} 处理失败:`, e.message);
            }
        });

        if (rawAngles.length === 0) return;

        // 计算编队边界框
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

        // Handle Tiny Spans
        if (spanAz < 0.0001) spanAz = 0.0001;
        if (spanEl < 0.0001) spanEl = 0.0001;

        // 关键修复：应用与 3D 场景相同的 Formation Scale (放大5倍)
        // 使面板上的卫星分布与第一视角下看到的视觉效果一致
        const FORMATION_SCALE = 5;
        spanAz *= FORMATION_SCALE;
        spanEl *= FORMATION_SCALE;

        // Uniform Zoom (Preserve Aspect Ratio)
        const maxSpan = Math.max(spanAz, spanEl);
        const PADDING = 20;
        const viewSpan = maxSpan * 1.15; // 15% 边距
        const scale = (PANEL_WIDTH / 2 - PADDING) / (viewSpan / 2); // 像素/度

        const satInView = [];

        // Map Coordinates
        rawAngles.forEach(s => {
            // 同样放大偏移量
            const offsetAz = (s.az - centerAz) * FORMATION_SCALE;
            const offsetEl = (s.el - centerEl) * FORMATION_SCALE;
            
            const x = (PANEL_WIDTH / 2) + offsetAz * scale;
            const y = (PANEL_HEIGHT / 2) - offsetEl * scale;

            satInView.push({
                x, y,
                idx: s.idx,
                az: s.az,
                el: s.el,
                isLightOn: lightMgr.getLightState(s.idx) || false
            });
        });

        satPositions = satInView;

        // 绘制卫星
        let drawCount = 0;
        
        satInView.forEach((sat, i) => {
            try {
                const { x, y, idx, isLightOn } = sat;
                const radius = 12;

                // 发光效果（开灯时）
                if (isLightOn) {
                    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius * 2);
                    gradient.addColorStop(0, 'rgba(255, 221, 68, 0.8)');
                    gradient.addColorStop(0.5, 'rgba(255, 221, 68, 0.3)');
                    gradient.addColorStop(1, 'rgba(255, 221, 68, 0)');
                    ctx.fillStyle = gradient;
                    ctx.beginPath();
                    ctx.arc(x, y, radius * 2, 0, Math.PI * 2);
                    ctx.fill();
                }

                // 卫星圆圈
                ctx.beginPath();
                ctx.arc(x, y, radius, 0, Math.PI * 2);
                if (isLightOn) {
                    ctx.fillStyle = '#ffdd44';
                    ctx.strokeStyle = '#ffaa00';
                } else {
                    ctx.fillStyle = '#2a4a3a';
                    ctx.strokeStyle = '#00ff00';
                }
                ctx.fill();
                ctx.lineWidth = 2;
                ctx.stroke();

                // 卫星编号
                ctx.fillStyle = isLightOn ? '#000' : '#fff';
                ctx.font = 'bold 11px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(idx, x, y);
                
                drawCount++;
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
        ctx.fillText('点击卫星切换灯光状态', 200, PANEL_HEIGHT - 30);
    }

    /**
     * 处理画布点击
     */
    function handleCanvasClick(event) {
        const rect = canvas.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;

        // 查找点击的卫星
        for (const sat of satPositions) {
            const dist = Math.sqrt((mouseX - sat.x) ** 2 + (mouseY - sat.y) ** 2);
            if (dist <= 15) { // 15 是点击半径
                // 切换灯光状态
                const lightMgr = appState.lightManager;
                if (lightMgr) {
                    const newState = lightMgr.toggleLight(sat.idx);
                    render(); // 重新渲染
                    
                    // 同步左侧面板复选框
                    if (appState.satLightControls) {
                        appState.satLightControls.syncUI();
                    }
                }
                return;
            }
        }
    }

    /**
     * 在动画循环中更新面板（可选）
     */
    function update() {
        if (isVisible) {
            render();
        }
    }

    return {
        init,
        show,
        hide,
        toggle,
        render,
        update,
        getPanel: () => panel
    };
}

// ======================== 星空粒子系统模块 ========================
import * as THREE from 'three';

// 推荐：本地加载 8K 银河贴图（最稳定，无跨域问题，加载速度极快）
// 请确保已将图片下载并放置在 web 目录下
const TEXTURE_URL = './image/milky_way.jpg'; 

/**
 * 创建星空背景（使用贴图球体）
 * @param {THREE.Scene} scene - Three.js 场景
 * @param {Object} appState - 应用状态
 */
export function createStarField(scene, appState) {
    try {
        console.log('[STARS] 正在通过备用代理加载 8K 银河贴图...');
        scene.background = new THREE.Color(0x000005);

        const loader = new THREE.TextureLoader();
        
        loader.load(
            TEXTURE_URL,
            (texture) => {
                texture.colorSpace = THREE.SRGBColorSpace;
                texture.anisotropy = 16;
                
                const starGeometry = new THREE.SphereGeometry(10000, 64, 32);
                const starMaterial = new THREE.MeshBasicMaterial({
                    map: texture,
                    side: THREE.BackSide,
                    depthWrite: false,
                    fog: false
                });
                
                const starField = new THREE.Mesh(starGeometry, starMaterial);
                starField.renderOrder = -1000;
                starField.userData.isStarField = true; // 关键：标记为星空，防止被 clearSceneObjects 清除
                scene.add(starField);

                // 不要将 texture 设置为 scene.background，否则会变成静态背景不随相机转动
                // scene.background = texture;  // 已移除

                if (appState && appState.sceneObjects) {
                    appState.sceneObjects.starField = starField;
                }
                console.log('[STARS] 8K 银河贴图加载成功');
            },
            undefined,
            (err) => {
                console.warn('[STARS] 代理加载失败，回退到高保真粒子星空');
                createRealisticStarField(scene, appState);
            }
        );
    } catch (e) {
        console.error('[STARS] 星空创建异常，回退到粒子系统:', e);
        createRealisticStarField(scene, appState);
    }
}

/**
 * 回退方案：使用增强的程序化粒子系统创建自然星空 (15000 颗)
 */
function createRealisticStarField(scene, appState) {
    try {
        const count = 15000;
        const starsGeometry = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);
        const sizes = new Float32Array(count);

        // 模拟真实恒星光谱颜色
        const colorPalette = [
            new THREE.Color(0xffffff), // 纯白 (O/B 型)
            new THREE.Color(0xaaccff), // 浅蓝 (A 型)
            new THREE.Color(0xffddaa), // 暖黄 (G/K 型)
            new THREE.Color(0xffaaaa), // 偏红 (M 型)
            new THREE.Color(0x99ccff), // 蓝白
        ];

        for (let i = 0; i < count; i++) {
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const r = 9000;

            positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
            positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
            positions[i * 3 + 2] = r * Math.cos(phi);

            const color = colorPalette[Math.floor(Math.random() * colorPalette.length)];
            colors[i * 3] = color.r;
            colors[i * 3 + 1] = color.g;
            colors[i * 3 + 2] = color.b;

            // 随机大小（亮度），模拟真实星等差异
            const rand = Math.random();
            sizes[i] = rand < 0.005 ? 25 : (rand < 0.05 ? 12 : (rand < 0.35 ? 6 : 3));
        }

        starsGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        starsGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        starsGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

        // 动态生成高质量圆形光晕纹理
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const context = canvas.getContext('2d');
        const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
        gradient.addColorStop(0, 'rgba(255,255,255,1)');
        gradient.addColorStop(0.1, 'rgba(255,255,255,0.8)');
        gradient.addColorStop(0.4, 'rgba(255,255,255,0.2)');
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        context.fillStyle = gradient;
        context.fillRect(0, 0, 64, 64);
        const starTexture = new THREE.CanvasTexture(canvas);

        const starsMaterial = new THREE.PointsMaterial({
            size: 8,
            vertexColors: true,
            map: starTexture,
            sizeAttenuation: false,
            transparent: true,
            opacity: 0.95,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });

        const starField = new THREE.Points(starsGeometry, starsMaterial);
        starField.renderOrder = -999;
        starField.userData.isStarField = true; // 关键：标记为星空，防止被 clearSceneObjects 清除
        scene.add(starField);

        if (appState && appState.sceneObjects) {
            appState.sceneObjects.starField = starField;
        }
        console.log(`[STARS] 高保真星空粒子系统已创建 (粒子数: ${count})`);
    } catch (e) {
        console.error('[STARS] 粒子星空创建失败:', e);
    }
}


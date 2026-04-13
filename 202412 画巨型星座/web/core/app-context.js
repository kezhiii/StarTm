// ======================== 应用上下文模块 ========================
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/**
 * 创建应用上下文，封装核心 Three.js 对象和状态快捷方式
 */
export function createAppContext() {
    let scene = null;
    let camera = null;
    let renderer = null;
    let controls = null;
    const cameraPanOffset = new THREE.Vector3(0, 0, 0);

    return {
        // Three.js 核心对象
        get scene() { return scene; },
        set scene(val) { scene = val; },
        get camera() { return camera; },
        set camera(val) { camera = val; },
        get renderer() { return renderer; },
        set renderer(val) { renderer = val; },
        get controls() { return controls; },
        set controls(val) { controls = val; },

        // 相机偏移
        get cameraPanOffset() { return cameraPanOffset; },

        // 渲染便捷方法
        render() {
            if (renderer && scene && camera) {
                renderer.render(scene, camera);
            }
        },

        /**
         * 初始化 Three.js 场景基础元素
         * @param {HTMLElement} container - 容器元素
         * @param {Object} appState - 应用状态
         * @returns {Object} { scene, camera, renderer, controls }
         */
        initBaseScene(container, appState) {
            scene = new THREE.Scene();
            scene.background = new THREE.Color(0x000011);
            
            camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 20000);
            appState.camera = camera;
            
            renderer = new THREE.WebGLRenderer({ antialias: true });
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            renderer.setSize(window.innerWidth, window.innerHeight);
            container.appendChild(renderer.domElement);
            
            // 基础光照
            scene.add(new THREE.AmbientLight(0x333344, 0.6));
            const sun = new THREE.DirectionalLight(0xffffff, 1.2);
            sun.position.set(100, 50, 100);
            scene.add(sun);
            
            // 控制器
            controls = new OrbitControls(camera, renderer.domElement);
            controls.enableDamping = true;
            controls.dampingFactor = 0.05;
            
            // 窗口大小调整
            window.addEventListener('resize', () => {
                camera.aspect = window.innerWidth / window.innerHeight;
                camera.updateProjectionMatrix();
                renderer.setSize(window.innerWidth, window.innerHeight);
            });
            
            return { scene, camera, renderer, controls };
        }
    };
}

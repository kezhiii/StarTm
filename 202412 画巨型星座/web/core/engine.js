// ======================== Three.js 运行时引擎 ========================
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const DBG = {
    log: (...a) => console.log('[ENGINE]', ...a),
    warn: (...a) => console.warn('[ENGINE]', ...a)
};

/**
 * 创建 Three.js 引擎实例
 * 封装 scene, camera, renderer, controls
 */
export function createEngine(container) {
    DBG.log('初始化 Three.js 引擎');

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000011);

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 20000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);

    // 默认光照
    scene.add(new THREE.AmbientLight(0x333344, 0.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.position.set(100, 50, 100);
    scene.add(sun);

    // 控制器
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    // 响应式
    const onResize = () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', onResize);

    return {
        scene,
        camera,
        renderer,
        controls,
        /**
         * 设置控制器状态
         */
        setControls(opts = {}) {
            if (opts.enabled !== undefined) controls.enabled = opts.enabled;
            if (opts.autoRotate !== undefined) controls.autoRotate = opts.autoRotate;
            if (opts.autoRotateSpeed !== undefined) controls.autoRotateSpeed = opts.autoRotateSpeed;
            if (opts.enableRotate !== undefined) controls.enableRotate = opts.enableRotate;
            if (opts.enablePan !== undefined) controls.enablePan = opts.enablePan;
            if (opts.enableZoom !== undefined) controls.enableZoom = opts.enableZoom;
            if (opts.minDistance !== undefined) controls.minDistance = opts.minDistance;
            if (opts.maxDistance !== undefined) controls.maxDistance = opts.maxDistance;
            if (opts.dampingFactor !== undefined) controls.dampingFactor = opts.dampingFactor;
            if (opts.update) controls.update();
        },
        /**
         * 设置相机位置和目标
         */
        setCamera(pos, target, up = new THREE.Vector3(0, 1, 0)) {
            camera.position.copy(pos);
            controls.target.copy(target);
            camera.up.copy(up);
            controls.update();
        },
        /**
         * 调整光照
         */
        setSunPosition(dist = 100) {
            scene.traverse(obj => {
                if (obj.isDirectionalLight) obj.position.set(dist, 50, dist);
            });
        },
        /**
         * 渲染场景
         */
        render() {
            renderer.render(scene, camera);
        },
        /**
         * 销毁
         */
        dispose() {
            window.removeEventListener('resize', onResize);
            renderer.dispose();
        }
    };
}

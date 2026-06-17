// ======================== 纹理加载器模块 ========================
import * as THREE from 'three';

// 纹理 URL 配置
const TEXTURE_URLS = {
    earth: 'https://unpkg.com/three-globe@2.31.1/example/img/earth-blue-marble.jpg',
    moon: 'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/moon_1024.jpg'
};

const DBG = {
    warn: (m, ...a) => console.warn(`[TEX-LOADER] [${m}]`, ...a)
};

/**
 * 加载所有纹理
 * @returns {Promise<{earth: THREE.Texture|null, moon: THREE.Texture|null}>}
 */
export function loadTextures() {
    return new Promise((resolve) => {
        const loader = new THREE.TextureLoader();
        let loadedCount = 0;
        const result = { earth: null, moon: null };
        const checkDone = () => { if (++loadedCount >= 2) resolve(result); };

        loader.load(TEXTURE_URLS.earth,
            (t) => { result.earth = t; checkDone(); },
            undefined, () => { DBG.warn('INIT', '地球纹理加载失败'); checkDone(); }
        );
        loader.load(TEXTURE_URLS.moon,
            (t) => { result.moon = t; checkDone(); },
            undefined, () => { DBG.warn('INIT', '月球纹理加载失败'); checkDone(); }
        );
    });
}

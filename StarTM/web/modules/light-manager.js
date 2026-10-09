// ======================== 卫星灯光管理模块 ========================
import * as THREE from 'three';

// 灯光配置
const LIGHT_CONFIG = {
    // 开灯时的颜色（黄色/白色）
    onColor: {
        visible: 0xffff00,  // 可见卫星开灯：亮黄色
        hidden: 0xffaa00    // 隐藏卫星开灯：橙色
    },
    // 关灯时的颜色（默认）
    offColor: {
        visible: 0x00ff00,  // 可见卫星关灯：绿色
        hidden: 0xff3333    // 隐藏卫星关灯：红色
    },
    // 发光强度
    emissiveIntensity: 0.6,
    // 发光颜色
    emissiveColor: 0xffdd44  // 暖黄色发光
};

/**
 * 创建灯光管理器
 * @param {Function} getSceneObjectsFn - 获取 sceneObjects 的函数（延迟获取）
 */
export function createLightManager(getSceneObjectsFn) {
    // 卫星灯光状态 Map: satIdx -> { isOn: boolean }
    const lightStates = new Map();
    
    return {
        /**
         * 初始化卫星灯光状态
         * @param {number} satCount - 卫星总数
         */
        init(satCount) {
            for (let i = 0; i < satCount; i++) {
                lightStates.set(i, { isOn: false });
            }
        },

        /**
         * 切换卫星灯光状态
         * @param {number} satIdx - 卫星索引
         * @param {boolean} isOn - 是否开灯
         */
        setLight(satIdx, isOn) {
            if (!lightStates.has(satIdx)) {
                console.warn(`[LIGHT] 卫星 ${satIdx} 不存在`);
                return;
            }

            lightStates.set(satIdx, { isOn });
            this._updateSatelliteLight(satIdx, isOn);
        },

        /**
         * 切换卫星灯光状态（切换开/关）
         * @param {number} satIdx - 卫星索引
         */
        toggleLight(satIdx) {
            const state = lightStates.get(satIdx);
            if (state) {
                const newState = !state.isOn;
                lightStates.set(satIdx, { isOn: newState });
                this._updateSatelliteLight(satIdx, newState);
                return newState;
            }
            return false;
        },

        /**
         * 获取卫星灯光状态
         * @param {number} satIdx - 卫星索引
         * @returns {boolean|null}
         */
        getLightState(satIdx) {
            const state = lightStates.get(satIdx);
            return state ? state.isOn : null;
        },

        /**
         * 获取所有卫星灯光状态
         * @returns {Map}
         */
        getAllStates() {
            return new Map(lightStates);
        },

        /**
         * 全部开灯
         */
        turnAllOn() {
            lightStates.forEach((state, idx) => {
                state.isOn = true;
                this._updateSatelliteLight(idx, true);
            });
        },

        /**
         * 全部关灯
         */
        turnAllOff() {
            lightStates.forEach((state, idx) => {
                state.isOn = false;
                this._updateSatelliteLight(idx, false);
            });
        },

        /**
         * 随机开灯
         * @param {number} count - 开灯数量
         */
        turnRandomOn(count = 5) {
            this.turnAllOff();
            const indices = Array.from(lightStates.keys());
            // 随机打乱
            for (let i = indices.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [indices[i], indices[j]] = [indices[j], indices[i]];
            }
            // 开启前 count 个
            for (let i = 0; i < Math.min(count, indices.length); i++) {
                this.setLight(indices[i], true);
            }
        },

        /**
         * 更新卫星灯光视觉效果
         * @private
         */
        _updateSatelliteLight(satIdx, isOn) {
            // 动态获取 sceneObjects（确保获取到最新创建的对象）
            const sceneObjects = getSceneObjectsFn ? getSceneObjectsFn() : null;
            if (!sceneObjects) {
                if (satIdx === 0) console.warn('[LIGHT] sceneObjects is null');
                return;
            }

            // 尝试所有可能的卫星网格数组（注意：空数组 [] 是 truthy，必须检查 length）
            const meshes = sceneObjects.satelliteMeshes3D?.length ? sceneObjects.satelliteMeshes3D :
                          (sceneObjects.satelliteMeshes1D?.length ? sceneObjects.satelliteMeshes1D :
                          sceneObjects.satelliteMeshesCenter);

            if (!meshes) {
                if (satIdx === 0) console.warn('[LIGHT] 找不到卫星网格数组');
                return;
            }

            if (!meshes[satIdx]) {
                if (satIdx === 0) console.warn(`[LIGHT] 卫星 ${satIdx} 不存在 (数组长度: ${meshes.length})`);
                return;
            }

            const mesh = meshes[satIdx];

            // 关键修复：检查网格是否仍然有效，防止视角切换时操作已销毁的网格
            if (!mesh || !mesh.parent) {
                return;
            }

            // 组合模型（箱体+翼+发光面）本体材质在子网格上；球体模型直接用自身材质
            const body = mesh.userData?.body || mesh;
            const face = mesh.userData?.face;
            if (!body.material || body.material.disposed) {
                return;
            }

            const isVisible = mesh.visible;

            if (isOn) {
                // 点亮：对地发光面发暖光，本体按可见性着色
                if (face) {
                    face.material.color.setHex(0xfff0b8);
                    face.material.opacity = 1;
                }
                body.material.emissive.setHex(LIGHT_CONFIG.emissiveColor);
                body.material.emissiveIntensity = LIGHT_CONFIG.emissiveIntensity;
                body.material.color.setHex(isVisible ? LIGHT_CONFIG.onColor.visible : LIGHT_CONFIG.onColor.hidden);
            } else {
                if (face) {
                    face.material.color.setHex(0x2a2a35);
                }
                body.material.emissive.setHex(0x000000);
                body.material.emissiveIntensity = 0;
                body.material.color.setHex(isVisible ? LIGHT_CONFIG.offColor.visible : LIGHT_CONFIG.offColor.hidden);
            }
        },

        /**
         * 应用灯光状态到所有卫星（用于渲染循环中调用）
         */
        applyAll() {
            lightStates.forEach((state, idx) => {
                this._updateSatelliteLight(idx, state.isOn);
            });
        },

        /**
         * 获取配置
         */
        getConfig() {
            return LIGHT_CONFIG;
        }
    };
}

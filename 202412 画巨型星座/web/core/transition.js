// ======================== 视角过渡动画 ========================

/**
 * 创建过渡动画管理器
 * @param {Function} getControls - 返回 controls 对象的函数
 * @param {Function} getCamera - 返回 camera 对象的函数
 * @param {Object} cache - 缓存对象
 */
export function createTransitionManager(getControls, getCamera, cache) {
    return {
        /**
         * 从起点到终点的相机过渡动画
         */
        animateFrom(targetPos, targetLookAt, targetView, duration, onComplete, startPos, startTarget) {
            if (cache.transitionAnimId) {
                cancelAnimationFrame(cache.transitionAnimId);
                cache.transitionAnimId = null;
            }

            const controls = getControls();
            const camera = getCamera();
            if (!controls || !camera) return;

            const wasEnabled = controls.enabled;
            controls.enabled = false;
            controls.target.copy(targetLookAt);

            const startTime = performance.now();
            function step(now) {
                const t = Math.min((now - startTime) / duration, 1);
                const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
                camera.position.lerpVectors(startPos, targetPos, ease);

                if (t < 1) {
                    cache.transitionAnimId = requestAnimationFrame(step);
                } else {
                    cache.transitionAnimId = null;
                    controls.enabled = wasEnabled;
                    if (targetView === 'third') controls.update();
                    onComplete?.();
                }
            }
            cache.transitionAnimId = requestAnimationFrame(step);
        },

        /**
         * 取消当前动画
         */
        cancel() {
            if (cache.transitionAnimId) {
                cancelAnimationFrame(cache.transitionAnimId);
                cache.transitionAnimId = null;
            }
        },

        /**
         * 是否正在播放动画
         */
        isAnimating() {
            return !!cache.transitionAnimId;
        }
    };
}

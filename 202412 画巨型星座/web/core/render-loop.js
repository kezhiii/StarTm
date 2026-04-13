// ======================== 渲染循环管理器 ========================
const DBG = {
    log: (...a) => console.log('[RENDER-LOOP]', ...a)
};

/**
 * 创建渲染循环管理器
 * 管理 rAF 循环，支持多阶段更新 (pre-update, post-update)
 */
export function createRenderLoop(engine) {
    let isRunning = false;
    let animId = null;
    const preUpdateHooks = [];
    const postUpdateHooks = [];
    const onceHooks = [];

    function loop() {
        if (!isRunning) return;

        // 执行 pre-update 钩子
        for (const fn of preUpdateHooks) {
            try { fn(engine); } catch (e) { console.error('[RENDER-LOOP] pre-update 错误:', e); }
        }

        // 执行 once 钩子（仅执行一次）
        for (const fn of onceHooks.splice(0)) {
            try { fn(engine); } catch (e) { console.error('[RENDER-LOOP] once 钩子错误:', e); }
        }

        // 渲染
        engine.render();

        // 执行 post-update 钩子
        for (const fn of postUpdateHooks) {
            try { fn(engine); } catch (e) { console.error('[RENDER-LOOP] post-update 错误:', e); }
        }

        animId = requestAnimationFrame(loop);
    }

    return {
        /**
         * 启动循环
         */
        start() {
            if (isRunning) return;
            isRunning = true;
            DBG.log('启动渲染循环');
            loop();
        },
        /**
         * 停止循环
         */
        stop() {
            isRunning = false;
            if (animId) {
                cancelAnimationFrame(animId);
                animId = null;
            }
            DBG.log('停止渲染循环');
        },
        /**
         * 添加 pre-update 钩子（每帧渲染前执行）
         */
        onPreUpdate(fn) {
            preUpdateHooks.push(fn);
            return () => {
                const idx = preUpdateHooks.indexOf(fn);
                if (idx !== -1) preUpdateHooks.splice(idx, 1);
            };
        },
        /**
         * 添加 post-update 钩子（每帧渲染后执行）
         */
        onPostUpdate(fn) {
            postUpdateHooks.push(fn);
            return () => {
                const idx = postUpdateHooks.indexOf(fn);
                if (idx !== -1) postUpdateHooks.splice(idx, 1);
            };
        },
        /**
         * 添加一次性钩子（下一帧执行后移除）
         */
        onNextFrame(fn) {
            onceHooks.push(fn);
        },
        /**
         * 获取循环状态
         */
        isRunning() {
            return isRunning;
        }
    };
}

// ======================== 灯光计划管理器 ========================
// 前端自主控制灯光计划，支持手动覆盖

const API_BASE = '/api/light-schedules';
const POLL_INTERVAL = 15000; // 轮询间隔 15 秒
const MANUAL_OVERRIDE_DURATION = 30000; // 手动覆盖有效期 30 秒

export function createLightScheduleManager(appState) {
    const state = {
        schedules: [],          // 所有计划列表
        pending: new Map(),     // 待执行: timestamp -> [{sat_id, command, id}]
        manualOverrides: new Map(), // 手动覆盖: sat_id -> {isOn, until}
        lastFetch: 0,
        pollTimer: null,
    };

    // ========== 初始化 ==========
    async function init() {
        await refresh();
        state.pollTimer = setInterval(refresh, POLL_INTERVAL);
    }

    function destroy() {
        if (state.pollTimer) {
            clearInterval(state.pollTimer);
            state.pollTimer = null;
        }
    }

    // ========== 轮询获取计划 ==========
    async function refresh() {
        try {
            const resp = await fetch(API_BASE);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const data = await resp.json();
            const newSchedules = data.schedules || data;
            mergeSchedules(newSchedules);
            buildPendingMap();
            state.lastFetch = Date.now();
            console.log(`[SCHEDULE] 刷新计划: ${state.schedules.length} 个, 待执行 ${state.pending.size} 个时间戳`);
        } catch (e) {
            console.warn('[SCHEDULE] 刷新计划失败:', e);
        }
    }

    // 合并计划：保留本地未同步的状态
    function mergeSchedules(newSchedules) {
        const existingIds = new Set(state.schedules.map(s => s.id).filter(id => id !== undefined));
        newSchedules.forEach(s => {
            if (!existingIds.has(s.id)) {
                state.schedules.push(s);
            }
        });
    }

    // 本地添加计划（创建后立即生效，无需等待轮询）
    function addSchedule(schedule) {
        state.schedules.push(schedule);
        buildPendingMap();
    }

    // 构建时间戳映射（用于播放循环快速查找）
    function buildPendingMap() {
        state.pending.clear();
        state.schedules
            .filter(s => !s.executed && !s._executed)
            .forEach(s => {
                const key = s.trigger_time || s.trigger_at;
                if (!key) return;
                if (!state.pending.has(key)) {
                    state.pending.set(key, []);
                }
                state.pending.get(key).push({
                    id: s.id,
                    sat_id: s.sat_id,
                    command: s.command,
                    trigger_time: s.trigger_time,
                    trigger_at: s.trigger_at,
                });
            });
    }

    // ========== 播放循环调用：检查并执行计划 ==========
    function checkAndExecute(currentTimestamp) {
        if (!currentTimestamp || currentTimestamp.length !== 14) {
            return 0;
        }

        const plans = state.pending.get(currentTimestamp);
        if (!plans || plans.length === 0) {
            return 0;
        }

        let executedCount = 0;
        const remaining = [];

        plans.forEach(plan => {
            // 检查手动覆盖
            const manual = state.manualOverrides.get(plan.sat_id);
            if (manual && Date.now() < manual.until) {
                remaining.push(plan); // 保留，手动覆盖过期后仍可执行
                return;
            }

            // 执行计划
            const isOn = plan.command === 'on';
            if (appState.lightManager) {
                appState.lightManager.setLight(plan.sat_id, isOn);
                executedCount++;
            }

            // 标记为已执行
            plan._executed = true;

            // 在 schedules 列表中也标记
            const schedule = state.schedules.find(s => s.id === plan.id);
            if (schedule) schedule._executed = true;
        });

        // 清理已执行的计划
        state.pending.delete(currentTimestamp);
        if (remaining.length > 0) {
            state.pending.set(currentTimestamp, remaining);
        }

        return executedCount;
    }

    // ========== 手动覆盖 ==========
    function setManualOverride(satId, isOn) {
        state.manualOverrides.set(satId, {
            isOn,
            until: Date.now() + MANUAL_OVERRIDE_DURATION,
        });
    }

    function removeManualOverride(satId) {
        state.manualOverrides.delete(satId);
    }

    function getManualOverride(satId) {
        const manual = state.manualOverrides.get(satId);
        if (manual && Date.now() < manual.until) {
            return manual.isOn;
        }
        return null; // 无有效覆盖
    }

    // 清理过期的手动覆盖
    function cleanExpiredOverrides() {
        const now = Date.now();
        for (const [satId, manual] of state.manualOverrides) {
            if (now >= manual.until) {
                state.manualOverrides.delete(satId);
            }
        }
    }

    // ========== 工具方法 ==========
    function getSchedules() {
        return state.schedules;
    }

    function getPendingCount() {
        let count = 0;
        state.pending.forEach(plans => count += plans.length);
        return count;
    }

    return {
        init,
        destroy,
        refresh,
        addSchedule,
        checkAndExecute,
        setManualOverride,
        removeManualOverride,
        getManualOverride,
        cleanExpiredOverrides,
        getSchedules,
        getPendingCount,
    };
}

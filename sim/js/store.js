// 单一状态源 + 发布订阅。模块只订阅不互查。
const state = {
    attached: false,      // 桥接是否已建立且外部驱动已开启
    playing: false,
    rate: 1,              // 真实时间倍数
    simSeconds: 0,        // 相对数据起点的秒数
    stepIntervalSec: 1,   // 每行数据的秒数
    totalSteps: 0,
    currentStep: 0,
};

const subs = new Map();
export function on(key, fn) {
    if (!subs.has(key)) subs.set(key, new Set());
    subs.get(key).add(fn);
}
export function emit(key, value) {
    const set = subs.get(key);
    if (set) for (const fn of set) fn(value);
}
export function getState() { return state; }
export function patch(d) {
    Object.assign(state, d);
    for (const k of Object.keys(d)) emit(k, state[k]);
}

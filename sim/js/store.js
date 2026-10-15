// 单一状态源。改状态只走 patch()，避免各处直接写字段导致视图与状态脱节。
const state = {
    attached: false,      // 桥接已建立且外部驱动已开启
    playing: false,
    rate: 1,              // 真实时间倍数
    simSeconds: 0,        // 相对数据起点的秒数
    stepIntervalSec: 0,   // 每行数据的秒数，接入时由桥给出
    totalSteps: 0,
    currentStep: 0,
    view: 'formation',    // 顶栏三档：formation | satellite | ground
    sats: [1, 2, 3],      // 加载后由数据里的星数覆盖
};

export function getState() { return state; }
export function patch(d) { Object.assign(state, d); }

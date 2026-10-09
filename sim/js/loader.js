// 类别文件加载与最近邻取值。预览规模（每文件 ≤4323 行）直接用对象数组；
// 全量 1 秒数据接入时这里换 Worker + 列式存储，接口不变。
const cache = {};
let stepSec = 60;   // 预览 60 s；全量 1 s 时由 main 调 setStepSec(1)

export function setStepSec(s) { stepSec = s; }

async function fetchText(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(url + ' → ' + res.status);
    return res.text();
}

export async function loadCategory(name) {
    if (cache[name]) return cache[name];
    const txt = await fetchText(`/sim-data/preview/${name}.csv`);
    const lines = txt.split('\n').filter(l => l && !l.startsWith('#'));
    const head = lines[0].split(',').map(s => s.trim());
    const perSat = head.includes('sat_id');
    const rows = lines.slice(1).map(l => {
        const v = l.split(',');
        const o = {};
        head.forEach((h, i) => { o[h] = v[i] !== undefined && v[i] !== '' ? v[i] : null; });
        return o;
    });
    // 行序：perSat 文件 = sat 块 × epoch 块；epoch 文件 = 单块。epoch 数按 rel_s 去重。
    const nEpoch = perSat ? Math.round(rows.length / Math.max(1, new Set(rows.map(r => r.sat_id)).size)) : rows.length;
    const entry = { rows, perSat, nEpoch, satIds: [...new Set(rows.map(r => Number(r.sat_id)))].filter(x => !isNaN(x)) };
    cache[name] = entry;
    return entry;
}

export function getValue(entry, epoch, satId, field) {
    if (!entry) return null;
    let row;
    if (entry.perSat) {
        const idx = (satId - entry.satIds[0]) * entry.nEpoch + epoch;
        row = entry.rows[idx];
    } else {
        row = entry.rows[epoch];
    }
    return row ? row[field] : null;
}

// 最近邻：按 simSeconds 选 epoch，返回 {epoch, lagSec, value}
export function getNearest(entry, simSeconds, satId, field, lagThresholdSec) {
    if (!entry || !entry.nEpoch) return null;
    let epoch = Math.floor(simSeconds / stepSec);
    epoch = Math.max(0, Math.min(epoch, entry.nEpoch - 1));
    const row = entry.perSat
        ? entry.rows[(satId - entry.satIds[0]) * entry.nEpoch + epoch]
        : entry.rows[epoch];
    if (!row) return null;
    const lagSec = Math.abs(Number(row.rel_s) - simSeconds);
    return { epoch, lagSec, stale: lagSec > (lagThresholdSec || 90), value: row[field] };
}

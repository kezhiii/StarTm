// 类别文件加载与按 (星, 历元序号) 取值。预览规模（每文件 ≤4323 行）直接用对象数组；
// 全量 1 秒数据接入时这里换 Worker + 列式存储，接口不变。
const cache = {};
let stepSec = 60;   // 预览 60 s；全量 1 秒数据时由 main 调 setStepSec(1)

export function setStepSec(s) { stepSec = s; }
export function getStepSec() { return stepSec; }

async function fetchText(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(url + ' → ' + res.status);
    return res.text();
}

export async function loadCategory(name) {
    if (cache[name]) return cache[name];
    const txt = await fetchText(`/sim-data/preview/${name}.csv`);
    const lines = txt.split(/\r?\n/).filter(l => l && !l.startsWith('#'));
    const head = lines[0].split(',').map(s => s.trim());
    const rows = lines.slice(1).map(l => {
        const v = l.split(',');
        const o = {};
        head.forEach((h, i) => { o[h] = v[i] !== undefined && v[i] !== '' ? v[i] : null; });
        return o;
    });
    // 有 sat_id 且是数字星号才算 perSat；事件表的 sat_id 是 TM0S1 这类文本，按历元序列处理
    const perSat = head.includes('sat_id') && /^\d+$/.test(rows[0]?.sat_id || '');
    // 星号 → 该星的行序（按 rel_s 递增）。星块×历元块与历元主序两种排法都成立。
    const satRows = new Map();
    if (perSat) {
        for (let i = 0; i < rows.length; i++) {
            const s = Number(rows[i].sat_id);
            let a = satRows.get(s);
            if (!a) satRows.set(s, a = []);
            a.push(i);
        }
        for (const a of satRows.values()) {
            a.sort((x, y) => Number(rows[x].rel_s) - Number(rows[y].rel_s));
        }
    }
    const entry = {
        rows, head, perSat,
        satIds: [...satRows.keys()].sort((a, b) => a - b),
        satRows,
        nEpoch: perSat ? Math.max(...[...satRows.values()].map(a => a.length)) : rows.length,
        lastRelS: rows.length ? Number(rows[rows.length - 1].rel_s) || 0 : 0,
    };
    if (perSat) entry.lastRelS = Math.max(...rows.map(r => Number(r.rel_s) || 0));
    cache[name] = entry;
    return entry;
}

function rowAt(entry, epoch, satId) {
    if (entry.perSat) {
        const a = entry.satRows.get(Number(satId));
        return a && a[epoch] !== undefined ? entry.rows[a[epoch]] : null;
    }
    return entry.rows[epoch] || null;
}

export function getValue(entry, epoch, satId, field) {
    if (!entry) return null;
    const row = rowAt(entry, epoch, satId);
    return row ? row[field] : null;
}

// 该文件覆盖到的最后一个仿真秒，用于判断数据是否走过头
export function lastSecond(entry) {
    return entry ? entry.lastRelS : 0;
}

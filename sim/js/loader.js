// 类别数据取值。优先走列式二进制 sim-data/render（1 秒一条，57 MB 的 Float32/int16，
// 浏览器只建视图不解析文本）；二进制不在时退回 sim-data/preview 的 60 秒 CSV，接口不变。
const bin = { manifest: null, f32: null, i16: null, cols: new Map() };
const cache = {};
let stepSec = 60;   // 由 main 按桥给出的帧间隔设定

export function setStepSec(s) { stepSec = s; }
export function getStepSec() { return stepSec; }

async function loadBinary() {
    if (bin.manifest) return bin.manifest;
    const m = await fetch('/sim-data/render/manifest.json').catch(() => null);
    if (!m || !m.ok) return null;
    const manifest = await m.json();
    const [b32, b16] = await Promise.all([
        fetch('/sim-data/render/columns.f32').then(r => r.arrayBuffer()),
        fetch('/sim-data/render/codes.i16').then(r => r.arrayBuffer()),
    ]);
    bin.manifest = manifest;
    bin.f32 = new Float32Array(b32);
    bin.i16 = new Int16Array(b16);
    for (const c of manifest.columns) bin.cols.set(`${c.file}.${c.field}`, c);
    return manifest;
}

export function isBinary() { return !!bin.manifest; }

async function fetchText(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(url + ' → ' + res.status);
    return res.text();
}

/**
 * 载入一个类别。二进制里有该文件时返回轻量 entry（不解析行），
 * 否则按 preview 文本解析成对象数组。
 */
export async function loadCategory(name) {
    if (cache[name]) return cache[name];
    if (!bin.manifest) await loadBinary();

    if (bin.manifest && bin.manifest.columns.some(c => c.file === name)) {
        const entry = {
            name, binary: true, rows: null,
            perSat: bin.manifest.columns.find(c => c.file === name).perSat,
            nEpoch: bin.manifest.nEpoch,
            satIds: bin.manifest.sats,
            lastRelS: (bin.manifest.nEpoch - 1) * bin.manifest.stepSec,
        };
        cache[name] = entry;
        return entry;
    }

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
        name, binary: false, rows, head, perSat,
        satIds: [...satRows.keys()].sort((a, b) => a - b),
        satRows,
        nEpoch: perSat ? Math.max(...[...satRows.values()].map(a => a.length)) : rows.length,
        lastRelS: perSat ? Math.max(...rows.map(r => Number(r.rel_s) || 0))
            : (rows.length ? Number(rows[rows.length - 1].rel_s) || 0 : 0),
    };
    cache[name] = entry;
    return entry;
}

export function getValue(entry, epoch, satId, field) {
    if (!entry) return null;
    if (entry.binary) {
        const c = bin.cols.get(`${entry.name}.${field}`);
        if (!c || epoch < 0 || epoch >= bin.manifest.nEpoch) return null;
        const pos = c.perSat ? bin.manifest.sats.indexOf(Number(satId)) : 0;
        if (pos < 0) return null;
        const i = c.offset + pos * bin.manifest.nEpoch + epoch;
        if (c.dtype === 'f32') {
            const v = bin.f32[i];
            return Number.isFinite(v) ? String(v) : null;
        }
        const code = bin.i16[i];
        return code < 0 ? null : (c.codes[code] ?? null);
    }
    let row;
    if (entry.perSat) {
        const a = entry.satRows.get(Number(satId));
        row = a && a[epoch] !== undefined ? entry.rows[a[epoch]] : null;
    } else {
        row = entry.rows[epoch] || null;
    }
    return row ? row[field] : null;
}

// 该文件覆盖到的最后一个仿真秒，用于判断数据是否走过头
export function lastSecond(entry) {
    return entry ? entry.lastRelS : 0;
}

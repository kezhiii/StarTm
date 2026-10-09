// 趋势图：手绘 canvas。带允许带、规划虚线、当前时刻游标、悬停读数与点击定位。
// 图例与数值由调用方在 DOM 里呈现（panels.js），这里只画图形。
const GRID = 'rgba(38, 58, 76, .55)';
const TEXT = '#6a8095';
const BAND = 'rgba(216, 96, 75, .13)';
const CURSOR = 'rgba(127, 227, 214, .55)';

export function createChart(canvas, { fmtY = v => Math.round(v * 10) / 10, onPick } = {}) {
    const ctx = canvas.getContext('2d');
    let series = [];        // [{name, color, data:[{x,y}], dash}]
    let opts = {};          // {band:{lo,hi,label}, plan:{y,label}, cursor:x}
    let hover = null;       // {x, y, px, py, series, point}
    let box = { x0: 0, x1: 1, y0: 0, y1: 1, L: 40, R: 0, T: 6, B: 0 };

    function setData(s, o = {}) { series = s; opts = o; draw(); }

    function px(x) { return box.L + (x - box.x0) / (box.x1 - box.x0) * (box.R - box.L); }
    function py(y) { return box.B - (y - box.y0) / (box.y1 - box.y0) * (box.B - box.T); }

    function draw() {
        const dpr = window.devicePixelRatio || 1;
        const W = canvas.clientWidth, H = canvas.clientHeight;
        if (!W || !H) return;
        if (canvas.width !== W * dpr || canvas.height !== H * dpr) {   // 尺寸没变就别重设，重设会重建后备缓冲
            canvas.width = W * dpr; canvas.height = H * dpr;
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, W, H);
        ctx.font = '10.5px "Bahnschrift SemiCondensed", Consolas, monospace';

        let n = 0, x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
        for (const sr of series) for (const pt of sr.data) {
            n++;
            if (pt.x < x0) x0 = pt.x; if (pt.x > x1) x1 = pt.x;
            if (pt.y < y0) y0 = pt.y; if (pt.y > y1) y1 = pt.y;
        }
        if (!n) { ctx.fillStyle = TEXT; ctx.fillText('暂无数据', 8, 18); return; }
        if (opts.band) { y0 = Math.min(y0, opts.band.lo, opts.band.hi); y1 = Math.max(y1, opts.band.lo, opts.band.hi); }
        if (opts.plan) { y0 = Math.min(y0, opts.plan.y); y1 = Math.max(y1, opts.plan.y); }
        box.x0 = x0; box.x1 = x1;
        if (box.x1 === box.x0) box.x1 = box.x0 + 1;
        if (y1 === y0) { y1 = y0 + 1; y0 -= 1; }
        const pad = (y1 - y0) * 0.12; y0 -= pad; y1 += pad;
        box.L = 42; box.R = W - 8; box.T = 6; box.B = H - 16;

        // 允许带
        if (opts.band) {
            const a = py(Math.max(opts.band.lo, opts.band.hi)), b = py(Math.min(opts.band.lo, opts.band.hi));
            ctx.fillStyle = BAND; ctx.fillRect(box.L, a, box.R - box.L, b - a);
        }
        // 网格与纵刻度（上/中/下三值）
        ctx.strokeStyle = GRID; ctx.fillStyle = TEXT; ctx.lineWidth = 1;
        for (let g = 0; g <= 2; g++) {
            const yv = y0 + (y1 - y0) * g / 2, yy = Math.round(py(yv)) + .5;
            ctx.beginPath(); ctx.moveTo(box.L, yy); ctx.lineTo(box.R, yy); ctx.stroke();
            ctx.fillText(fmtY(yv), 3, yy + 3);
        }
        // 横轴：起点、当前游标、终点
        ctx.fillText(tlab(box.x0), box.L, H - 3);
        ctx.fillText(tlab(box.x1), box.R - 42, H - 3);
        // 规划值虚线
        if (opts.plan && opts.plan.y >= y0 && opts.plan.y <= y1) {
            ctx.strokeStyle = '#8a9aab'; ctx.setLineDash([4, 4]);
            const yy = Math.round(py(opts.plan.y)) + .5;
            ctx.beginPath(); ctx.moveTo(box.L, yy); ctx.lineTo(box.R, yy); ctx.stroke();
            ctx.setLineDash([]);
        }
        // 曲线
        series.forEach(s => {
            if (!s.data.length) return;
            ctx.strokeStyle = s.color; ctx.lineWidth = s.dash ? 1 : 1.6;
            if (s.dash) ctx.setLineDash([5, 4]);
            ctx.beginPath();
            s.data.forEach((p, i) => { const X = px(p.x), Y = py(p.y); i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); });
            ctx.stroke();
            ctx.setLineDash([]);
        });
        // 当前时刻游标
        if (opts.cursor != null && opts.cursor >= box.x0 && opts.cursor <= box.x1) {
            ctx.strokeStyle = CURSOR; ctx.lineWidth = 1;
            const xx = Math.round(px(opts.cursor)) + .5;
            ctx.beginPath(); ctx.moveTo(xx, box.T); ctx.lineTo(xx, box.B); ctx.stroke();
        }
        // 悬停十字与点
        if (hover) {
            ctx.strokeStyle = 'rgba(159, 182, 204, .45)';
            const xx = Math.round(px(hover.point.x)) + .5;
            ctx.beginPath(); ctx.moveTo(xx, box.T); ctx.lineTo(xx, box.B); ctx.stroke();
            ctx.fillStyle = hover.series.color;
            ctx.beginPath(); ctx.arc(px(hover.point.x), py(hover.point.y), 2.6, 0, Math.PI * 2); ctx.fill();
        }
        ctx.lineWidth = 1;
    }

    function nearest(mx) {
        let best = null;
        for (const s of series) for (const p of s.data) {
            const d = Math.abs(px(p.x) - mx);
            if (!best || d < best.d) best = { d, series: s, point: p };
        }
        return best && best.d < 24 ? best : null;
    }

    canvas.addEventListener('mousemove', (e) => {
        const r = canvas.getBoundingClientRect();
        const n = nearest(e.clientX - r.left);
        const changed = !!n !== !!hover || (n && n.point !== hover.point);
        hover = n; draw();
        if (changed && n) canvas.dispatchEvent(new CustomEvent('charthover', {
            detail: { x: n.point.x, y: n.point.y, name: n.series.name, clientX: e.clientX, clientY: e.clientY },
        }));
        if (!n) canvas.dispatchEvent(new CustomEvent('chartleave'));
    });
    canvas.addEventListener('mouseleave', () => { hover = null; draw(); canvas.dispatchEvent(new CustomEvent('chartleave')); });
    canvas.addEventListener('click', (e) => {
        const r = canvas.getBoundingClientRect();
        const n = nearest(e.clientX - r.left);
        if (n && onPick) onPick(n.point.x);
    });

    function tlab(sec) {
        const s = Math.floor(sec);
        return `T+${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor(s % 3600 / 60)).padStart(2, '0')}`;
    }

    return { setData, draw };
}

// 极简折线图（canvas 手绘）。数据量大或需要缩放时换 uPlot（CDN），接口保持 setData(series) 不变。
// 星号/数值改由面板头部呈现，这里只画网格、阈值与曲线。
const GRID = 'rgba(38, 58, 76, .55)';
const TEXT = '#5c7288';

export function createChart(canvas, { fmt = v => Math.round(v * 10) / 10 } = {}) {
    const ctx = canvas.getContext('2d');
    let series = [];   // [{color, data:[{x(s), y}]}]
    let thresholds = [];

    function setData(s, thr = []) { series = s; thresholds = thr; draw(); }

    function draw() {
        const dpr = window.devicePixelRatio || 1;
        const W = canvas.clientWidth, H = canvas.clientHeight;
        canvas.width = W * dpr; canvas.height = H * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, W, H);
        ctx.font = '10px "Bahnschrift SemiCondensed", Consolas, monospace';

        let xs = [], ys = [];
        series.forEach(s => s.data.forEach(p => { xs.push(p.x); ys.push(p.y); }));
        thresholds.forEach(t => { if (isFinite(t.y)) ys.push(t.y); });
        if (!xs.length) { ctx.fillStyle = TEXT; ctx.fillText('暂无数据', 8, 18); return; }
        let x0 = Math.min(...xs), x1 = Math.max(...xs);
        let y0 = Math.min(...ys), y1 = Math.max(...ys);
        if (x1 === x0) x1 = x0 + 1;
        if (y1 === y0) { y1 = y0 + 1; y0 -= 1; }
        const padY = (y1 - y0) * 0.1; y0 -= padY; y1 += padY;
        const L = 36, R = W - 8, T = 6, B = H - 14;
        const px = x => L + (x - x0) / (x1 - x0) * (R - L);
        const py = y => B - (y - y0) / (y1 - y0) * (B - T);

        // 网格与刻度（三条横线 + 首尾时刻）
        ctx.fillStyle = TEXT; ctx.strokeStyle = GRID; ctx.lineWidth = 1;
        for (let g = 0; g <= 2; g++) {
            const yv = y0 + (y1 - y0) * g / 2, yy = Math.round(py(yv)) + .5;
            ctx.beginPath(); ctx.moveTo(L, yy); ctx.lineTo(R, yy); ctx.stroke();
            ctx.fillText(fmt(yv), 3, yy + 3);
        }
        ctx.fillText(tlab(x0), L, H - 3);
        ctx.fillText(tlab(x1), R - 40, H - 3);

        // 阈值线
        thresholds.forEach(t => {
            if (!isFinite(t.y) || t.y < y0 || t.y > y1) return;
            ctx.strokeStyle = t.color || '#d8604b';
            ctx.setLineDash([3, 3]);
            const yy = Math.round(py(t.y)) + .5;
            ctx.beginPath(); ctx.moveTo(L, yy); ctx.lineTo(R, yy); ctx.stroke();
            ctx.setLineDash([]);
        });

        // 曲线
        series.forEach(s => {
            if (!s.data.length) return;
            ctx.strokeStyle = s.color; ctx.lineWidth = 1.4; ctx.beginPath();
            s.data.forEach((p, i) => {
                const X = px(p.x), Y = py(p.y);
                i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y);
            });
            ctx.stroke();
        });
        ctx.lineWidth = 1;
    }

    function tlab(sec) {
        const m = Math.floor(sec / 60);
        return `T+${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    }

    return { setData, draw };
}

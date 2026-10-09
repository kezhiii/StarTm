// 极简折线图（canvas 手绘）。数据量大或需要缩放时换 uPlot（CDN），接口保持 setData(series) 不变。
export function createChart(canvas, { yLabel, thresholds = [], fmt = v => Math.round(v * 10) / 10 } = {}) {
    const ctx = canvas.getContext('2d');
    let series = [];   // [{name, color, data:[{x(s), y}]}]

    function setData(s) { series = s; draw(); }

    function draw() {
        const dpr = window.devicePixelRatio || 1;
        const W = canvas.clientWidth, H = canvas.clientHeight;
        canvas.width = W * dpr; canvas.height = H * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, W, H);
        ctx.font = '11px Consolas';

        let xs = [], ys = [];
        series.forEach(s => s.data.forEach(p => { xs.push(p.x); ys.push(p.y); }));
        thresholds.forEach(t => { if (isFinite(t.y)) ys.push(t.y); });
        if (!xs.length) { ctx.fillStyle = '#5a6b85'; ctx.fillText('暂无数据', 10, 20); return; }
        let x0 = Math.min(...xs), x1 = Math.max(...xs);
        let y0 = Math.min(...ys), y1 = Math.max(...ys);
        if (x1 === x0) x1 = x0 + 1;
        if (y1 === y0) { y1 = y0 + 1; y0 -= 1; }
        const padY = (y1 - y0) * 0.08; y0 -= padY; y1 += padY;
        const L = 46, R = W - 10, T = 8, B = H - 18;
        const px = x => L + (x - x0) / (x1 - x0) * (R - L);
        const py = y => B - (y - y0) / (y1 - y0) * (B - T);

        // 网格与刻度
        ctx.strokeStyle = '#22304a'; ctx.fillStyle = '#5a6b85';
        for (let g = 0; g <= 4; g++) {
            const yv = y0 + (y1 - y0) * g / 4, yy = py(yv);
            ctx.beginPath(); ctx.moveTo(L, yy); ctx.lineTo(R, yy); ctx.stroke();
            ctx.fillText(fmt(yv), 4, yy + 4);
        }
        ctx.fillText(fmt(x0) + 's', L, H - 4);
        ctx.fillText(fmt(x1) + 's', R - 40, H - 4);

        // 阈值线
        thresholds.forEach(t => {
            if (!isFinite(t.y) || t.y < y0 || t.y > y1) return;
            ctx.strokeStyle = t.color || '#c0392b';
            ctx.setLineDash([4, 4]);
            ctx.beginPath(); ctx.moveTo(L, py(t.y)); ctx.lineTo(R, py(t.y)); ctx.stroke();
            ctx.setLineDash([]);
            if (t.label) { ctx.fillStyle = t.color || '#c0392b'; ctx.fillText(t.label, L + 4, py(t.y) - 3); }
        });

        // 曲线
        series.forEach(s => {
            ctx.strokeStyle = s.color; ctx.beginPath();
            s.data.forEach((p, i) => {
                const X = px(p.x), Y = py(p.y);
                i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y);
            });
            ctx.stroke();
        });

        // 图例
        let lx = L + 4;
        series.forEach(s => {
            ctx.fillStyle = s.color; ctx.fillRect(lx, T + 2, 8, 3);
            ctx.fillStyle = '#8fa3c0'; ctx.fillText(s.name, lx + 12, T + 8);
            lx += 16 + ctx.measureText(s.name).width;
        });
        ctx.fillStyle = '#5a6b85'; ctx.fillText(yLabel, 4, T + 8);
    }

    return { setData, draw };
}

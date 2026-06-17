// ======================== 图像处理模块 ========================
// 重构：基于几何特征匹配的图案识别

/**
 * 模块一：图像特征提取
 * 从图像中提取轮廓点，形成目标形状点集
 */

/**
 * 加载图像文件为 Image 对象
 */
export function loadImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

/**
 * 获取图像灰度数据并自动检测是否需要反转
 */
function getGrayData(img, canvasSize = 256) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    canvas.width = canvasSize;
    canvas.height = canvasSize;
    
    // 黑色背景
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvasSize, canvasSize);
    
    // 居中绘制，保持宽高比
    const scale = Math.min(canvasSize / img.width, canvasSize / img.height);
    const w = Math.floor(img.width * scale);
    const h = Math.floor(img.height * scale);
    const x = Math.floor((canvasSize - w) / 2);
    const y = Math.floor((canvasSize - h) / 2);
    ctx.drawImage(img, x, y, w, h);
    
    const imageData = ctx.getImageData(0, 0, canvasSize, canvasSize);
    const data = imageData.data;
    
    // 转为灰度并统计
    const gray = new Uint8Array(canvasSize * canvasSize);
    let brightCount = 0;
    let darkCount = 0;
    
    for (let i = 0; i < gray.length; i++) {
        const idx = i * 4;
        gray[i] = Math.round(data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114);
        if (gray[i] > 128) brightCount++;
        else darkCount++;
    }
    
    const invert = brightCount > darkCount;
    
    return { gray, width: canvasSize, height: canvasSize, invert };
}

/**
 * Otsu 自动阈值算法
 * 自动找到最佳二值化阈值
 */
function otsuThreshold(gray) {
    // 计算直方图
    const histogram = new Array(256).fill(0);
    for (let i = 0; i < gray.length; i++) {
        histogram[gray[i]]++;
    }
    
    const total = gray.length;
    let sum = 0;
    for (let i = 0; i < 256; i++) sum += i * histogram[i];
    
    let sumB = 0;
    let wB = 0;
    let wF = 0;
    let maxVariance = 0;
    let threshold = 0;
    
    for (let t = 0; t < 256; t++) {
        wB += histogram[t];
        if (wB === 0) continue;
        
        wF = total - wB;
        if (wF === 0) break;
        
        sumB += t * histogram[t];
        
        const mB = sumB / wB;
        const mF = (sum - sumB) / wF;
        
        const variance = wB * wF * (mB - mF) * (mB - mF);
        
        if (variance > maxVariance) {
            maxVariance = variance;
            threshold = t;
        }
    }
    
    return threshold;
}

/**
 * 二值化图像
 */
function binarize(gray, width, height, invert = false) {
    const threshold = otsuThreshold(gray);
    const binary = new Uint8Array(width * height);
    
    for (let i = 0; i < gray.length; i++) {
        if (invert) {
            binary[i] = gray[i] < threshold ? 1 : 0;
        } else {
            binary[i] = gray[i] >= threshold ? 1 : 0;
        }
    }
    
    return { binary, threshold };
}

/**
 * 轮廓提取（简单的边缘检测）
 * 返回轮廓点数组 [{x, y}, ...]
 */
function extractContour(binary, width, height) {
    const contour = [];
    
    // 使用简单的边缘检测：如果像素是前景，且至少有一个邻居是背景
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const idx = y * width + x;
            if (binary[idx] === 0) continue; // 跳过背景
            
            // 检查4-连通邻居
            const neighbors = [
                binary[(y - 1) * width + x], // 上
                binary[(y + 1) * width + x], // 下
                binary[y * width + (x - 1)], // 左
                binary[y * width + (x + 1)]  // 右
            ];
            
            // 如果有任一邻居是背景，则为轮廓点
            if (neighbors.some(n => n === 0)) {
                contour.push({ x, y });
            }
        }
    }
    
    return contour;
}

/**
 * 提取所有前景点
 * 返回前景点数组 [{x, y}, ...]
 */
function extractForeground(binary, width, height) {
    const points = [];
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (binary[y * width + x] === 1) {
                points.push({ x, y });
            }
        }
    }
    return points;
}

/**
 * 连通域标记（BFS 广度优先搜索）
 * @param {Uint8Array} binary - 二值化图像
 * @param {number} width - 图像宽度
 * @param {number} height - 图像高度
 * @returns {Array<{label: number, pixels: Array<{x, y}>, area: number}>}
 */
function findConnectedComponents(binary, width, height) {
    const labels = new Int32Array(width * height).fill(-1);
    const components = [];
    let currentLabel = 0;
    
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            if (binary[idx] === 0 || labels[idx] !== -1) continue;
            
            // BFS
            const queue = [{x, y}];
            const pixels = [];
            labels[idx] = currentLabel;
            
            while (queue.length > 0) {
                const p = queue.shift();
                pixels.push(p);
                
                // 4-连通邻居
                const neighbors = [
                    {x: p.x - 1, y: p.y},
                    {x: p.x + 1, y: p.y},
                    {x: p.x, y: p.y - 1},
                    {x: p.x, y: p.y + 1}
                ];
                
                for (const n of neighbors) {
                    if (n.x < 0 || n.x >= width || n.y < 0 || n.y >= height) continue;
                    const nIdx = n.y * width + n.x;
                    if (binary[nIdx] === 1 && labels[nIdx] === -1) {
                        labels[nIdx] = currentLabel;
                        queue.push(n);
                    }
                }
            }
            
            components.push({
                label: currentLabel,
                pixels: pixels,
                area: pixels.length
            });
            currentLabel++;
        }
    }
    
    return components;
}

/**
 * 连通域感知采样
 * 按面积比例分配采样点数，独立执行 FPS
 * @param {Uint8Array} binary - 二值化图像
 * @param {number} width - 图像宽度
 * @param {number} height - 图像高度
 * @param {number} nPoints - 总采样点数
 * @returns {Array<{x: y}>} 采样点数组
 */
function connectedComponentAwareSampling(binary, width, height, nPoints) {
    const components = findConnectedComponents(binary, width, height);
    
    if (components.length === 0) return [];
    
    // 计算总面积
    const totalArea = components.reduce((sum, c) => sum + c.area, 0);
    
    // 过滤噪点（面积 < 总面积 1%）
    const minArea = totalArea * 0.01;
    const validComponents = components.filter(c => c.area >= minArea);
    
    if (validComponents.length === 0) return [];
    
    // 计算有效总面积
    const validTotalArea = validComponents.reduce((sum, c) => sum + c.area, 0);
    
    console.log(`[CC] 连通域数量: ${validComponents.length}, 面积分布:`, 
        validComponents.map(c => `${c.area}(${(c.area/validTotalArea*100).toFixed(1)}%)`).join(', '));
    
    // 按面积比例分配采样点数，每个至少 2 个点
    const sampled = [];
    let remainingPoints = nPoints;
    
    for (let i = 0; i < validComponents.length; i++) {
        const comp = validComponents[i];
        const isLast = i === validComponents.length - 1;
        
        // 计算分配的点数
        let allocPoints;
        if (isLast) {
            allocPoints = remainingPoints; // 最后一个组件用完剩余点数
        } else {
            allocPoints = Math.max(2, Math.round(nPoints * comp.area / validTotalArea));
            allocPoints = Math.min(allocPoints, remainingPoints);
        }
        
        // 对该组件独立执行 FPS
        const compSampled = farthestPointSample(comp.pixels, allocPoints);
        sampled.push(...compSampled);
        
        remainingPoints -= allocPoints;
        if (remainingPoints <= 0) break;
    }
    
    return sampled;
}

/**
 * 距离变换 (Distance Transform)
 * 计算每个前景像素到最近背景像素的距离
 * @param {Uint8Array} binary - 二值化图像
 * @param {number} width - 图像宽度
 * @param {number} height - 图像高度
 * @returns {Float32Array} 距离图
 */
function distanceTransform(binary, width, height) {
    const dist = new Float32Array(width * height).fill(Infinity);
    
    // 前向扫描
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            if (binary[idx] === 0) {
                dist[idx] = 0;
            } else {
                if (x > 0) dist[idx] = Math.min(dist[idx], dist[idx - 1] + 1);
                if (y > 0) dist[idx] = Math.min(dist[idx], dist[(y - 1) * width + x] + 1);
            }
        }
    }
    
    // 后向扫描
    for (let y = height - 1; y >= 0; y--) {
        for (let x = width - 1; x >= 0; x--) {
            const idx = y * width + x;
            if (x < width - 1) dist[idx] = Math.min(dist[idx], dist[idx + 1] + 1);
            if (y < height - 1) dist[idx] = Math.min(dist[idx], dist[(y + 1) * width + x] + 1);
        }
    }
    
    return dist;
}

/**
 * 骨架提取 (Skeleton Extraction)
 * 使用距离变换 + 非极大值抑制提取单像素宽度骨架
 * @param {Uint8Array} binary - 二值化图像
 * @param {number} width - 图像宽度
 * @param {number} height - 图像高度
 * @returns {Array<{x, y}>} 骨架点数组
 */
function extractSkeleton(binary, width, height) {
    // 1. 距离变换
    const dist = distanceTransform(binary, width, height);
    
    // 2. 非极大值抑制 (NMS) 提取骨架
    const skeleton = [];
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const idx = y * width + x;
            if (binary[idx] === 0) continue; // 跳过背景
            
            const d = dist[idx];
            if (d === 0) continue; // 跳过边界
            
            // 检查8-连通邻居
            let isMax = true;
            for (let dy = -1; dy <= 1 && isMax; dy++) {
                for (let dx = -1; dx <= 1 && isMax; dx++) {
                    if (dx === 0 && dy === 0) continue;
                    const nIdx = (y + dy) * width + (x + dx);
                    if (dist[nIdx] > d) {
                        isMax = false;
                    }
                }
            }
            
            if (isMax) {
                skeleton.push({ x, y });
            }
        }
    }
    
    return skeleton;
}

/**
 * 自动检测图案类型
 * 结合骨架比例和轮廓复杂度进行判断
 * @param {Uint8Array} binary - 二值化图像
 * @param {number} width - 图像宽度
 * @param {number} height - 图像高度
 * @returns {string} 'line' 或 'filled'
 */
function detectPatternType(binary, width, height) {
    const foreground = extractForeground(binary, width, height);
    const skeleton = extractSkeleton(binary, width, height);
    const contour = extractContour(binary, width, height);
    
    const fillRatio = foreground.length > 0 ? skeleton.length / foreground.length : 0;
    const contourRatio = foreground.length > 0 ? contour.length / foreground.length : 0;
    
    console.log(`[SHAPE] 前景点: ${foreground.length}, 骨架点: ${skeleton.length}, 轮廓点: ${contour.length}`);
    console.log(`[SHAPE] 骨架比例: ${fillRatio.toFixed(3)}, 轮廓比例: ${contourRatio.toFixed(3)}`);
    
    // 额外计算骨架/轮廓比率，用于检测细长曲线形状（如 Nike swoosh）
    const skeletonToContourRatio = contour.length > 0 ? skeleton.length / contour.length : 0;
    console.log(`[SHAPE] 骨架/轮廓比率: ${skeletonToContourRatio.toFixed(3)}`);
    
    // 判断逻辑：
    // 1. 骨架比例 > 0.20 且 轮廓比例 > 0.35：线状图案（商标、文字、图形灯光秀）
    // 1b. 骨架/轮廓比率 > 0.30：细长曲线（如 Nike swoosh），也视为线状
    // 2. 轮廓比例 > 0.50：轮廓图案（圆环、空心形状等）
    // 3. 其他：填充图案（实心形状等）
    if ((fillRatio > 0.20 && contourRatio > 0.35) || skeletonToContourRatio > 0.30) {
        return 'line';
    } else if (contourRatio > 0.50) {
        return 'contour';
    } else {
        return 'filled';
    }
}

/**
 * 最远点采样 (FPS) - O(N×K) 优化版
 * 保证采样点在空间上均匀分散
 */
function farthestPointSample(points, n) {
    if (points.length <= n) return points;
    
    const selected = [];
    const remaining = [...points];
    
    // 选择第一个点（质心最近的点）
    let cx = 0, cy = 0;
    for (const p of points) { cx += p.x; cy += p.y; }
    cx /= points.length;
    cy /= points.length;
    
    let minDist = Infinity;
    let firstIdx = 0;
    for (let i = 0; i < remaining.length; i++) {
        const d = distance(remaining[i], { x: cx, y: cy });
        if (d < minDist) { minDist = d; firstIdx = i; }
    }
    selected.push(remaining[firstIdx]);
    remaining.splice(firstIdx, 1);
    
    // 维护距离数组，避免重复计算
    const minDists = new Array(remaining.length).fill(Infinity);
    
    while (selected.length < n && remaining.length > 0) {
        // 更新最小距离（只计算新选的点）
        const lastSelected = selected[selected.length - 1];
        for (let i = 0; i < remaining.length; i++) {
            const d = distance(remaining[i], lastSelected);
            minDists[i] = Math.min(minDists[i], d);
        }
        
        // 找到最大最小距离的点
        let maxMinDist = -1;
        let bestIdx = 0;
        for (let i = 0; i < minDists.length; i++) {
            if (minDists[i] > maxMinDist) {
                maxMinDist = minDists[i];
                bestIdx = i;
            }
        }
        
        selected.push(remaining[bestIdx]);
        remaining.splice(bestIdx, 1);
        minDists.splice(bestIdx, 1);
    }
    
    return selected;
}

/**
 * 将点集归一化到原点 (0,0)
 */
function normalizePoints(points) {
    if (points.length === 0) return points;
    
    // 计算质心
    let cx = 0, cy = 0;
    for (const p of points) {
        cx += p.x;
        cy += p.y;
    }
    cx /= points.length;
    cy /= points.length;
    
    // 平移到原点
    return points.map(p => ({ x: p.x - cx, y: p.y - cy }));
}

/**
 * 模块一：提取目标形状点集
 * 使用前景采样 + FPS 算法，保留形状内部结构
 * @param {File} file - 图像文件
 * @param {number} nPoints - 目标点数
 * @returns {Promise<{shapePoints: Array, width: number, height: number}>}
 */
export async function extractShapePoints(file, nPoints = 30) {
    const img = await loadImage(file);
    const { gray, width, height, invert } = getGrayData(img, 256);
    
    console.log(`[SHAPE] 图像尺寸: ${img.width}x${img.height}, 画布: ${width}x${height}`);
    console.log(`[SHAPE] 自动检测: ${invert ? '白底黑图' : '黑底白图'}`);
    
    // 二值化
    const { binary, threshold } = binarize(gray, width, height, invert);
    console.log(`[SHAPE] Otsu 阈值: ${threshold}`);
    
    // 自动检测图案类型
    const patternType = detectPatternType(binary, width, height);
    console.log(`[SHAPE] 检测到图案类型: ${patternType}`);
    
    // 根据图案类型选择采样方式
    let sampled;
    if (patternType === 'line') {
        // 线条型图案：使用骨架提取
        const skeleton = extractSkeleton(binary, width, height);
        console.log(`[SHAPE] 骨架点数: ${skeleton.length}`);
        sampled = farthestPointSample(skeleton, nPoints);
    } else if (patternType === 'contour') {
        // 轮廓图案：使用轮廓采样
        const contour = extractContour(binary, width, height);
        console.log(`[SHAPE] 轮廓点数: ${contour.length}`);
        sampled = farthestPointSample(contour, nPoints);
    } else {
        // 填充型图案：使用连通域感知采样
        sampled = connectedComponentAwareSampling(binary, width, height, nPoints);
    }
    console.log(`[SHAPE] 采样点数: ${sampled.length}`);
    
    // 归一化到原点
    const shapePoints = normalizePoints(sampled);
    
    // 生成预览图（高亮所有采样点）
    const previewData = generatePreview(binary, width, height, sampled);
    
    return {
        shapePoints,
        width,
        height,
        previewData,
        sampled,
        patternType,
        invert,
        threshold
    };
}

/**
 * 生成预览图（用于调试）
 */
function generatePreview(binary, width, height, contour) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const imageData = ctx.createImageData(width, height);
    
    // 绘制二值图
    for (let i = 0; i < binary.length; i++) {
        const v = binary[i] * 255;
        imageData.data[i * 4] = v;
        imageData.data[i * 4 + 1] = v;
        imageData.data[i * 4 + 2] = v;
        imageData.data[i * 4 + 3] = 255;
    }
    
    // 高亮轮廓点
    for (const p of contour) {
        const idx = (p.y * width + p.x) * 4;
        imageData.data[idx] = 255;     // R
        imageData.data[idx + 1] = 0;   // G
        imageData.data[idx + 2] = 0;   // B
        imageData.data[idx + 3] = 255; // A
    }
    
    return imageData;
}


/**
 * 模块二：几何变换
 */

/**
 * 对点集应用旋转变换
 */
function rotatePoints(points, angleDeg) {
    const rad = angleDeg * Math.PI / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    
    return points.map(p => ({
        x: p.x * cos - p.y * sin,
        y: p.x * sin + p.y * cos
    }));
}

/**
 * 对点集应用缩放变换
 */
function scalePoints(points, scale) {
    return points.map(p => ({
        x: p.x * scale,
        y: p.y * scale
    }));
}

/**
 * 对点集应用平移变换
 */
function translatePoints(points, tx, ty) {
    return points.map(p => ({
        x: p.x + tx,
        y: p.y + ty
    }));
}


/**
 * 模块三：匹配评估与打分
 */

/**
 * 计算两个点之间的欧氏距离
 */
function distance(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
}

/**
 * 为每个形状点找到最近的卫星
 * 返回 {matches: Array, totalCost: number}
 */
function matchShapeToSatellites(shapePoints, satPositions) {
    const matches = [];
    let totalCost = 0;
    
    for (const sp of shapePoints) {
        let minDist = Infinity;
        let nearestSat = null;
        let nearestIdx = -1;
        
        for (let i = 0; i < satPositions.length; i++) {
            const d = distance(sp, satPositions[i]);
            if (d < minDist) {
                minDist = d;
                nearestSat = satPositions[i];
                nearestIdx = i;
            }
        }
        
        matches.push({
            shapePoint: sp,
            satIndex: nearestIdx,
            dist: minDist
        });
        
        totalCost += minDist;
    }
    
    // 计算重复匹配惩罚
    const satMatchCount = new Map();
    for (const m of matches) {
        satMatchCount.set(m.satIndex, (satMatchCount.get(m.satIndex) || 0) + 1);
    }
    
    let penalty = 0;
    for (const count of satMatchCount.values()) {
        if (count > 1) {
            // 平方惩罚，力度更大，避免多对一匹配
            penalty += Math.pow(count - 1, 2) * 3.0;
        }
    }
    
    return {
        matches,
        totalCost: totalCost + penalty,
        uniqueSats: satMatchCount.size
    };
}

/**
 * 匈牙利算法 (Hungarian Algorithm)
 * 求解二分图最小权匹配
 * @param {Array<Array<number>>} costMatrix - 成本矩阵 (N×M)
 * @returns {Array<number>} 匹配结果 [形状点索引 -> 卫星索引]
 */
function hungarianAlgorithm(costMatrix) {
    const n = costMatrix.length;
    const m = costMatrix[0].length;
    
    // 确保 n <= m
    if (n > m) {
        throw new Error('形状点数不能超过卫星数');
    }
    
    // 初始化标号
    const lx = new Array(n).fill(0);
    const ly = new Array(m).fill(0);
    
    // 初始化匹配
    const matchX = new Array(n).fill(-1);
    const matchY = new Array(m).fill(-1);
    
    // 初始化 lx 为每行的最小值（最小权匹配）
    for (let i = 0; i < n; i++) {
        lx[i] = Math.min(...costMatrix[i]);
    }
    
    // 迭代寻找增广路径
    for (let i = 0; i < n; i++) {
        while (true) {
            // BFS 寻找增广路径
            const visitedX = new Array(n).fill(false);
            const visitedY = new Array(m).fill(false);
            const prev = new Array(n).fill(-1);
            const queue = [i];
            visitedX[i] = true;
            
            let found = false;
            let lastY = -1;
            
            while (queue.length > 0 && !found) {
                const x = queue.shift();
                
                for (let y = 0; y < m; y++) {
                    if (visitedY[y]) continue;
                    
                    // 检查是否在相等子图中（最小权匹配）
                    const slack = costMatrix[x][y] - lx[x] - ly[y];
                    if (Math.abs(slack) < 1e-10) {
                        visitedY[y] = true;
                        prev[y] = x;
                        
                        if (matchY[y] === -1) {
                            // 找到增广路径
                            found = true;
                            lastY = y;
                            break;
                        } else {
                            // 继续搜索
                            visitedX[matchY[y]] = true;
                            queue.push(matchY[y]);
                        }
                    }
                }
            }
            
            if (found) {
                // 更新匹配
                let y = lastY;
                while (y !== -1) {
                    const x = prev[y];
                    const nextY = matchX[x];
                    matchX[x] = y;
                    matchY[y] = x;
                    y = nextY;
                }
                break;
            }
            
            // 更新标号（最小权匹配）
            let delta = Infinity;
            for (let x = 0; x < n; x++) {
                if (!visitedX[x]) continue;
                for (let y = 0; y < m; y++) {
                    if (visitedY[y]) continue;
                    const slack = costMatrix[x][y] - lx[x] - ly[y];
                    delta = Math.min(delta, slack);
                }
            }
            
            for (let x = 0; x < n; x++) {
                if (visitedX[x]) lx[x] += delta;
            }
            for (let y = 0; y < m; y++) {
                if (visitedY[y]) ly[y] -= delta;
            }
        }
    }
    
    return matchX;
}

/**
 * 使用匈牙利算法进行全局匹配
 * @param {Array} shapePoints - 形状点集
 * @param {Array} satPositions - 卫星位置
 * @returns {{matches: Array, totalCost: number}}
 */
function hungarianMatch(shapePoints, satPositions) {
    const n = shapePoints.length;
    const m = satPositions.length;
    
    // 构建成本矩阵
    const costMatrix = [];
    for (let i = 0; i < n; i++) {
        const row = [];
        for (let j = 0; j < m; j++) {
            row.push(distance(shapePoints[i], satPositions[j]));
        }
        costMatrix.push(row);
    }
    
    // 运行匈牙利算法
    const matchX = hungarianAlgorithm(costMatrix);
    
    // 构建匹配结果
    const matches = [];
    let totalCost = 0;
    
    for (let i = 0; i < n; i++) {
        const satIdx = matchX[i];
        const dist = costMatrix[i][satIdx];
        
        matches.push({
            shapePoint: shapePoints[i],
            satIndex: satIdx,
            dist: dist
        });
        
        totalCost += dist;
    }
    
    return {
        matches,
        totalCost
    };
}

/**
 * 模块三：网格搜索最优变换（分层匹配策略）
 * 粗搜索：贪心算法（快速筛选）
 * 精细搜索：匈牙利算法（全局最优）
 * @param {Array} shapePoints - 归一化后的目标形状点集
 * @param {Array} satPositions - 卫星位置 [{x, y}, ...]
 * @returns {{bestAngle: number, bestScale: number, bestTx: number, bestTy: number, bestCost: number, bestMatches: Array}}
 */
export function findBestTransform(shapePoints, satPositions) {
    // 计算卫星质心
    let cx = 0, cy = 0;
    for (const sat of satPositions) {
        cx += sat.x;
        cy += sat.y;
    }
    cx /= satPositions.length;
    cy /= satPositions.length;
    
    // 计算卫星分布范围
    let maxDist = 0;
    for (const s of satPositions) {
        const d = Math.sqrt((s.x - cx) ** 2 + (s.y - cy) ** 2);
        if (d > maxDist) maxDist = d;
    }
    
    // 计算形状点范围
    let shapeMaxDist = 0;
    for (const p of shapePoints) {
        const d = Math.sqrt(p.x * p.x + p.y * p.y);
        if (d > shapeMaxDist) shapeMaxDist = d;
    }
    
    if (shapeMaxDist === 0) shapeMaxDist = 1;
    
    // 缩放范围
    const minScale = (maxDist * 0.5) / shapeMaxDist;
    const maxScale = (maxDist * 1.5) / shapeMaxDist;
    
    // 平移搜索网格
    const gridSize = 3;
    const maxTranslate = maxDist * 1.0;
    const stepX = (maxTranslate * 2) / gridSize;
    const stepY = (maxTranslate * 2) / gridSize;
    
    // 粗搜索使用全部形状点（贪心匹配速度快，可以承受）
    const coarseShapePoints = shapePoints;
    
    console.log(`[MATCH] 卫星分布半径: ${maxDist.toFixed(2)}, 形状半径: ${shapeMaxDist.toFixed(2)}`);
    console.log(`[MATCH] 缩放范围: [${minScale.toFixed(2)}, ${maxScale.toFixed(2)}]`);
    console.log(`[TRANS] 粗搜索: ${gridSize}×${gridSize} 平移 × ${Math.ceil(360/10)} 角度 × 6 缩放 = ${gridSize*gridSize*Math.ceil(360/10)*6} 组合`);
    
    let bestCost = Infinity;
    let bestAngle = 0;
    let bestScale = 1;
    let bestTx = 0;
    let bestTy = 0;
    
    // ========== 第一阶段：粗搜索（贪心算法，快速筛选） ==========
    const angleStep = 10;  // 粗搜索用 10 度步长
    const scaleSteps = 5;
    const scaleStep = (maxScale - minScale) / scaleSteps;
    
    // 收集候选解
    const candidates = [];
    
    for (let gi = 0; gi < gridSize; gi++) {
        for (let gj = 0; gj < gridSize; gj++) {
            // 计算平移位置（带边界检查）
            let tx = cx - maxDist + (gi + 0.5) * stepX;
            let ty = cy - maxDist + (gj + 0.5) * stepY;
            
            // 边界检查：限制平移范围在卫星包围盒的 ±50%
            tx = Math.max(cx - maxTranslate, Math.min(cx + maxTranslate, tx));
            ty = Math.max(cy - maxTranslate, Math.min(cy + maxTranslate, ty));
            
            // 平移卫星坐标
            const shiftedSat = satPositions.map(s => ({ x: s.x - tx, y: s.y - ty }));
            
            // 角度和缩放搜索（使用粗搜索点集 + 贪心算法）
            for (let angle = 0; angle < 360; angle += angleStep) {
                const rotated = rotatePoints(coarseShapePoints, angle);
                
                for (let si = 0; si <= scaleSteps; si++) {
                    const scale = minScale + si * scaleStep;
                    const scaled = scalePoints(rotated, scale);
                    
                    const { totalCost } = matchShapeToSatellites(scaled, shiftedSat);
                    
                    candidates.push({
                        angle: angle,
                        scale: scale,
                        tx: tx,
                        ty: ty,
                        cost: totalCost
                    });
                }
            }
        }
    }
    
    // 按成本排序，取前 Top-K 候选解进行精细搜索
    candidates.sort((a, b) => a.cost - b.cost);
    const topK = Math.min(10, candidates.length);
    const topCandidates = candidates.slice(0, topK);
    
    console.log(`[MATCH] 粗搜索完成: ${candidates.length} 个候选, 最优成本: ${topCandidates[0].cost.toFixed(2)}`);
    
    // ========== 第二阶段：精细搜索（匈牙利算法，全局最优） ==========
    bestCost = Infinity;
    bestAngle = topCandidates[0].angle;
    bestScale = topCandidates[0].scale;
    bestTx = topCandidates[0].tx;
    bestTy = topCandidates[0].ty;
    
    const fineAngleStep = 2;   // 精细搜索 2 度步长
    const fineScaleSteps = 5;   // 精细缩放 5 步
    const fineTopK = Math.min(5, topCandidates.length); // 只对前5个候选精细搜索
    
    for (let ci = 0; ci < fineTopK; ci++) {
        const cand = topCandidates[ci];
        // 在粗搜索最优附近精细搜索角度和缩放
        const angleRange = angleStep;  // ±粗搜索步长
        const scaleRange = scaleStep;  // ±粗搜索步长
        const fineScaleStep = (scaleRange * 2) / fineScaleSteps;
        
        // 精细搜索的形状点数不能超过卫星数（匈牙利算法要求）
        const fineShapePoints = shapePoints.slice(0, Math.min(shapePoints.length, satPositions.length));
        
        for (let da = -angleRange; da <= angleRange; da += fineAngleStep) {
            const fineAngle = cand.angle + da;
            
            for (let si = 0; si <= fineScaleSteps; si++) {
                const fineScale = (cand.scale - scaleRange) + si * fineScaleStep;
                if (fineScale <= 0) continue;
                
                const rotated = rotatePoints(fineShapePoints, fineAngle);
                const scaled = scalePoints(rotated, fineScale);
                const shiftedSat = satPositions.map(s => ({ x: s.x - cand.tx, y: s.y - cand.ty }));
                
                // 精细搜索使用匈牙利算法（形状点不多，性能可接受）
                const { totalCost } = hungarianMatch(scaled, shiftedSat);
                
                if (totalCost < bestCost) {
                    bestCost = totalCost;
                    bestAngle = fineAngle;
                    bestScale = fineScale;
                    bestTx = cand.tx;
                    bestTy = cand.ty;
                }
            }
        }
    }
    
    console.log(`[MATCH] 精细搜索完成: 最优成本: ${bestCost.toFixed(2)}`);
    
    // 获取最佳匹配结果（应用平移）
    const bestRotated = rotatePoints(shapePoints, bestAngle);
    const bestScaled = scalePoints(bestRotated, bestScale);
    const shiftedSat = satPositions.map(s => ({ x: s.x - bestTx, y: s.y - bestTy }));
    // 匈牙利匹配要求形状点数 <= 卫星数
    const matchShapePoints = bestScaled.slice(0, Math.min(bestScaled.length, shiftedSat.length));
    const { matches } = hungarianMatch(matchShapePoints, shiftedSat);
    
    console.log(`[RESULT] 最优变换: angle=${bestAngle.toFixed(1)}°, scale=${bestScale.toFixed(3)}, tx=${bestTx.toFixed(2)}, ty=${bestTy.toFixed(2)}, cost=${bestCost.toFixed(2)}`);
    
    return {
        bestAngle,
        bestScale,
        bestTx,
        bestTy,
        bestCost,
        matches,
        centerX: cx,
        centerY: cy,
        transformedPoints: bestScaled
    };
}


/**
 * 反向最近邻匹配：每颗卫星找最近的形状点
 * 如果距离 <= radiusThreshold 则点亮该卫星
 * 这种方式更适合用卫星"描绘"图案
 * @param {Array} shapePoints - 变换后的形状点集
 * @param {Array} satPositions - 卫星位置
 * @param {number} radiusThreshold - 点亮半径阈值
 * @returns {Map<number, boolean>} 卫星索引 -> 是否点亮
 */
function reverseNearestNeighborLighting(shapePoints, satPositions, radiusThreshold) {
    const result = new Map();
    let litCount = 0;
    
    for (let i = 0; i < satPositions.length; i++) {
        let minDist = Infinity;
        for (const sp of shapePoints) {
            const d = distance(satPositions[i], sp);
            if (d < minDist) minDist = d;
        }
        
        if (minDist <= radiusThreshold) {
            result.set(i, true);
            litCount++;
        } else {
            result.set(i, false);
        }
    }
    
    console.log(`[LIGHT] 反向最近邻: 卫星总数=${satPositions.length}, 点亮=${litCount}, 阈值=${radiusThreshold.toFixed(2)}`);
    return result;
}


/**
 * 模块四：点亮决策
 * @param {Array} matches - 匹配结果
 * @param {number} satCount - 卫星总数
 * @param {number} radiusThreshold - 点亮半径阈值
 * @returns {Map<number, boolean>} 卫星索引 -> 是否点亮
 */
export function decideLighting(matches, satCount, radiusThreshold) {
    const result = new Map();
    
    // 初始化所有卫星为熄灭
    for (let i = 0; i < satCount; i++) {
        result.set(i, false);
    }
    
    // 收集被匹配的卫星及其最小距离
    const satMinDist = new Map();
    for (const m of matches) {
        if (m.satIndex >= 0) {
            const current = satMinDist.get(m.satIndex);
            if (!current || m.dist < current) {
                satMinDist.set(m.satIndex, m.dist);
            }
        }
    }
    
    // 根据距离阈值点亮
    let litCount = 0;
    for (const [satIdx, dist] of satMinDist) {
        if (dist <= radiusThreshold) {
            result.set(satIdx, true);
            litCount++;
        }
    }
    
    console.log(`[LIGHT] 匹配卫星: ${satMinDist.size}, 点亮卫星: ${litCount} (阈值: ${radiusThreshold.toFixed(2)})`);
    
    return result;
}


/**
 * 完整的图像处理流程
 * @param {File} file - 图像文件
 * @param {Array} satPositions - 卫星位置 [{x, y}, ...]
 * @param {number} satCount - 卫星总数
 * @returns {Promise<{lightMap: Map, previewData: ImageData, shapePoints: Array, transform: Object}>}
 */
export async function processImage(file, satPositions, satCount) {
    console.log(`[PROCESS] 开始处理图像...`);
    
    // 模块一：提取目标形状点集
    // 采样点数量应大于卫星数以获得良好覆盖
    const nPoints = Math.max(20, Math.floor(satCount * 1.5));
    const { shapePoints, width, height, previewData, sampled, invert, threshold } = await extractShapePoints(file, nPoints);
    
    if (shapePoints.length < 3) {
        console.warn(`[PROCESS] 形状点太少 (${shapePoints.length})，无法进行匹配`);
        return {
            lightMap: new Map(),
            previewData,
            shapePoints: [],
            transform: null
        };
    }
    
    // 模块二 & 三：搜索最优变换（含平移搜索）
    const transform = findBestTransform(shapePoints, satPositions);
    
    // 计算变换后的形状点（旋转+缩放，不含平移）
    const transformedShapePoints = transform.transformedPoints || 
        scalePoints(rotatePoints(shapePoints, transform.bestAngle), transform.bestScale);
    
    // 将卫星平移到与形状点相同的坐标系
    const alignedSatPositions = satPositions.map(s => ({
        x: s.x - transform.bestTx,
        y: s.y - transform.bestTy
    }));
    
    // 计算点亮半径阈值
    // 核心思路：阈值应基于卫星间距，因为卫星是离散网格
    // 线条型图案的形状点很密集（间距小），不能用形状间距做基准
    // 1) 卫星中位数最近邻距离（使用对齐后的坐标）
    const sampleSize = Math.min(50, alignedSatPositions.length);
    const satNearestDists = [];
    for (let i = 0; i < sampleSize; i++) {
        let minDist = Infinity;
        for (let j = 0; j < alignedSatPositions.length; j++) {
            if (i === j) continue;
            const d = distance(alignedSatPositions[i], alignedSatPositions[j]);
            if (d < minDist) minDist = d;
        }
        satNearestDists.push(minDist);
    }
    satNearestDists.sort((a, b) => a - b);
    const medianSatDist = satNearestDists[Math.floor(satNearestDists.length / 2)];
    
    // 阈值 = 卫星中位距 × 0.7
    // 这意味着：距离形状点不超过 0.7 倍卫星间距的卫星会被点亮
    // 足够覆盖网格间隙，又不会误点亮远离形状的卫星
    const radiusThreshold = medianSatDist * 0.7;
    
    console.log(`[PROCESS] 卫星中位距: ${medianSatDist.toFixed(2)}, 点亮半径: ${radiusThreshold.toFixed(2)}`);
    
    // 模块四：反向最近邻点亮（每颗卫星找最近的形状点，使用对齐坐标）
    const lightMap = reverseNearestNeighborLighting(transformedShapePoints, alignedSatPositions, radiusThreshold);
    
    return {
        lightMap,
        previewData,
        shapePoints,
        transform,
        width,
        height
    };
}

// 保留原有接口兼容性
export function mapSamplesToSatellites(samples, satPositions, canvasWidth, canvasHeight) {
    // 这个函数不再使用，保留接口兼容性
    return new Map();
}

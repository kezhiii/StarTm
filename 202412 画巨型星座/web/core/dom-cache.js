/**
 * DOM 缓存工具类
 * 避免动画循环中重复查询 DOM 元素
 */

/**
 * 创建 DOM 缓存管理器
 * @returns {object} DOM 缓存管理器实例
 */
export function createDomCache() {
    const cache = new Map();
    const stats = { hits: 0, misses: 0, total: 0 };

    /**
     * 获取或创建 DOM 元素引用
     * @param {string} id - 元素 ID
     * @param {boolean} persistent - 是否持久缓存（默认 true）
     * @returns {HTMLElement|null}
     */
    function get(id, persistent = true) {
        stats.total++;
        
        if (cache.has(id)) {
            const entry = cache.get(id);
            // 检查元素是否仍在 DOM 中
            if (entry.element && (entry.element.isConnected || !persistent)) {
                stats.hits++;
                return entry.element;
            }
            // 元素已移除，清除缓存
            cache.delete(id);
        }
        
        // 缓存未命中，查询 DOM
        const element = document.getElementById(id);
        if (element) {
            cache.set(id, { element, persistent });
        }
        stats.misses++;
        return element;
    }

    /**
     * 批量获取元素
     * @param {string[]} ids - ID 数组
     * @returns {object} { id: element } 映射
     */
    function getBatch(ids) {
        const result = {};
        for (const id of ids) {
            result[id] = get(id);
        }
        return result;
    }

    /**
     * 清除指定缓存
     * @param {string} id - 元素 ID
     */
    function clear(id) {
        cache.delete(id);
    }

    /**
     * 清除所有缓存
     */
    function clearAll() {
        cache.clear();
        stats.hits = 0;
        stats.misses = 0;
        stats.total = 0;
    }

    /**
     * 获取缓存统计
     * @returns {object} { hits, misses, total, hitRate }
     */
    function getStats() {
        const hitRate = stats.total > 0 ? (stats.hits / stats.total * 100).toFixed(1) : 0;
        return { ...stats, hitRate: `${hitRate}%` };
    }

    /**
     * 预加载常用元素（应用启动时调用）
     * @param {string[]} ids - 元素 ID 数组
     */
    function preload(ids) {
        for (const id of ids) {
            get(id);
        }
    }

    return {
        get,
        getBatch,
        clear,
        clearAll,
        getStats,
        preload
    };
}

/**
 * 预计算常用值（避免动画循环中重复计算）
 */
export class MathCache {
    constructor() {
        this._cache = new Map();
    }

    /**
     * 缓存三角函数计算
     * @param {string} key - 缓存键
     * @param {Function} fn - 计算函数
     * @returns {*} 计算结果
     */
    compute(key, fn) {
        if (!this._cache.has(key)) {
            this._cache.set(key, fn());
        }
        return this._cache.get(key);
    }

    /**
     * 清除指定缓存
     */
    clear(key) {
        this._cache.delete(key);
    }

    /**
     * 清除所有缓存
     */
    clearAll() {
        this._cache.clear();
    }
}

/**
 * 创建轻量级对象池（减少 GC 压力）
 * @param {Function} factory - 对象工厂函数
 * @param {Function} reset - 重置函数
 * @param {number} maxSize - 池最大容量
 */
export function createObjectPool(factory, reset, maxSize = 100) {
    const pool = [];
    let borrowed = 0;

    return {
        /**
         * 从池中获取对象
         */
        borrow() {
            if (pool.length > 0) {
                const obj = pool.pop();
                borrowed++;
                return obj;
            }
            borrowed++;
            return factory();
        },

        /**
         * 归还对象到池
         */
        release(obj) {
            if (pool.length < maxSize) {
                reset(obj);
                pool.push(obj);
            }
            borrowed--;
        },

        /**
         * 获取池统计
         */
        getStats() {
            return { available: pool.length, borrowed, total: pool.length + borrowed };
        }
    };
}

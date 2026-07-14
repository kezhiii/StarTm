/**
 * 统一日志管理器
 * 支持动态级别控制、模块前缀、生产/开发环境切换
 */

// 日志级别定义（数字越大越严重）
export const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    NONE: 4
};

// 全局配置（可通过 window.DEBUG_CONFIG 在运行时修改）
const DEFAULT_CONFIG = {
    level: LOG_LEVELS.WARN,  // 默认只显示 WARN 和 ERROR
    enabledModules: null,    // null 表示全部启用，数组表示白名单
    useColors: true,         // 开发环境下使用颜色
    timestamp: false         // 是否显示时间戳
};

let config = { ...DEFAULT_CONFIG };

// 颜色方案
const COLORS = {
    DEBUG: '#888',
    INFO: '#4CAF50',
    WARN: '#FF9800',
    ERROR: '#F44336'
};

const LEVEL_NAMES = {
    0: 'DBG',
    1: 'INF',
    2: 'WRN',
    3: 'ERR'
};

/**
 * 创建模块日志器
 * @param {string} moduleName - 模块名称
 * @returns {object} 包含 debug/info/warn/error 方法的日志对象
 */
export function createLogger(moduleName) {
    function shouldLog(level) {
        if (config.enabledModules && !config.enabledModules.includes(moduleName)) {
            return false;
        }
        return level >= config.level;
    }

    function formatMessage(level, message, ...args) {
        const parts = [];
        
        if (config.timestamp) {
            parts.push(`[${new Date().toLocaleTimeString()}]`);
        }
        
        parts.push(`[${LEVEL_NAMES[level]}]`);
        parts.push(`[${moduleName}]`);
        parts.push(message);
        
        return { parts, args };
    }

    function logWithStyle(level, message, ...extraArgs) {
        if (!shouldLog(level)) return;

        const { parts, args } = formatMessage(level, message, ...extraArgs);
        const mainMsg = parts.join(' ');

        if (config.useColors && typeof window !== 'undefined') {
            const color = COLORS[LEVEL_NAMES[level]];
            console.log(`%c${mainMsg}`, `color: ${color}; font-weight: bold`, ...args);
        } else {
            if (level === LOG_LEVELS.WARN) {
                console.warn(mainMsg, ...args);
            } else if (level === LOG_LEVELS.ERROR) {
                console.error(mainMsg, ...args);
            } else {
                console.log(mainMsg, ...args);
            }
        }
    }

    return {
        debug: (msg, ...args) => logWithStyle(LOG_LEVELS.DEBUG, msg, ...args),
        info: (msg, ...args) => logWithStyle(LOG_LEVELS.INFO, msg, ...args),
        warn: (msg, ...args) => logWithStyle(LOG_LEVELS.WARN, msg, ...args),
        error: (msg, ...args) => logWithStyle(LOG_LEVELS.ERROR, msg, ...args),
        
        // 批量日志控制
        setEnabled: (enabled) => {
            if (enabled && !config.enabledModules) {
                config.enabledModules = [moduleName];
            } else if (!enabled && config.enabledModules) {
                config.enabledModules = config.enabledModules.filter(m => m !== moduleName);
            }
        }
    };
}

/**
 * 全局日志配置
 */
export const loggerConfig = {
    // 设置全局日志级别
    setLevel: (level) => { config.level = level; },
    
    // 启用特定模块（白名单模式）
    enableModules: (modules) => { config.enabledModules = Array.isArray(modules) ? modules : [modules]; },
    
    // 启用所有模块
    enableAll: () => { config.enabledModules = null; },
    
    // 开启/关闭颜色
    setColors: (enabled) => { config.useColors = enabled; },
    
    // 开启/关闭时间戳
    setTimestamp: (enabled) => { config.timestamp = enabled; },
    
    // 快速切换到调试模式
    debugMode: () => {
        config.level = LOG_LEVELS.DEBUG;
        config.useColors = true;
        config.timestamp = true;
    },
    
    // 快速切换到生产模式
    productionMode: () => {
        config.level = LOG_LEVELS.WARN;
        config.useColors = false;
        config.timestamp = false;
    },
    
    // 获取当前配置
    getConfig: () => ({ ...config })
};

// 导出便捷方法
export const LOG = {
    DEBUG: LOG_LEVELS.DEBUG,
    INFO: LOG_LEVELS.INFO,
    WARN: LOG_LEVELS.WARN,
    ERROR: LOG_LEVELS.ERROR,
    NONE: LOG_LEVELS.NONE
};

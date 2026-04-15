/**
 * 应用引导类
 * 负责应用初始化和依赖注入，符合单一职责原则
 */

import { createState } from '../modules/state.js';
import { createAppContext } from '../core/app-context.js';
import { createLogger, loggerConfig } from '../core/logger.js';
import { createDomCache } from '../core/dom-cache.js';

/**
 * 应用引导类
 */
export class AppBootstrap {
    constructor() {
        this.log = createLogger('BOOTSTRAP');
        this.state = null;
        this.context = null;
        this.domCache = null;
    }

    /**
     * 执行初始化
     */
    async bootstrap() {
        this.log.info('应用启动中...');
        
        try {
            // 1. 创建全局状态
            this.state = createState();
            this.log.info('状态管理已创建');
            
            // 2. 创建应用上下文
            this.context = createAppContext();
            this.log.info('应用上下文已创建');
            
            // 3. 创建 DOM 缓存
            this.domCache = createDomCache();
            this.log.info('DOM 缓存已创建');
            
            // 4. 配置全局日志
            this.configureLogger();
            
            // 5. 预加载常用 DOM 元素
            this.preloadDomElements();
            
            // 6. 导出全局引用
            this.exportGlobals();
            
            this.log.info('应用引导完成');
            
            return {
                state: this.state,
                context: this.context,
                domCache: this.domCache
            };
        } catch (error) {
            this.log.error('应用引导失败:', error);
            throw error;
        }
    }

    /**
     * 配置日志系统
     */
    configureLogger() {
        // 默认生产模式（可通过控制台覆盖）
        loggerConfig.productionMode();
        
        this.log.debug('日志系统已配置（生产模式）');
    }

    /**
     * 预加载常用 DOM 元素
     */
    preloadDomElements() {
        const commonElements = [
            'canvasContainer',
            'ws-dot',
            'ws-status',
            'coordDisplay',
            'azimuth-display',
            'elevation-display',
            'visibleCount',
            'timeDisplay',
            'totalSatCount',
            'groundInfo',
            'info',
            'thirdViewBtn',
            'firstViewBtn',
            'centerViewBtn',
            'lockViewGroup',
            'playBtn',
            'stopBtn',
            'speed',
            'timeSlider',
            'time-bar',
            'startIdx',
            'endIdx',
            'modeToggle',
            'openConstellationPanel',
            'csvFileInput'
        ];
        
        this.domCache.preload(commonElements);
        this.log.debug(`预加载 ${commonElements.length} 个常用 DOM 元素`);
    }

    /**
     * 导出全局引用（供传统模块使用）
     */
    exportGlobals() {
        // 将核心对象挂载到 appState 上
        this.state.domCache = this.domCache;
        
        // 导出日志配置到全局（供控制台调试）
        if (typeof window !== 'undefined') {
            window.loggerConfig = loggerConfig;
            window.appState = this.state;
            window.appContext = this.context;
        }
        
        this.log.debug('全局引用已导出');
    }

    /**
     * 清理资源
     */
    destroy() {
        this.log.info('应用关闭');
        
        if (this.domCache) {
            this.domCache.clearAll();
        }
        
        if (this.state) {
            // 清理 WebSocket 连接
            if (this.state.ws.connection) {
                this.state.ws.connection.close();
                this.state.ws.connection = null;
            }
            
            // 清理定时器
            if (this.state.csv.state.interval) {
                clearInterval(this.state.csv.state.interval);
            }
            
            if (this.state.ws.playbackAnimId) {
                cancelAnimationFrame(this.state.ws.playbackAnimId);
            }
            
            if (this.state.csv.state.playbackAnimId) {
                cancelAnimationFrame(this.state.csv.state.playbackAnimId);
            }
        }
        
        this.state = null;
        this.context = null;
        this.domCache = null;
    }
}

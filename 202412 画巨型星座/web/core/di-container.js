/**
 * 依赖注入容器
 * 集中管理模块依赖，避免循环引用和全局状态滥用
 */

/**
 * 创建依赖注入容器
 */
export function createContainer() {
    const services = new Map();
    const singletons = new Map();

    return {
        /**
         * 注册服务工厂
         * @param {string} name - 服务名称
         * @param {Function} factory - 工厂函数
         */
        register(name, factory) {
            services.set(name, factory);
            return this;
        },

        /**
         * 注册单例
         * @param {string} name - 服务名称
         * @param {*} instance - 实例对象
         */
        instance(name, instance) {
            singletons.set(name, instance);
            return this;
        },

        /**
         * 解析服务
         * @param {string} name - 服务名称
         * @returns {*} 服务实例
         */
        resolve(name) {
            // 先检查单例
            if (singletons.has(name)) {
                return singletons.get(name);
            }
            
            // 再检查工厂
            if (services.has(name)) {
                const factory = services.get(name);
                const instance = factory(this);
                singletons.set(name, instance);
                return instance;
            }
            
            throw new Error(`服务 "${name}" 未注册`);
        },

        /**
         * 批量解析
         * @param {string[]} names - 服务名称数组
         * @returns {object} 服务映射
         */
        resolveAll(names) {
            const result = {};
            for (const name of names) {
                result[name] = this.resolve(name);
            }
            return result;
        },

        /**
         * 检查服务是否已注册
         * @param {string} name - 服务名称
         * @returns {boolean}
         */
        has(name) {
            return services.has(name) || singletons.has(name);
        },

        /**
         * 清除所有服务
         */
        clear() {
            services.clear();
            singletons.clear();
        }
    };
}

/**
 * 创建应用服务容器（预注册核心服务）
 * @param {object} appState - 全局状态
 * @param {object} appContext - 应用上下文
 * @param {object} domCache - DOM 缓存
 */
export function createAppContainer(appState, appContext, domCache) {
    const container = createContainer();

    // 注册核心服务
    container
        .instance('appState', appState)
        .instance('appContext', appContext)
        .instance('domCache', domCache);

    return container;
}

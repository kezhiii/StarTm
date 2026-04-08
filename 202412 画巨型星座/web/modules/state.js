// ======================== 全局状态管理 ========================

/**
 * 创建应用状态实例
 */
export function createState() {
    return {
        // 当前视角和模式
        currentView: 'third',  // 'third' | 'first' | 'center'
        currentMode: 'ws',     // 'csv' | 'ws'
        
        // 场景对象引用 (由场景模块填充)
        sceneObjects: {
            earth: null,
            earthGroup: null,
            groundStationMarker3D: null,
            orbitRings: [],
            satelliteMeshes3D: [],
            horizonPlane: null,
            horizonRing: null,
            satelliteMeshes1D: [],
            groundStationMarker1D: null,
            gridGroup: null,
            arrowGroup: null,
            centerSatMarker: null,
            satelliteMeshesCenter: [],
            earthRef: null,
        },
        
        // 纹理状态
        textures: {
            earthTextureLoaded: null,
            moonTextureLoaded: null,
        },
        
        // CSV 模式状态
        csv: {
            satelliteData: [],
            timeIndices: [],
            state: {
                isPlaying: false,
                interval: null,
                currentTimeIdx: 0,
                startIdx: 0,
                endIdx: 1439
            }
        },
        
        // WS 模式状态
        ws: {
            connection: null,
            connectionState: 'disconnected',
            dataQueue: [],
            playbackActive: false,
            playbackTimer: null,
            currentTime: 0,
            autoPlayOnConnect: false,
            lastStepData: null
        },
        
        // 用户交互状态
        interaction: {
            currentLat: 10,
            currentLon: 10,
            isViewLocked: true,
            centerDragging: false,
            centerLastMouse: { x: 0, y: 0 },
            fpAzimuth: 0,
            fpElevation: 45,
            fpDragging: false,
            fpLastX: 0,
            fpLastY: 0,
        },
        
        // 相机偏移 (主星视角)
        cameraPanOffset: { x: 0, y: 0, z: 0 },
        
        // 性能优化缓存
        cache: {
            transitionAnimId: null,
            lastTooltipKey: null,
            visibilityCache: null,
            visibilityCacheKey: null,
            tooltipMeshes: [],
        },
        
        // 插值相关
        interpolation: {
            prevFrameData: null,
            currFrameData: null,
            currentInterpData: null,
            interpProgress: 0,
            interpAnimId: null,
        },
        
        // 地球自转相关
        earthRotation: {
            startTime: null,
            startJD: null,
            speedFactor: 1,
        },
    };
}

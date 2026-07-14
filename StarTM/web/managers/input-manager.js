// ======================== 输入管理器 ========================
import * as THREE from 'three';

const DBG = {
    log: (...a) => console.log('[INPUT-MGR]', ...a)
};

/**
 * 创建输入管理器
 * 处理鼠标、键盘、拖拽等交互
 */
export function createInputManager(appState, camera, controls, viewManager, playbackManager, viewCallbacks) {
    const { switchView } = viewManager;
    const { isPlaying, startPlay, stopPlay } = playbackManager;
    const { interaction, cache } = appState;

    // 第一视角鼠标事件状态
    let fpMouseDownHandler, fpMouseMoveHandler, fpMouseUpHandler, fpMouseLeaveHandler;

    /**
     * 初始化第一视角鼠标控制
     */
    function initFirstPersonControls(rendererElement) {
        if (fpMouseDownHandler) rendererElement.removeEventListener('mousedown', fpMouseDownHandler);
        if (fpMouseMoveHandler) rendererElement.removeEventListener('mousemove', fpMouseMoveHandler);
        if (fpMouseUpHandler) rendererElement.removeEventListener('mouseup', fpMouseUpHandler);
        if (fpMouseLeaveHandler) rendererElement.removeEventListener('mouseleave', fpMouseLeaveHandler);

        fpMouseDownHandler = (e) => {
            if (appState.currentView !== 'first') return;
            interaction.fpDragging = true;
            interaction.fpLastX = e.clientX;
            interaction.fpLastY = e.clientY;
        };

        fpMouseMoveHandler = (e) => {
            if (!interaction.fpDragging || appState.currentView !== 'first') return;
            interaction.fpAzimuth -= (e.clientX - interaction.fpLastX) * 0.003;
            interaction.fpElevation = Math.max(1, Math.min(90, interaction.fpElevation + (e.clientY - interaction.fpLastY) * 0.1));
            interaction.fpLastX = e.clientX;
            interaction.fpLastY = e.clientY;
            
            // 修复：拖动时立即调用回调更新相机
            if (viewCallbacks?.updateFirstPersonCamera) {
                viewCallbacks.updateFirstPersonCamera(camera, appState);
            }
        };

        fpMouseUpHandler = () => { interaction.fpDragging = false; };
        fpMouseLeaveHandler = () => { interaction.fpDragging = false; };

        rendererElement.addEventListener('mousedown', fpMouseDownHandler);
        rendererElement.addEventListener('mousemove', fpMouseMoveHandler);
        rendererElement.addEventListener('mouseup', fpMouseUpHandler);
        rendererElement.addEventListener('mouseleave', fpMouseLeaveHandler);
    }

    /**
     * 初始化主星视角鼠标拖拽
     */
    function initCenterPersonMouse(rendererElement, cameraPanOffset, updateCenterPersonCameraMod) {
        rendererElement.addEventListener('mousedown', (e) => {
            if (appState.currentView !== 'center' || interaction.isViewLocked || e.button !== 0) return;
            interaction.centerDragging = true;
            interaction.centerLastMouse = { x: e.clientX, y: e.clientY };
        });
        rendererElement.addEventListener('mousemove', (e) => {
            if (!interaction.centerDragging || appState.currentView !== 'center' || interaction.isViewLocked) return;
            const dx = e.clientX - interaction.centerLastMouse.x;
            const dy = e.clientY - interaction.centerLastMouse.y;
            const viewDir = new THREE.Vector3().subVectors(new THREE.Vector3(0,0,0), camera.position).normalize();
            const up = new THREE.Vector3(0, 1, 0);
            const right = new THREE.Vector3().crossVectors(viewDir, up).normalize();
            const panSpeed = 0.02;
            cameraPanOffset.add(right.clone().multiplyScalar(-dx * panSpeed));
            cameraPanOffset.add(up.clone().multiplyScalar(dy * panSpeed));
            interaction.centerLastMouse = { x: e.clientX, y: e.clientY };
        });
        rendererElement.addEventListener('mouseup', () => { interaction.centerDragging = false; });
        rendererElement.addEventListener('mouseleave', () => { interaction.centerDragging = false; });
    }

    /**
     * 初始化键盘快捷键
     */
    function initKeyboardControls() {
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
            switch(e.key) {
                case ' ': 
                    e.preventDefault(); 
                    isPlaying() ? stopPlay() : startPlay(); 
                    break;
                case '1': switchView('third'); break;
                case '2': switchView('first'); break;
                case '3': switchView('center'); break;
            }
        });
    }

    return {
        initFirstPersonControls,
        initCenterPersonMouse,
        initKeyboardControls
    };
}

// ======================== 时间控制模块 ========================
import { formatTimestamp } from '../math-utils.js';

/**
 * 初始化时间控制
 */
export function initTimeControls(appState, playbackController, updateCallbacks) {
    const startSelect = document.getElementById('startIdx');
    const endSelect = document.getElementById('endIdx');
    const slider = document.getElementById('timeSlider');
    const playBtn = document.getElementById('playBtn');
    const stopBtn = document.getElementById('stopBtn');
    const speedSelect = document.getElementById('speed');
    const modeBtn = document.getElementById('modeToggle');
    
    // 填充时间选择器
    function populateTimeSelectors() {
        if (!startSelect || !endSelect) return;
        
        startSelect.innerHTML = '';
        endSelect.innerHTML = '';
        
        appState.csv.timeIndices.forEach((ts, idx) => {
            const opt1 = document.createElement('option');
            opt1.value = idx;
            opt1.textContent = formatTimestamp(ts);
            startSelect.appendChild(opt1);
            
            const opt2 = document.createElement('option');
            opt2.value = idx;
            opt2.textContent = formatTimestamp(ts);
            endSelect.appendChild(opt2);
        });
        
        endSelect.value = appState.csv.timeIndices.length - 1;
        appState.csv.state.startIdx = 0;
        appState.csv.state.endIdx = appState.csv.timeIndices.length - 1;
        
        slider.max = Math.max(0, appState.csv.timeIndices.length - 1);
    }
    
    // 起始时间选择
    if (startSelect) {
        startSelect.addEventListener('change', () => {
            appState.csv.state.startIdx = parseInt(startSelect.value);
            if (appState.csv.state.currentTimeIdx < appState.csv.state.startIdx) {
                appState.csv.state.currentTimeIdx = appState.csv.state.startIdx;
                slider.value = appState.csv.state.currentTimeIdx;
                if (updateCallbacks.onViewUpdate) {
                    updateCallbacks.onViewUpdate(appState);
                }
            }
        });
    }
    
    // 结束时间选择
    if (endSelect) {
        endSelect.addEventListener('change', () => {
            appState.csv.state.endIdx = parseInt(endSelect.value);
            if (appState.csv.state.currentTimeIdx > appState.csv.state.endIdx) {
                appState.csv.state.currentTimeIdx = appState.csv.state.endIdx;
                slider.value = appState.csv.state.currentTimeIdx;
                if (updateCallbacks.onViewUpdate) {
                    updateCallbacks.onViewUpdate(appState);
                }
            }
        });
    }
    
    // 时间滑块
    if (slider) {
        slider.addEventListener('input', () => {
            appState.csv.state.currentTimeIdx = parseInt(slider.value);
            if (updateCallbacks.onViewUpdate) {
                updateCallbacks.onViewUpdate(appState);
            }
        });
    }
    
    // 播放按钮
    if (playBtn) {
        playBtn.addEventListener('click', () => {
            playbackController.play();
        });
    }
    
    // 停止按钮
    if (stopBtn) {
        stopBtn.addEventListener('click', () => {
            playbackController.stop();
        });
    }
    
    // 速度选择器
    if (speedSelect) {
        speedSelect.addEventListener('change', () => {
            if (appState.csv.state.isPlaying) {
                playbackController.stop();
                playbackController.play();
            } else if (appState.currentMode === 'ws') {
                console.log('WS 模式下速度由服务器控制，前端切换无效');
            }
        });
    }
    
    // 模式切换按钮
    if (modeBtn) {
        modeBtn.addEventListener('click', () => {
            playbackController.toggleMode();
        });
    }
    
    return {
        populateTimeSelectors,
        updateSlider() {
            if (slider) {
                slider.value = appState.csv.state.currentTimeIdx;
            }
        }
    };
}

// ======================== 视图更新工具 ========================

/**
 * 更新当前视图（CSV 模式）
 */
export function updateCurrentView(
    currentView,
    csvState,
    appState,
    camera,
    cameraPanOffset,
    updateModules
) {
    const { timeIndices, satelliteData } = appState.csv;

    if (currentView === 'third') {
        updateModules.updateThird(csvState.currentTimeIdx, satelliteData, appState.sceneObjects, appState.interaction, appState.lightManager);
    } else if (currentView === 'first') {
        updateModules.updateFirstPerson(csvState.currentTimeIdx, appState);
    } else {
        updateModules.updateCenterPerson(csvState.currentTimeIdx, appState, camera, cameraPanOffset);
    }

    // 更新时间进度条
    const progress = timeIndices.length > 1 ? (csvState.currentTimeIdx / (timeIndices.length - 1)) * 100 : 0;
    const bar = document.getElementById('time-bar');
    if (bar) bar.style.width = progress + '%';

    // 更新统计面板
    const statsPanel = document.getElementById('stats-panel');
    if (statsPanel && !statsPanel.classList.contains('hidden') && updateModules.updateStatsPanel) {
        updateModules.updateStatsPanel(appState);
    }
}

/**
 * 更新当前视图（WS 模式）
 */
export function updateCurrentViewWs(
    currentView,
    wsState,
    appState,
    camera,
    cameraPanOffset,
    updateModules
) {
    if (!wsState.lastStepData) return;

    if (currentView === 'third') {
        updateModules.updateThirdWs(wsState.lastStepData, appState.sceneObjects, appState.interaction, appState.lightManager);
    } else if (currentView === 'first') {
        updateModules.updateFirstPersonWs(wsState.lastStepData, appState);
    } else {
        updateModules.updateCenterPersonWs(wsState.lastStepData, appState, camera, cameraPanOffset);
    }
}

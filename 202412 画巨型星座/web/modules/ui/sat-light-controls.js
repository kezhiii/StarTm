// ======================== 卫星灯光 UI 控制模块 ========================

/**
 * 初始化卫星灯光 UI 控制
 * @param {Object} appState - 全局应用状态
 * @param {Object} config - 配置项
 */
export function initSatLightControls(appState, config = {}) {
    const container = document.getElementById('satLightControls');
    if (!container) {
        console.warn('[SAT-LIGHT-UI] 找不到 satLightControls 容器');
        return;
    }

    // 清空容器
    container.innerHTML = '';

    // 标题
    const title = document.createElement('div');
    title.style.cssText = 'font-size: 13px; font-weight: bold; margin-bottom: 8px; color: #fff;';
    title.textContent = '💡 卫星灯光控制';
    container.appendChild(title);

    // 卫星列表容器
    const listContainer = document.createElement('div');
    listContainer.id = 'satLightList';
    listContainer.style.cssText = 'max-height: 300px; overflow-y: auto; padding: 5px;';
    container.appendChild(listContainer);

    // 存储复选框引用
    const checkboxes = [];

    /**
     * 更新卫星列表
     * @param {number} satCount - 卫星总数
     */
    function updateSatList(satCount) {
        listContainer.innerHTML = '';
        checkboxes.length = 0;

        for (let i = 0; i < satCount; i++) {
            const row = document.createElement('div');
            row.style.cssText = 'display: flex; align-items: center; margin: 4px 0; padding: 4px; border-radius: 4px; cursor: pointer;';
            row.onmouseenter = () => row.style.backgroundColor = 'rgba(255,255,255,0.1)';
            row.onmouseleave = () => row.style.backgroundColor = '';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `light-sat-${i}`;
            checkbox.style.cssText = 'margin-right: 8px; cursor: pointer;';
            checkbox.checked = false;

            const label = document.createElement('label');
            label.htmlFor = `light-sat-${i}`;
            label.style.cssText = 'cursor: pointer; color: #ccc; font-size: 12px;';
            label.textContent = `卫星 ${i}`;

            checkbox.addEventListener('change', () => {
                if (appState.lightManager) {
                    appState.lightManager.setLight(i, checkbox.checked);
                    updateRowStyle(row, checkbox.checked);
                    
                    // 设置手动覆盖（30秒内自动计划不生效）
                    if (appState.lightScheduleManager) {
                        appState.lightScheduleManager.setManualOverride(i, checkbox.checked);
                    }
                }
            });

            row.appendChild(checkbox);
            row.appendChild(label);
            listContainer.appendChild(row);
            checkboxes.push(checkbox);

            // 点击行也能切换
            row.addEventListener('click', (e) => {
                if (e.target !== checkbox) {
                    checkbox.checked = !checkbox.checked;
                    checkbox.dispatchEvent(new Event('change'));
                }
            });
        }
    }

    /**
     * 更新行样式（开灯时高亮）
     */
    function updateRowStyle(row, isOn) {
        if (isOn) {
            row.style.backgroundColor = 'rgba(255, 221, 68, 0.2)';
            row.querySelector('label').style.color = '#ffdd44';
        } else {
            row.style.backgroundColor = '';
            row.querySelector('label').style.color = '#ccc';
        }
    }

    /**
     * 同步 UI 状态与灯光管理器
     */
    function syncUI() {
        if (!appState.lightManager) return;
        const allStates = appState.lightManager.getAllStates();
        allStates.forEach((state, idx) => {
            if (checkboxes[idx]) {
                checkboxes[idx].checked = state.isOn;
                const row = checkboxes[idx].parentElement;
                updateRowStyle(row, state.isOn);
            }
        });
    }

    // 初始化
    updateSatList(config.satCount || 22);

    return {
        updateSatList,
        syncUI,
        getCheckboxes: () => checkboxes
    };
}

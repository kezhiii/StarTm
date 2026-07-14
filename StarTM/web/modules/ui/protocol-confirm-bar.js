// ======================== 协议灯光控制确认栏 ========================

/**
 * 创建协议灯光控制确认栏
 * 嵌入编队面板底部，显示待发送指令数量和确认/清空按钮
 * 
 * @param {Object} appState - 全局应用状态
 * @param {Object} options - 配置项
 * @param {Function} options.onConfirm - 确认发送回调 (commands) => void
 * @param {Function} options.onClear - 清空选择回调 () => void
 */
export function createProtocolConfirmBar(appState, options = {}) {
    let bar = null;
    let countLabel = null;
    let confirmBtn = null;
    let clearBtn = null;
    let pendingCommands = new Map();

    /**
     * 初始化确认栏
     */
    function init(parentElement) {
        bar = document.createElement('div');
        bar.id = 'protocolConfirmBar';
        bar.style.cssText = `
            width: 100%;
            display: flex;
            justify-content: flex-end;
            align-items: center;
            gap: 10px;
            padding: 8px 10px;
            margin-top: 8px;
            border-top: 1px solid #333;
        `;

        countLabel = document.createElement('span');
        countLabel.id = 'pendingCount';
        countLabel.style.cssText = 'color: #888; font-size: 12px; margin-right: auto;';
        countLabel.textContent = '已选: 0颗';

        clearBtn = document.createElement('button');
        clearBtn.id = 'clearSelectionBtn';
        clearBtn.textContent = '清空选择';
        clearBtn.style.cssText = `
            background: rgba(255, 100, 100, 0.2);
            border: 1px solid #ff6666;
            color: #ff6666;
            padding: 6px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
        `;
        clearBtn.onmouseenter = () => { clearBtn.style.background = 'rgba(255, 100, 100, 0.4)'; };
        clearBtn.onmouseleave = () => { clearBtn.style.background = 'rgba(255, 100, 100, 0.2)'; };
        clearBtn.onclick = handleClear;

        confirmBtn = document.createElement('button');
        confirmBtn.id = 'confirmSendBtn';
        confirmBtn.textContent = '确认发送';
        confirmBtn.style.cssText = `
            background: rgba(0, 200, 100, 0.2);
            border: 1px solid #00cc66;
            color: #00cc66;
            padding: 6px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            font-weight: bold;
        `;
        confirmBtn.onmouseenter = () => { confirmBtn.style.background = 'rgba(0, 200, 100, 0.4)'; };
        confirmBtn.onmouseleave = () => { confirmBtn.style.background = 'rgba(0, 200, 100, 0.2)'; };
        confirmBtn.onclick = handleConfirm;
        confirmBtn.disabled = true;
        confirmBtn.style.opacity = '0.5';
        confirmBtn.style.cursor = 'not-allowed';

        bar.appendChild(countLabel);
        bar.appendChild(clearBtn);
        bar.appendChild(confirmBtn);

        if (parentElement) {
            parentElement.appendChild(bar);
        }
    }

    /**
     * 处理确认发送
     */
    function handleConfirm() {
        if (pendingCommands.size === 0) return;

        const commands = Array.from(pendingCommands.entries()).map(([satId, command]) => ({
            sat_id: satId,
            command: command,
        }));

        if (typeof options.onConfirm === 'function') {
            options.onConfirm(commands);
        }

        // 清空待发送列表
        pendingCommands.clear();
        updateUI();
    }

    /**
     * 处理清空选择
     */
    function handleClear() {
        pendingCommands.clear();
        updateUI();

        if (typeof options.onClear === 'function') {
            options.onClear();
        }
    }

    /**
     * 切换卫星待发送状态
     * @param {number} satIdx - 卫星索引
     * @param {string} command - "on" 或 "off"
     */
    function toggleCommand(satIdx, command) {
        if (pendingCommands.has(satIdx)) {
            pendingCommands.delete(satIdx);
        } else {
            pendingCommands.set(satIdx, command);
        }
        updateUI();
    }

    /**
     * 检查卫星是否在待发送列表中
     * @param {number} satIdx - 卫星索引
     * @returns {string|null} "on" | "off" | null
     */
    function getPendingCommand(satIdx) {
        return pendingCommands.get(satIdx) || null;
    }

    /**
     * 获取待发送指令数量
     */
    function getPendingCount() {
        return pendingCommands.size;
    }

    /**
     * 更新UI显示
     */
    function updateUI() {
        const count = pendingCommands.size;
        countLabel.textContent = `已选: ${count}颗`;

        if (count > 0) {
            confirmBtn.disabled = false;
            confirmBtn.style.opacity = '1';
            confirmBtn.style.cursor = 'pointer';
            countLabel.style.color = '#ffdd44';
        } else {
            confirmBtn.disabled = true;
            confirmBtn.style.opacity = '0.5';
            confirmBtn.style.cursor = 'not-allowed';
            countLabel.style.color = '#888';
        }
    }

    /**
     * 获取待发送指令列表
     */
    function getCommands() {
        return new Map(pendingCommands);
    }

    return {
        init,
        toggleCommand,
        getPendingCommand,
        getPendingCount,
        getCommands,
        updateUI,
        clear: handleClear,
        getBar: () => bar,
    };
}

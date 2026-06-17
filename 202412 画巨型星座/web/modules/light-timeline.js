// ======================== 灯光时间线管理器 ========================
// 支持批量卫星选择和灯光持续时长

const API_BASE = '/api/light-schedules';

export function createLightTimeline(appState) {
    let container = null;
    let eventList = null;
    let addForm = null;
    let isContainerVisible = false;

    function init(parentElement) {
        container = document.createElement('div');
        container.id = 'lightTimeline';
        container.style.cssText = `
            width: 100%;
            height: 100%;
            overflow-y: auto;
            background: rgba(0, 0, 0, 0.3);
            border: 1px solid #334;
            border-radius: 5px;
            padding: 8px;
            display: flex;
            flex-direction: column;
            gap: 6px;
            box-sizing: border-box;
        `;

        // 标题栏
        const header = document.createElement('div');
        header.style.cssText = 'display: flex; justify-content: space-between; align-items: center;';

        const title = document.createElement('span');
        title.textContent = '⏱ 灯光时间线';
        title.style.cssText = 'color: #aaa; font-size: 12px; font-weight: bold;';

        header.appendChild(title);
        container.appendChild(header);

        // 添加表单（默认隐藏）
        addForm = document.createElement('div');
        addForm.id = 'timelineAddForm';
        addForm.style.cssText = `
            display: none;
            flex-direction: column;
            gap: 8px;
            padding: 12px;
            background: rgba(30, 40, 70, 0.95);
            border-radius: 4px;
            border: 1px solid #4488ff;
            margin-top: 4px;
            margin-bottom: 4px;
            min-width: 280px;
            box-sizing: border-box;
        `;

        // 模式选择
        const modeRow = createFormRow('模式:');
        const modeSelect = document.createElement('select');
        modeSelect.id = 'timelineMode';
        modeSelect.style.cssText = 'background: #1a2a3a; color: #fff; border: 1px solid #446; padding: 2px 4px; border-radius: 3px; font-size: 11px; flex: 1; min-width: 0;';
        modeSelect.innerHTML = '<option value="relative">相对时间</option><option value="absolute">仿真绝对时间</option><option value="wallclock">真实时间</option>';
        modeRow.appendChild(modeSelect);
        addForm.appendChild(modeRow);

        // 卫星多选
        const satRow = document.createElement('div');
        satRow.style.cssText = 'display: flex; flex-direction: column; gap: 4px; width: 100%;';
        const satLabel = document.createElement('label');
        satLabel.textContent = '卫星:';
        satLabel.style.cssText = 'color: #888; font-size: 11px;';
        satRow.appendChild(satLabel);

        const satGrid = document.createElement('div');
        satGrid.id = 'timelineSatGrid';
        satGrid.style.cssText = `
            display: grid;
            grid-template-columns: repeat(5, 1fr);
            gap: 4px;
            max-height: 100px;
            overflow-y: auto;
            padding: 4px;
            background: rgba(10, 20, 40, 0.6);
            border-radius: 3px;
        `;
        satRow.appendChild(satGrid);
        addForm.appendChild(satRow);

        // 全选/反选按钮
        const selectAllRow = document.createElement('div');
        selectAllRow.style.cssText = 'display: flex; gap: 8px; justify-content: flex-end;';
        const selectAllBtn = document.createElement('button');
        selectAllBtn.textContent = '全选';
        selectAllBtn.style.cssText = 'background: #2a4a6a; border: 1px solid #4488ff; color: #fff; padding: 1px 8px; border-radius: 2px; cursor: pointer; font-size: 10px;';
        selectAllBtn.onclick = () => toggleAllSats(true);
        const clearAllBtn = document.createElement('button');
        clearAllBtn.textContent = '清空';
        clearAllBtn.style.cssText = 'background: #3a2a2a; border: 1px solid #644; color: #fff; padding: 1px 8px; border-radius: 2px; cursor: pointer; font-size: 10px;';
        clearAllBtn.onclick = () => toggleAllSats(false);
        selectAllRow.appendChild(selectAllBtn);
        selectAllRow.appendChild(clearAllBtn);
        addForm.appendChild(selectAllRow);

        // 时间输入
        const timeRow = createFormRow('延迟(秒):', 'timelineTimeLabel');
        const timeInput = document.createElement('input');
        timeInput.type = 'number';
        timeInput.id = 'timelineTime';
        timeInput.min = '0';
        timeInput.value = '60';
        timeInput.style.cssText = 'background: #1a2a3a; color: #fff; border: 1px solid #446; padding: 2px 4px; border-radius: 3px; font-size: 11px; flex: 1; min-width: 0;';
        timeRow.appendChild(timeInput);
        addForm.appendChild(timeRow);

        // 持续时长（仅开灯时有效）
        const durationRow = createFormRow('持续(秒):', 'timelineDurationLabel');
        const durationInput = document.createElement('input');
        durationInput.type = 'number';
        durationInput.id = 'timelineDuration';
        durationInput.min = '0';
        durationInput.value = '0';
        durationInput.placeholder = '0=永久';
        durationInput.style.cssText = 'background: #1a2a3a; color: #fff; border: 1px solid #446; padding: 2px 4px; border-radius: 3px; font-size: 11px; flex: 1; min-width: 0;';
        durationRow.appendChild(durationInput);
        addForm.appendChild(durationRow);

        // 命令选择
        const cmdRow = createFormRow('命令:');
        const cmdSelect = document.createElement('select');
        cmdSelect.id = 'timelineCommand';
        cmdSelect.style.cssText = 'background: #1a2a3a; color: #fff; border: 1px solid #446; padding: 2px 4px; border-radius: 3px; font-size: 11px; flex: 1; min-width: 0;';
        cmdSelect.innerHTML = '<option value="on">开灯</option><option value="off">关灯</option>';
        cmdRow.appendChild(cmdSelect);
        addForm.appendChild(cmdRow);

        // 按钮行
        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'display: flex; gap: 4px; justify-content: flex-end; margin-top: 4px;';

        const submitBtn = document.createElement('button');
        submitBtn.textContent = '添加';
        submitBtn.style.cssText = 'background: #2a4a6a; border: 1px solid #4488ff; color: #fff; padding: 4px 16px; border-radius: 3px; cursor: pointer; font-size: 12px; font-weight: bold;';
        submitBtn.onclick = () => submitSchedule();

        btnRow.appendChild(submitBtn);
        addForm.appendChild(btnRow);

        // 模式切换事件
        modeSelect.onchange = () => {
            const label = timeRow.querySelector('label');
            if (modeSelect.value === 'relative') {
                label.textContent = '延迟(秒):';
                timeInput.type = 'number';
                timeInput.value = '60';
                timeInput.min = '0';
            } else if (modeSelect.value === 'absolute') {
                label.textContent = '时间戳:';
                timeInput.type = 'text';
                timeInput.value = '20210817053301';
                timeInput.min = '';
            } else if (modeSelect.value === 'wallclock') {
                label.textContent = '触发时间:';
                timeInput.type = 'datetime-local';
                // 默认设置为当前时间
                const now = new Date();
                now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
                timeInput.value = now.toISOString().slice(0, 16);
                timeInput.min = '';
            }
        };

        // 命令切换事件：关灯时禁用时长
        cmdSelect.onchange = () => {
            const durLabel = durationRow.querySelector('label');
            if (cmdSelect.value === 'off') {
                durationInput.disabled = true;
                durationInput.style.opacity = '0.5';
                durLabel.style.color = '#555';
            } else {
                durationInput.disabled = false;
                durationInput.style.opacity = '1';
                durLabel.style.color = '#888';
            }
        };

        container.appendChild(addForm);
        addForm.style.display = 'none';

        // 事件列表
        eventList = document.createElement('div');
        eventList.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 3px;
            max-height: 200px;
            overflow-y: auto;
        `;
        container.appendChild(eventList);

        parentElement.appendChild(container);
    }

    function createFormRow(labelText, labelId) {
        const row = document.createElement('div');
        row.style.cssText = 'display: flex; gap: 8px; align-items: center; width: 100%; box-sizing: border-box;';
        const label = document.createElement('label');
        label.textContent = labelText;
        label.style.cssText = 'color: #888; font-size: 11px; min-width: 60px; flex-shrink: 0;';
        if (labelId) label.id = labelId;
        row.appendChild(label);
        return row;
    }

    function renderSatelliteGrid() {
        const grid = document.getElementById('timelineSatGrid');
        if (!grid) return;
        grid.innerHTML = '';

        // 从 appState 获取卫星数量
        let satCount = appState.config?.satCount || 0;
        if (satCount === 0) {
            // 备用方案：从实际数据获取
            if (appState.csv && appState.csv.satelliteData && appState.csv.satelliteData[0]) {
                satCount = appState.csv.satelliteData[0].sats.length;
            } else if (appState.ws && appState.ws.lastStepData) {
                satCount = appState.ws.lastStepData.length;
            }
        }

        for (let i = 0; i < satCount; i++) {
            const item = document.createElement('label');
            item.style.cssText = `
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 2px;
                padding: 2px 4px;
                background: rgba(20, 40, 60, 0.6);
                border-radius: 2px;
                cursor: pointer;
                font-size: 10px;
                color: #fff;
            `;
            item.innerHTML = `
                <input type="checkbox" value="${i}" class="sat-checkbox" style="cursor: pointer;">
                <span>${i}</span>
            `;
            grid.appendChild(item);
        }
    }

    function toggleAllSats(checked) {
        const checkboxes = document.querySelectorAll('.sat-checkbox');
        checkboxes.forEach(cb => cb.checked = checked);
    }

    function getSelectedSatIds() {
        const checkboxes = document.querySelectorAll('.sat-checkbox:checked');
        return Array.from(checkboxes).map(cb => parseInt(cb.value));
    }

    function show() {
        if (!container) return;
        container.style.display = 'flex';
        isContainerVisible = true;
        addForm.style.display = 'flex';
        renderSatelliteGrid();
        loadSchedules();
    }

    function hide() {
        if (!container) return;
        isContainerVisible = false;
    }

    function toggle() {
        if (isContainerVisible) hide();
        else show();
    }

    function toggleForm() {
        addForm.style.display = 'flex';
    }

    async function loadSchedules() {
        if (!eventList) return;
        eventList.innerHTML = '<div style="color: #666; font-size: 11px; text-align: center;">加载中...</div>';

        try {
            const resp = await fetch(API_BASE);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const data = await resp.json();
            const schedules = data.schedules || data;

            eventList.innerHTML = '';
            if (!schedules || schedules.length === 0) {
                eventList.innerHTML = '<div style="color: #666; font-size: 11px; text-align: center;">无调度计划</div>';
                return;
            }

            let body_current_step = null;
            if (appState.ws && appState.ws.currentStep !== undefined) {
                body_current_step = appState.ws.currentStep;
            } else if (appState.csv && appState.csv.state) {
                body_current_step = appState.csv.state.currentTimeIdx || 0;
            }

            schedules.forEach(s => {
                const item = document.createElement('div');
                item.style.cssText = `
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 4px 6px;
                    background: rgba(10, 20, 40, 0.6);
                    border-radius: 3px;
                    border-left: 3px solid ${s.command === 'on' ? '#ffdd44' : '#00ff00'};
                `;

                let timeStr;
                if (s.schedule_type === 'relative' && s.trigger_step != null && body_current_step != null) {
                    timeStr = `+${s.trigger_step - body_current_step}s (相对)`;
                } else if (s.schedule_type === 'relative') {
                    timeStr = `step ${s.trigger_step} (相对)`;
                } else if (s.schedule_type === 'wallclock' && s.trigger_at) {
                    const dt = new Date(s.trigger_at);
                    timeStr = `${dt.toLocaleString()} (真实)`;
                } else {
                    timeStr = `${s.trigger_time} (仿真)`;
                }

                const durationStr = s.duration_seconds ? ` [${s.duration_seconds}s]` : '';

                item.innerHTML = `
                    <span style="color: #fff; font-size: 11px;">
                        星${s.sat_id} ${s.command === 'on' ? '开灯' : '关灯'}${durationStr} ${timeStr}
                        ${s.executed ? '<span style="color: #666;">✓</span>' : ''}
                    </span>
                    <button data-id="${s.id}" class="timeline-delete" style="background: #3a2a2a; border: 1px solid #644; color: #f88; padding: 1px 6px; border-radius: 2px; cursor: pointer; font-size: 10px;">删除</button>
                `;

                item.querySelector('.timeline-delete').addEventListener('click', () => deleteSchedule(s.id));
                eventList.appendChild(item);
            });
        } catch (e) {
            eventList.innerHTML = `<div style="color: #f88; font-size: 11px; text-align: center;">加载失败: ${e.message}</div>`;
        }
    }

    // 辅助函数：获取当前播放帧的时间戳
    function getCurrentPlaybackTimestamp() {
        // 优先使用前端实际播放的时间戳
        if (appState.ws && appState.ws.currentPlaybackTimestamp) {
            return appState.ws.currentPlaybackTimestamp;
        }
        if (appState.playback && appState.playback.currentPlaybackTimestamp) {
            return appState.playback.currentPlaybackTimestamp;
        }
        // 回退：使用后端发送的 currentTimestamp
        if (appState.ws && appState.ws.currentTimestamp) {
            return appState.ws.currentTimestamp;
        }
        return null;
    }

    // 辅助函数：在时间戳上添加秒数
    function addSecondsToTimestamp(timestamp, seconds) {
        if (!timestamp || timestamp.length !== 14) return null;
        const year = parseInt(timestamp.slice(0, 4));
        const month = parseInt(timestamp.slice(4, 6)) - 1;
        const day = parseInt(timestamp.slice(6, 8));
        const hour = parseInt(timestamp.slice(8, 10));
        const minute = parseInt(timestamp.slice(10, 12));
        const sec = parseInt(timestamp.slice(12, 14));
        const date = new Date(year, month, day, hour, minute, sec);
        date.setSeconds(date.getSeconds() + seconds);
        const pad = (n) => String(n).padStart(2, '0');
        return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
    }

    async function submitSchedule() {
        const mode = document.getElementById('timelineMode').value;
        const satIds = getSelectedSatIds();
        const timeVal = document.getElementById('timelineTime').value;
        const command = document.getElementById('timelineCommand').value;
        const durationVal = document.getElementById('timelineDuration').value;

        if (satIds.length === 0) {
            alert('请至少选择一颗卫星');
            return;
        }

        const body = {
            sat_ids: satIds,
            schedule_type: mode,
            command: command,
        };

        // 持续时长（仅开灯时有效）
        if (command === 'on') {
            const duration = parseInt(durationVal) || 0;
            if (duration > 0) {
                body.duration_seconds = duration;
            }
        }

        if (mode === 'relative') {
            const offset = parseInt(timeVal) || 0;
            if (offset < 0) {
                alert('延迟时间不能为负数');
                return;
            }
            // 基于当前播放帧的时间戳计算绝对触发时间
            const currentTimestamp = getCurrentPlaybackTimestamp();
            if (!currentTimestamp) {
                alert('无法获取当前播放时间，请确保仿真正在运行');
                return;
            }
            body.trigger_time = addSecondsToTimestamp(currentTimestamp, offset);
            if (!body.trigger_time) {
                alert('时间计算错误');
                return;
            }
            console.log(`[TIMELINE] 相对计划: current=${currentTimestamp}, offset=${offset}s, trigger=${body.trigger_time}`);
        } else if (mode === 'wallclock') {
            // datetime-local 格式: "2026-04-21T15:30"
            // 转换为 ISO 8601 UTC 格式
            if (!timeVal) {
                alert('请选择触发时间');
                return;
            }
            const localDate = new Date(timeVal);
            if (isNaN(localDate.getTime())) {
                alert('无效的时间格式');
                return;
            }
            body.trigger_at = localDate.toISOString();
        } else {
            body.trigger_time = timeVal;
        }

        try {
            const resp = await fetch(API_BASE, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            if (!resp.ok) {
                const err = await resp.json();
                console.error('[TIMELINE] API Error:', err);
                const detail = err.detail || (err.detail && Array.isArray(err.detail) ? err.detail.map(d => `${d.loc.join('.')}: ${d.msg}`).join(', ') : JSON.stringify(err));
                throw new Error(detail || `HTTP ${resp.status}`);
            }

            const result = await resp.json();
            
            // 本地立即添加计划（无需等待轮询）
            if (appState.lightScheduleManager && result.schedules) {
                result.schedules.forEach(s => appState.lightScheduleManager.addSchedule(s));
            }

            // 清空选择
            toggleAllSats(false);
            loadSchedules();
        } catch (e) {
            alert(`创建失败: ${e.message}`);
        }
    }

    async function deleteSchedule(id) {
        try {
            const resp = await fetch(`${API_BASE}/${id}`, { method: 'DELETE' });
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            loadSchedules();
        } catch (e) {
            alert(`删除失败: ${e.message}`);
        }
    }

    return {
        init,
        show,
        hide,
        toggle,
        loadSchedules,
    };
}

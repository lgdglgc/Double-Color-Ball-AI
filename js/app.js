/**
 * 主应用逻辑 - 新UI版本
 */

// 全局状态
let appData = {
    lotteryHistory: null,
    aiPredictions: null,
    predictionsHistory: null
};

// 复制文本辅助函数，兼容 HTTP 环境
function fallbackCopyTextToClipboard(text) {
    return new Promise((resolve, reject) => {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            document.execCommand('copy');
            resolve(); // Even if it returns false, it often actually succeeds in some browsers.
        } catch (err) {
            console.error('Fallback execCommand error:', err);
            resolve(); // Resolve anyway to avoid annoying alerts, if it truly failed the user can manually copy.
        }
        document.body.removeChild(textArea);
    });
}

function copyTextToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext !== false) {
        return navigator.clipboard.writeText(text).catch(() => {
            return fallbackCopyTextToClipboard(text);
        });
    } else {
        return fallbackCopyTextToClipboard(text);
    }
}

// 初始化应用
async function initApp() {
    try {
        // 加载数据
        await loadAllData();

        // 渲染UI
        renderHeroBanner();
        renderModelsGrid();
        renderHistoryTab();

        // 设置事件监听
        setupEventListeners();

        // 隐藏加载屏幕
        hideLoadingScreen();
    } catch (error) {
        console.error('初始化失败:', error);
        alert('数据加载失败，请刷新页面重试');
    }
}

// 加载所有数据
async function loadAllData() {
    try {
        const [lotteryHistory, aiPredictions, predictionsHistory] = await Promise.all([
            DataLoader.loadLotteryHistory(),
            DataLoader.loadPredictions(),
            DataLoader.loadPredictionsHistory()
        ]);

        appData.lotteryHistory = lotteryHistory;
        appData.aiPredictions = aiPredictions;
        appData.predictionsHistory = predictionsHistory;
    } catch (error) {
        console.error('数据加载失败:', error);
        throw error;
    }
}

// 渲染Hero Banner
function renderHeroBanner() {
    if (!appData.lotteryHistory || !appData.aiPredictions) return;

    const nextDraw = appData.lotteryHistory.next_draw;

    // 更新期号
    const heroPeriodEl = document.getElementById('heroPeriod');
    if (heroPeriodEl) heroPeriodEl.textContent = nextDraw.next_period;

    // 更新日期显示
    const heroDateDisplayEl = document.getElementById('heroDateDisplay');
    if (heroDateDisplayEl) heroDateDisplayEl.textContent = nextDraw.next_date_display;

    // 更新开奖时间
    const heroDrawTimeEl = document.getElementById('heroDrawTime');
    if (heroDrawTimeEl) heroDrawTimeEl.textContent = `${nextDraw.draw_time} 开奖`;

    // 更新预测日期
    const heroPredictionDateEl = document.getElementById('heroPredictionDate');
    if (heroPredictionDateEl) heroPredictionDateEl.textContent = appData.aiPredictions.prediction_date;

    // 倒计时 (可选功能)
    const heroCountdownEl = document.getElementById('heroCountdown');
    if (heroCountdownEl) {
        const daysUntil = calculateDaysUntil(nextDraw.next_date);
        heroCountdownEl.textContent = daysUntil > 0 ? `距离开奖仅剩 ${daysUntil} 天` : '即将开奖';
    }
}

// 渲染模型网格
function renderModelsGrid() {
    if (!appData.aiPredictions) return;

    const modelsGridEl = document.getElementById('modelsGrid');
    if (!modelsGridEl) return;

    // 清空现有内容
    modelsGridEl.innerHTML = '';

    // 检测预测期号是否已开奖
    const targetPeriod = appData.aiPredictions.target_period;
    const latestDraw = appData.lotteryHistory?.data?.[0];
    let actualResult = null;

    if (latestDraw && parseInt(targetPeriod) <= parseInt(latestDraw.period)) {
        // 预测期号已开奖，查找对应的开奖结果
        actualResult = appData.lotteryHistory.data.find(draw => draw.period === targetPeriod);

        if (actualResult) {
            // 在网格前添加状态提示
            const statusBanner = createDrawnStatusBanner(actualResult);
            modelsGridEl.appendChild(statusBanner);
        }
    }

    // 渲染每个模型
    appData.aiPredictions.models.forEach(model => {
        const modelCard = Components.createModelCard(model, actualResult);
        modelsGridEl.appendChild(modelCard);
    });

    // 渲染综合推荐卡片
    renderAggregateCard(actualResult);
}

// 渲染综合推荐卡片
function renderAggregateCard(actualResult) {
    if (!appData.aiPredictions || !appData.aiPredictions.models) return;

    const aggregateCardEl = document.getElementById('aggregateCard');
    if (!aggregateCardEl) return;

    const redFreq = {};
    const blueFreq = {};
    let analysisReasoning = null;

    // 统计所有模型的词频作为号码池
    appData.aiPredictions.models.forEach(model => {
        model.predictions.forEach(prediction => {
            prediction.red_balls.forEach(ball => {
                redFreq[ball] = (redFreq[ball] || 0) + 1;
            });
            blueFreq[prediction.blue_ball] = (blueFreq[prediction.blue_ball] || 0) + 1;
        });
    });

    const sortedReds = Object.entries(redFreq).sort((a, b) => b[1] - a[1]).map(item => item[0]);
    const sortedBlues = Object.entries(blueFreq).sort((a, b) => b[1] - a[1]).map(item => item[0]);
    
    // 安全获取元素的辅助函数
    const safeGetRed = (index) => sortedReds[index % sortedReds.length] || "01";
    const safeGetBlue = (index) => sortedBlues[index % sortedBlues.length] || "01";

    let fiveSingleBets = [
        { reds: sortedReds.slice(0, 6).sort((a, b) => parseInt(a) - parseInt(b)), blue: safeGetBlue(0) },
        { reds: [safeGetRed(0), safeGetRed(1), safeGetRed(2), safeGetRed(6), safeGetRed(7), safeGetRed(8)].sort((a, b) => parseInt(a) - parseInt(b)), blue: safeGetBlue(1) },
        { reds: [safeGetRed(1), safeGetRed(3), safeGetRed(5), safeGetRed(7), safeGetRed(9), safeGetRed(10)].sort((a, b) => parseInt(a) - parseInt(b)), blue: safeGetBlue(0) },
        { reds: [safeGetRed(2), safeGetRed(4), safeGetRed(6), safeGetRed(8), safeGetRed(10), safeGetRed(11)].sort((a, b) => parseInt(a) - parseInt(b)), blue: safeGetBlue(1) },
        { reds: [safeGetRed(0), safeGetRed(3), safeGetRed(6), safeGetRed(9), safeGetRed(12), safeGetRed(13)].sort((a, b) => parseInt(a) - parseInt(b)), blue: safeGetBlue(2) }
    ];

    let compound8_2 = {
        reds: sortedReds.slice(0, 8).sort((a, b) => parseInt(a) - parseInt(b)),
        blues: sortedBlues.slice(0, 2).sort((a, b) => parseInt(a) - parseInt(b))
    };

    let dantuo4_3_2 = {
        dan: sortedReds.slice(0, 4).sort((a, b) => parseInt(a) - parseInt(b)),
        tuo: sortedReds.slice(4, 7).sort((a, b) => parseInt(a) - parseInt(b)),
        blues: sortedBlues.slice(0, 2).sort((a, b) => parseInt(a) - parseInt(b))
    };

    let dantuo4_4_2 = {
        dan: sortedReds.slice(0, 4).sort((a, b) => parseInt(a) - parseInt(b)),
        tuo: sortedReds.slice(4, 8).sort((a, b) => parseInt(a) - parseInt(b)),
        blues: sortedBlues.slice(0, 2).sort((a, b) => parseInt(a) - parseInt(b))
    };

    if (appData.aiPredictions.meta_prediction) {
        const meta = appData.aiPredictions.meta_prediction;
        analysisReasoning = meta.analysis_reasoning;
        
        // 替换第一注为 meta 的标准预测
        fiveSingleBets[0] = {
            reds: meta.standard_prediction.red_balls,
            blue: meta.standard_prediction.blue_ball
        };
        
        // 使用 meta 的胆拖，如果拖码不够 4 个，补齐
        let metaDan = meta.dantuo_prediction.dan_reds;
        let metaTuo = [...meta.dantuo_prediction.tuo_reds];
        
        while (metaTuo.length < 3) {
            let nextRed = sortedReds.find(r => !metaDan.includes(r) && !metaTuo.includes(r));
            if (nextRed) metaTuo.push(nextRed);
            else break;
        }
        
        dantuo4_3_2 = {
            dan: metaDan,
            tuo: metaTuo.slice(0, 3).sort((a, b) => parseInt(a) - parseInt(b)),
            blues: meta.dantuo_prediction.blue_balls
        };

        while (metaTuo.length < 4) {
            let nextRed = sortedReds.find(r => !metaDan.includes(r) && !metaTuo.includes(r));
            if (nextRed) metaTuo.push(nextRed);
            else break;
        }
        
        dantuo4_4_2 = {
            dan: metaDan,
            tuo: metaTuo.sort((a, b) => parseInt(a) - parseInt(b)),
            blues: meta.dantuo_prediction.blue_balls
        };
    }

    // 构建号码字符串用于复制
    const headerText = `双色球第 ${appData.aiPredictions.target_period} 期 ${analysisReasoning ? 'MetaAI超级裁判综合推荐' : '综合推荐'}\n`;
    
    let copyTextSingle = `${headerText}\n【精选5注单式】(10元)\n`;
    fiveSingleBets.forEach((bet, idx) => {
        copyTextSingle += `${idx + 1}. 红球: ${bet.reds.join(' ')} | 蓝球: ${bet.blue}\n`;
    });

    let copyText82 = `${headerText}\n【8+2 经济小复式】(56注112元)\n红球: ${compound8_2.reds.join(' ')}\n蓝球: ${compound8_2.blues.join(' ')}\n`;

    let copyText432 = `${headerText}\n【4胆3拖2蓝】(6注12元)\n红胆: ${dantuo4_3_2.dan.join(' ')}\n红拖: ${dantuo4_3_2.tuo.join(' ')}\n蓝球: ${dantuo4_3_2.blues.join(' ')}\n`;

    let copyText442 = `${headerText}\n【4胆4拖2蓝】(12注24元)\n红胆: ${dantuo4_4_2.dan.join(' ')}\n红拖: ${dantuo4_4_2.tuo.join(' ')}\n蓝球: ${dantuo4_4_2.blues.join(' ')}\n`;

    let copyText = copyTextSingle + '\n' + copyText82 + '\n' + copyText432 + '\n' + copyText442;
    copyText = copyText.trim();

    aggregateCardEl.style.display = 'block';
    
    const actualReds = actualResult ? actualResult.red_balls : [];
    const actualBlue = actualResult ? actualResult.blue_ball : null;

    aggregateCardEl.innerHTML = `
        <div class="aggregate-header">
            <div class="aggregate-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
                AI 综合高频推荐
            </div>
            <button class="copy-btn" id="copyAggregateBtn">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
                复制给彩票店
            </button>
        </div>
        ${analysisReasoning ? `
        <div class="meta-reasoning-box">
            <div class="meta-reasoning-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                    <circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>
                </svg>
                裁判点评
            </div>
            <div class="meta-reasoning-text">${analysisReasoning}</div>
        </div>
        ` : ''}
        <div class="aggregate-content">
            <div class="aggregate-section">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                    <div class="aggregate-section-title" style="margin-bottom: 0;">【精选 5 注单式】(10元)</div>
                    <button class="section-copy-btn" data-text-id="copySingle">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>复制
                    </button>
                </div>
                <div class="strategy-row" style="padding: 0; flex-direction: column; gap: 0.25rem;" id="fiveSingleContainer">
                </div>
            </div>
            
            <div class="aggregate-section" style="margin-top: 1.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                    <div class="aggregate-section-title" style="margin-bottom: 0;">【8+2 经济小复式】(56注112元)</div>
                    <button class="section-copy-btn" data-text-id="copy82">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>复制
                    </button>
                </div>
                <div class="strategy-row" style="padding: 0;">
                    <div class="strategy-balls" id="compound82Container" style="align-items: center;"></div>
                </div>
            </div>

            <div class="aggregate-section" style="margin-top: 1.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                    <div class="aggregate-section-title" style="margin-bottom: 0;">【4胆3拖2蓝】(6注12元)</div>
                    <button class="section-copy-btn" data-text-id="copy432">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>复制
                    </button>
                </div>
                <div class="strategy-row" style="padding: 0;">
                    <div class="strategy-balls" id="dantuo432BallsContainer" style="align-items: center;"></div>
                </div>
            </div>

            <div class="aggregate-section" style="margin-top: 1.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                    <div class="aggregate-section-title" style="margin-bottom: 0;">【4胆4拖2蓝】(12注24元)</div>
                    <button class="section-copy-btn" data-text-id="copy442">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>复制
                    </button>
                </div>
                <div class="strategy-row" style="padding: 0;">
                    <div class="strategy-balls" id="dantuoBallsContainer" style="align-items: center;"></div>
                </div>
            </div>
        </div>
    `;

    // 渲染 5注单式
    const fiveSingleContainer = aggregateCardEl.querySelector('#fiveSingleContainer');
    fiveSingleBets.forEach((bet, idx) => {
        const row = document.createElement('div');
        row.className = 'strategy-balls';
        row.style.alignItems = 'center';
        row.style.marginBottom = '0.25rem';
        row.style.paddingBottom = '0.5rem';
        
        const numLabel = document.createElement('div');
        numLabel.style.fontSize = '0.85rem';
        numLabel.style.color = 'var(--text-secondary)';
        numLabel.style.marginRight = '0.25rem';
        numLabel.style.flexShrink = '0';
        numLabel.style.fontWeight = '500';
        numLabel.textContent = `第${idx + 1}注`;
        row.appendChild(numLabel);

        bet.reds.forEach(num => {
            row.appendChild(Components.createLotteryBall(num, 'red', 'md', actualReds.includes(num)));
        });
        row.appendChild(Components.createBallDivider());
        row.appendChild(Components.createLotteryBall(bet.blue, 'blue', 'md', actualBlue === bet.blue));
        
        fiveSingleContainer.appendChild(row);
    });

    // 渲染 8+2 复式
    const compoundContainer = aggregateCardEl.querySelector('#compound82Container');
    compound8_2.reds.forEach(num => {
        compoundContainer.appendChild(Components.createLotteryBall(num, 'red', 'md', actualReds.includes(num)));
    });
    compoundContainer.appendChild(Components.createBallDivider());
    compound8_2.blues.forEach(num => {
        compoundContainer.appendChild(Components.createLotteryBall(num, 'blue', 'md', actualBlue === num));
    });

    // 渲染4胆3拖2蓝
    const dantuo432Container = aggregateCardEl.querySelector('#dantuo432BallsContainer');
    
    const danLabel432 = document.createElement('span');
    danLabel432.className = 'ball-label red-label';
    danLabel432.textContent = '胆';
    dantuo432Container.appendChild(danLabel432);
    
    dantuo4_3_2.dan.forEach(num => {
        dantuo432Container.appendChild(Components.createLotteryBall(num, 'red', 'md', actualReds.includes(num)));
    });
    
    const tuoLabel432 = document.createElement('span');
    tuoLabel432.className = 'ball-label red-label';
    tuoLabel432.style.marginLeft = '0.5rem';
    tuoLabel432.textContent = '拖';
    dantuo432Container.appendChild(tuoLabel432);
    
    dantuo4_3_2.tuo.forEach(num => {
        dantuo432Container.appendChild(Components.createLotteryBall(num, 'red', 'md', actualReds.includes(num)));
    });
    
    const blueLabel432 = document.createElement('span');
    blueLabel432.className = 'ball-label blue-label';
    blueLabel432.style.marginLeft = '0.5rem';
    blueLabel432.textContent = '蓝';
    dantuo432Container.appendChild(blueLabel432);
    
    dantuo4_3_2.blues.forEach(num => {
        dantuo432Container.appendChild(Components.createLotteryBall(num, 'blue', 'md', actualBlue === num));
    });

    // 渲染胆拖复式球
    const dantuoContainer = aggregateCardEl.querySelector('#dantuoBallsContainer');
    
    const danLabel = document.createElement('span');
    danLabel.className = 'ball-label red-label';
    danLabel.textContent = '胆';
    dantuoContainer.appendChild(danLabel);
    
    dantuo4_4_2.dan.forEach(num => {
        dantuoContainer.appendChild(Components.createLotteryBall(num, 'red', 'md', actualReds.includes(num)));
    });
    
    const tuoLabel = document.createElement('span');
    tuoLabel.className = 'ball-label red-label';
    tuoLabel.style.marginLeft = '0.5rem';
    tuoLabel.textContent = '拖';
    dantuoContainer.appendChild(tuoLabel);
    
    dantuo4_4_2.tuo.forEach(num => {
        dantuoContainer.appendChild(Components.createLotteryBall(num, 'red', 'md', actualReds.includes(num)));
    });
    
    const blueLabel = document.createElement('span');
    blueLabel.className = 'ball-label blue-label';
    blueLabel.style.marginLeft = '0.5rem';
    blueLabel.textContent = '蓝';
    dantuoContainer.appendChild(blueLabel);
    
    dantuo4_4_2.blues.forEach(num => {
        dantuoContainer.appendChild(Components.createLotteryBall(num, 'blue', 'md', actualBlue === num));
    });

    // 绑定复制按钮事件
    const copyBtn = aggregateCardEl.querySelector('#copyAggregateBtn');
    copyBtn.addEventListener('click', () => {
        copyTextToClipboard(copyText).then(() => {
            const originalHtml = copyBtn.innerHTML;
            copyBtn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                    <polyline points="20 6 9 17 4 12"/>
                </svg>
                已复制！
            `;
            copyBtn.classList.add('copied');
            setTimeout(() => {
                copyBtn.innerHTML = originalHtml;
                copyBtn.classList.remove('copied');
            }, 2000);
        }).catch(err => {
            console.error('复制失败:', err);
            alert('复制失败，请手动选择号码复制');
        });
    });

    // 绑定分项复制按钮事件
    const copyTexts = {
        'copySingle': copyTextSingle.trim(),
        'copy82': copyText82.trim(),
        'copy432': copyText432.trim(),
        'copy442': copyText442.trim()
    };
    aggregateCardEl.querySelectorAll('.section-copy-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const copyId = btn.getAttribute('data-text-id');
            const textToCopy = copyTexts[copyId];
            copyTextToClipboard(textToCopy).then(() => {
                const originalHtml = btn.innerHTML;
                btn.innerHTML = `
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                        <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    已复制
                `;
                btn.classList.add('copied');
                setTimeout(() => {
                    btn.innerHTML = originalHtml;
                    btn.classList.remove('copied');
                }, 2000);
            }).catch(err => {
                console.error('复制失败:', err);
                alert('复制失败，请手动选择号码复制');
            });
        });
    });
}

// 创建已开奖状态横幅
function createDrawnStatusBanner(actualResult) {
    const banner = document.createElement('div');
    banner.className = 'drawn-status-banner';
    banner.innerHTML = `
        <div class="drawn-status-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
        </div>
        <div class="drawn-status-content">
            <h3 class="drawn-status-title">第 ${actualResult.period} 期已开奖</h3>
            <p class="drawn-status-subtitle">以下为预测命中情况对比</p>
        </div>
        <div class="drawn-status-balls">
            ${actualResult.red_balls.map(num => `<span class="mini-result-ball red">${num}</span>`).join('')}
            <span class="mini-result-ball blue">${actualResult.blue_ball}</span>
        </div>
    `;
    return banner;
}

// 渲染历史标签页
function renderHistoryTab() {
    // 渲染准确度图表
    renderAccuracyChart();

    // 渲染准确度卡片
    renderAccuracyCards();

    // 渲染历史表格
    renderHistoryTable();
}

// 渲染准确度图表
function renderAccuracyChart() {
    if (!appData.predictionsHistory) return;

    const chartEl = document.getElementById('accuracyChart');
    if (!chartEl) return;

    // 准备图表数据
    const chartData = prepareChartData();

    // 使用Chart.js渲染
    new Chart(chartEl, {
        type: 'line',
        data: {
            labels: chartData.labels,
            datasets: chartData.datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 7,
                    ticks: {
                        stepSize: 1
                    },
                    title: {
                        display: true,
                        text: '命中球数'
                    }
                }
            }
        }
    });
}

// 准备图表数据
function prepareChartData() {
    const history = appData.predictionsHistory.predictions_history;
    const labels = [];
    const modelsData = {};

    // 反转以显示时间顺序
    const reversedHistory = [...history].reverse();

    reversedHistory.forEach(record => {
        labels.push(record.target_period);

        record.models.forEach(model => {
            if (!modelsData[model.model_name]) {
                modelsData[model.model_name] = [];
            }

            // 找到最佳命中数
            const bestHit = Math.max(...model.predictions.map(p => p.hit_result?.total_hits || 0));
            modelsData[model.model_name].push(bestHit);
        });
    });

    // 转换为Chart.js数据集格式
    const colors = {
        'GPT-5': '#10b981',
        'Claude 4.5': '#8b5cf6',
        'Gemini 2.5': '#3b82f6',
        'DeepSeek R1': '#f59e0b'
    };

    const datasets = Object.keys(modelsData).map(modelName => ({
        label: modelName,
        data: modelsData[modelName],
        borderColor: colors[modelName] || '#6b7280',
        backgroundColor: colors[modelName] || '#6b7280',
        borderWidth: 3,
        pointRadius: 4,
        pointHoverRadius: 7,
        tension: 0.1
    }));

    return { labels, datasets };
}

// 渲染准确度卡片
function renderAccuracyCards() {
    if (!appData.predictionsHistory) return;

    const containerEl = document.getElementById('accuracyCardsContainer');
    if (!containerEl) return;

    // 清空现有内容
    containerEl.innerHTML = '';

    // 渲染每个记录
    appData.predictionsHistory.predictions_history.forEach((record, index) => {
        const card = Components.createAccuracyCard(record, index);
        containerEl.appendChild(card);
    });
}

// 渲染历史表格
function renderHistoryTable() {
    if (!appData.lotteryHistory) return;

    const tableBodyEl = document.getElementById('historyTableBody');
    if (!tableBodyEl) return;

    // 清空现有内容
    tableBodyEl.innerHTML = '';

    // 渲染每一行
    appData.lotteryHistory.data.forEach(draw => {
        const row = Components.createHistoryTableRow(draw);
        tableBodyEl.appendChild(row);
    });
}

// 渲染频率图表 (分析标签页)
function renderFrequencyChart() {
    if (!appData.lotteryHistory) return;

    const chartEl = document.getElementById('frequencyChart');
    if (!chartEl) return;

    // 计算红球频率
    const frequency = {};
    for (let i = 1; i <= 33; i++) {
        frequency[i.toString().padStart(2, '0')] = 0;
    }

    appData.lotteryHistory.data.forEach(draw => {
        draw.red_balls.forEach(ball => {
            frequency[ball] = (frequency[ball] || 0) + 1;
        });
    });

    const labels = Object.keys(frequency).sort();
    const data = labels.map(label => frequency[label]);

    // 使用Chart.js渲染
    new Chart(chartEl, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: '出现次数',
                data: data,
                backgroundColor: '#fca5a5',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

// 渲染统计卡片
function renderStatisticsCards() {
    if (!appData.lotteryHistory) return;

    // 计算红球频率
    const redFrequency = {};
    for (let i = 1; i <= 33; i++) {
        redFrequency[i.toString().padStart(2, '0')] = 0;
    }

    // 计算蓝球频率
    const blueFrequency = {};
    for (let i = 1; i <= 16; i++) {
        blueFrequency[i.toString().padStart(2, '0')] = 0;
    }

    // 计算和值
    let totalSum = 0;

    appData.lotteryHistory.data.forEach(draw => {
        // 红球
        draw.red_balls.forEach(ball => {
            redFrequency[ball] = (redFrequency[ball] || 0) + 1;
        });
        // 蓝球
        blueFrequency[draw.blue_ball] = (blueFrequency[draw.blue_ball] || 0) + 1;
        // 和值
        const sum = draw.red_balls.reduce((acc, ball) => acc + parseInt(ball), 0);
        totalSum += sum;
    });

    // 找出最热红球
    const hottestRed = Object.entries(redFrequency).sort((a, b) => b[1] - a[1])[0];

    // 找出最热蓝球
    const hottestBlue = Object.entries(blueFrequency).sort((a, b) => b[1] - a[1])[0];

    // 平均和值
    const avgSum = Math.round(totalSum / appData.lotteryHistory.data.length);

    // 更新UI
    const totalDrawsEl = document.getElementById('statTotalDraws');
    if (totalDrawsEl) totalDrawsEl.textContent = `${appData.lotteryHistory.data.length} 期`;

    const hottestRedEl = document.getElementById('statHottestRed');
    if (hottestRedEl) hottestRedEl.textContent = `${hottestRed[0]} (${hottestRed[1]}次)`;

    const hottestBlueEl = document.getElementById('statHottestBlue');
    if (hottestBlueEl) hottestBlueEl.textContent = `${hottestBlue[0]} (${hottestBlue[1]}次)`;

    const avgSumEl = document.getElementById('statAvgSum');
    if (avgSumEl) avgSumEl.textContent = avgSum;
}

// 渲染蓝球频率图表
function renderBlueFrequencyChart() {
    if (!appData.lotteryHistory) return;

    const chartEl = document.getElementById('blueFrequencyChart');
    if (!chartEl) return;

    // 计算蓝球频率
    const frequency = {};
    for (let i = 1; i <= 16; i++) {
        frequency[i.toString().padStart(2, '0')] = 0;
    }

    appData.lotteryHistory.data.forEach(draw => {
        frequency[draw.blue_ball] = (frequency[draw.blue_ball] || 0) + 1;
    });

    const labels = Object.keys(frequency).sort();
    const data = labels.map(label => frequency[label]);

    // 使用Chart.js渲染
    new Chart(chartEl, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: '出现次数',
                data: data,
                backgroundColor: '#93c5fd',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

// 渲染奇偶比图表
function renderOddEvenChart() {
    if (!appData.lotteryHistory) return;

    const chartEl = document.getElementById('oddEvenChart');
    if (!chartEl) return;

    // 计算奇偶比分布
    const ratioCount = {};

    appData.lotteryHistory.data.forEach(draw => {
        const oddCount = draw.red_balls.filter(ball => parseInt(ball) % 2 === 1).length;
        const evenCount = 6 - oddCount;
        const ratio = `${oddCount}:${evenCount}`;
        ratioCount[ratio] = (ratioCount[ratio] || 0) + 1;
    });

    // 按常见比例排序
    const commonRatios = ['0:6', '1:5', '2:4', '3:3', '4:2', '5:1', '6:0'];
    const labels = commonRatios.filter(r => ratioCount[r]);
    const data = labels.map(label => ratioCount[label] || 0);

    // 使用Chart.js渲染
    new Chart(chartEl, {
        type: 'doughnut',
        data: {
            labels: labels.map(l => `${l} (奇:偶)`),
            datasets: [{
                data: data,
                backgroundColor: [
                    '#ef4444', '#f97316', '#f59e0b',
                    '#10b981', '#3b82f6', '#8b5cf6', '#ec4899'
                ],
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 15,
                        font: {
                            size: 11
                        }
                    }
                }
            }
        }
    });
}

// 渲染和值走势图表
function renderSumTrendChart() {
    if (!appData.lotteryHistory) return;

    const chartEl = document.getElementById('sumTrendChart');
    if (!chartEl) return;

    // 取最近30期
    const recentDraws = appData.lotteryHistory.data.slice(0, 30).reverse();

    const labels = recentDraws.map(draw => draw.period);
    const sums = recentDraws.map(draw =>
        draw.red_balls.reduce((acc, ball) => acc + parseInt(ball), 0)
    );

    // 计算平均线
    const avgSum = sums.reduce((a, b) => a + b, 0) / sums.length;

    // 使用Chart.js渲染
    new Chart(chartEl, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: '红球和值',
                    data: sums,
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    borderWidth: 3,
                    pointRadius: 4,
                    pointHoverRadius: 7,
                    tension: 0.3,
                    fill: true
                },
                {
                    label: '平均值',
                    data: Array(sums.length).fill(avgSum),
                    borderColor: '#94a3b8',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    pointRadius: 0,
                    tension: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top'
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    min: 60,
                    max: 180
                }
            }
        }
    });
}

// 渲染区间分布图表
function renderZoneDistributionChart() {
    if (!appData.lotteryHistory) return;

    const chartEl = document.getElementById('zoneDistributionChart');
    if (!chartEl) return;

    // 计算区间分布 (01-11, 12-22, 23-33)
    const zones = {
        '01-11': 0,
        '12-22': 0,
        '23-33': 0
    };

    appData.lotteryHistory.data.forEach(draw => {
        draw.red_balls.forEach(ball => {
            const num = parseInt(ball);
            if (num >= 1 && num <= 11) zones['01-11']++;
            else if (num >= 12 && num <= 22) zones['12-22']++;
            else if (num >= 23 && num <= 33) zones['23-33']++;
        });
    });

    const labels = Object.keys(zones);
    const data = Object.values(zones);

    // 使用Chart.js渲染
    new Chart(chartEl, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: '出现次数',
                data: data,
                backgroundColor: ['#fca5a5', '#93c5fd', '#d8b4fe'],
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 10
                    }
                }
            }
        }
    });
}

// 渲染所有分析图表
function renderAllAnalysisCharts() {
    renderStatisticsCards();
    renderFrequencyChart();
    renderBlueFrequencyChart();
    renderOddEvenChart();
    renderSumTrendChart();
    renderZoneDistributionChart();
}

// 设置事件监听
function setupEventListeners() {
    // Tab切换 - 桌面端
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => handleTabSwitch(item.dataset.tab, navItems));
    });

    // Tab切换 - 移动端
    const mobileNavItems = document.querySelectorAll('.mobile-nav-item');
    mobileNavItems.forEach(item => {
        item.addEventListener('click', () => handleTabSwitch(item.dataset.tab, mobileNavItems));
    });
}

// 处理Tab切换
function handleTabSwitch(tabName, navItems) {
    // 更新导航项状态
    navItems.forEach(item => {
        if (item.dataset.tab === tabName) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    // 同步桌面端和移动端状态
    const allNavItems = document.querySelectorAll('.nav-item, .mobile-nav-item');
    allNavItems.forEach(item => {
        if (item.dataset.tab === tabName) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    // 切换Tab内容
    const tabContents = document.querySelectorAll('.tab-content');
    tabContents.forEach(content => {
        if (content.dataset.tab === tabName) {
            content.classList.add('active');
        } else {
            content.classList.remove('active');
        }
    });

    // 如果切换到分析Tab，渲染所有图表
    if (tabName === 'analysis') {
        // 延迟渲染以确保canvas可见
        setTimeout(() => renderAllAnalysisCharts(), 100);
    }
}

// 隐藏加载屏幕
function hideLoadingScreen() {
    const loadingScreen = document.getElementById('loadingScreen');
    const mainApp = document.getElementById('mainApp');

    if (loadingScreen) {
        loadingScreen.style.display = 'none';
    }

    if (mainApp) {
        mainApp.style.display = 'block';
    }
}

// 计算距离目标日期的天数
function calculateDaysUntil(targetDateStr) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const targetDate = new Date(targetDateStr);
    targetDate.setHours(0, 0, 0, 0);

    const diffTime = targetDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays;
}

// 页面加载完成后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

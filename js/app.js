/**
 * 主应用逻辑 - 新UI版本
 */

// 全局状态
let currentAnalysisPeriod = 30;
let currentSortMode = 'number';
let chartInstances = {};

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

    // 7+2 复式 (42注84元)
    let compound7_2 = {
        reds: sortedReds.slice(0, 7).sort((a, b) => parseInt(a) - parseInt(b)),
        blues: sortedBlues.slice(0, 2).sort((a, b) => parseInt(a) - parseInt(b))
    };

    // 5胆2拖2蓝 (4注8元)
    let dantuo5_2_2 = {
        dan: sortedReds.slice(0, 5).sort((a, b) => parseInt(a) - parseInt(b)),
        tuo: sortedReds.slice(5, 7).sort((a, b) => parseInt(a) - parseInt(b)),
        blues: sortedBlues.slice(0, 2).sort((a, b) => parseInt(a) - parseInt(b))
    };

    // 6+3 蓝球复式 (3注6元)
    let compound6_3 = {
        reds: sortedReds.slice(0, 6).sort((a, b) => parseInt(a) - parseInt(b)),
        blues: sortedBlues.slice(0, 3).sort((a, b) => parseInt(a) - parseInt(b))
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

        // Also update derived combos from meta
        compound7_2 = {
            reds: [...new Set([...metaDan, ...metaTuo])].slice(0, 7).sort((a, b) => parseInt(a) - parseInt(b)),
            blues: meta.dantuo_prediction.blue_balls
        };
        dantuo5_2_2 = {
            dan: metaDan.slice(0, 5),
            tuo: metaTuo.slice(0, 2).sort((a, b) => parseInt(a) - parseInt(b)),
            blues: meta.dantuo_prediction.blue_balls
        };
        compound6_3 = {
            reds: meta.standard_prediction.red_balls,
            blues: [...sortedBlues.slice(0, 3)].sort((a, b) => parseInt(a) - parseInt(b))
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

    let copyText72 = `${headerText}\n【7+2 经济复式】(42注84元)\n红球: ${compound7_2.reds.join(' ')}\n蓝球: ${compound7_2.blues.join(' ')}\n`;

    let copyText522 = `${headerText}\n【5胆2拖2蓝】(4注8元)\n红胆: ${dantuo5_2_2.dan.join(' ')}\n红拖: ${dantuo5_2_2.tuo.join(' ')}\n蓝球: ${dantuo5_2_2.blues.join(' ')}\n`;

    let copyText63 = `${headerText}\n【6+3 蓝球复式】(3注6元)\n红球: ${compound6_3.reds.join(' ')}\n蓝球: ${compound6_3.blues.join(' ')}\n`;

    let copyText = copyTextSingle + '\n' + copyText82 + '\n' + copyText432 + '\n' + copyText442 + '\n' + copyText72 + '\n' + copyText522 + '\n' + copyText63;
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

            <div class="aggregate-section" style="margin-top: 1.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                    <div class="aggregate-section-title" style="margin-bottom: 0;">【7+2 经济复式】(42注84元)</div>
                    <button class="section-copy-btn" data-text-id="copy72">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>复制
                    </button>
                </div>
                <div class="strategy-row" style="padding: 0;">
                    <div class="strategy-balls" id="compound72Container" style="align-items: center;"></div>
                </div>
            </div>

            <div class="aggregate-section" style="margin-top: 1.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                    <div class="aggregate-section-title" style="margin-bottom: 0;">【5胆2拖2蓝】(4注8元)</div>
                    <button class="section-copy-btn" data-text-id="copy522">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>复制
                    </button>
                </div>
                <div class="strategy-row" style="padding: 0;">
                    <div class="strategy-balls" id="dantuo522Container" style="align-items: center;"></div>
                </div>
            </div>

            <div class="aggregate-section" style="margin-top: 1.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                    <div class="aggregate-section-title" style="margin-bottom: 0;">【6+3 蓝球复式】(3注6元)</div>
                    <button class="section-copy-btn" data-text-id="copy63">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>复制
                    </button>
                </div>
                <div class="strategy-row" style="padding: 0;">
                    <div class="strategy-balls" id="compound63Container" style="align-items: center;"></div>
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

    // 渲染 7+2 复式
    const compound72Container = aggregateCardEl.querySelector('#compound72Container');
    compound7_2.reds.forEach(num => {
        compound72Container.appendChild(Components.createLotteryBall(num, 'red', 'md', actualReds.includes(num)));
    });
    compound72Container.appendChild(Components.createBallDivider());
    compound7_2.blues.forEach(num => {
        compound72Container.appendChild(Components.createLotteryBall(num, 'blue', 'md', actualBlue === num));
    });

    // 渲染 5胆2拖2蓝
    const dantuo522Container = aggregateCardEl.querySelector('#dantuo522Container');
    const danLabel522 = document.createElement('span');
    danLabel522.className = 'ball-label red-label';
    danLabel522.textContent = '胆';
    dantuo522Container.appendChild(danLabel522);
    dantuo5_2_2.dan.forEach(num => {
        dantuo522Container.appendChild(Components.createLotteryBall(num, 'red', 'md', actualReds.includes(num)));
    });
    const tuoLabel522 = document.createElement('span');
    tuoLabel522.className = 'ball-label red-label';
    tuoLabel522.style.marginLeft = '0.5rem';
    tuoLabel522.textContent = '拖';
    dantuo522Container.appendChild(tuoLabel522);
    dantuo5_2_2.tuo.forEach(num => {
        dantuo522Container.appendChild(Components.createLotteryBall(num, 'red', 'md', actualReds.includes(num)));
    });
    const blueLabel522 = document.createElement('span');
    blueLabel522.className = 'ball-label blue-label';
    blueLabel522.style.marginLeft = '0.5rem';
    blueLabel522.textContent = '蓝';
    dantuo522Container.appendChild(blueLabel522);
    dantuo5_2_2.blues.forEach(num => {
        dantuo522Container.appendChild(Components.createLotteryBall(num, 'blue', 'md', actualBlue === num));
    });

    // 渲染 6+3 蓝球复式
    const compound63Container = aggregateCardEl.querySelector('#compound63Container');
    compound6_3.reds.forEach(num => {
        compound63Container.appendChild(Components.createLotteryBall(num, 'red', 'md', actualReds.includes(num)));
    });
    compound63Container.appendChild(Components.createBallDivider());
    compound6_3.blues.forEach(num => {
        compound63Container.appendChild(Components.createLotteryBall(num, 'blue', 'md', actualBlue === num));
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
        'copy442': copyText442.trim(),
        'copy72': copyText72.trim(),
        'copy522': copyText522.trim(),
        'copy63': copyText63.trim()
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

function renderOmissionPanel() {
    if (!appData.lotteryHistory) return;
    const allData = appData.lotteryHistory.data;
    const redOmissions = calculateOmissions(allData, 'red');
    const blueOmissions = calculateOmissions(allData, 'blue');

    const topRed = Object.entries(redOmissions).sort((a,b) => b[1]-a[1]).slice(0, 5);
    const topBlue = Object.entries(blueOmissions).sort((a,b) => b[1]-a[1]).slice(0, 5);

    function makeTag(ball, omission, isBlue) {
        const intensity = Math.min(omission / 30, 1);
        const baseHue = isBlue ? '220' : '0';
        const bg = isBlue ? `hsl(220, ${60 + intensity * 40}%, ${90 - intensity * 35}%)` : `hsl(0, ${60 + intensity * 40}%, ${90 - intensity * 35}%)`;
        const fg = intensity > 0.5 ? 'white' : (isBlue ? '#1e3a8a' : '#7f1d1d');
        return `<div title="${ball}号 已遗漏${omission}期" style="
            display: inline-flex; flex-direction: column; align-items: center;
            background: ${bg}; color: ${fg}; border-radius: 8px;
            padding: 0.3rem 0.6rem; font-weight: 700; cursor: default;
            transition: transform 0.15s; min-width: 48px; text-align: center;
        " onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">
            <span style="font-size: 1rem;">${ball}</span>
            <span style="font-size: 0.6rem; font-weight: 600; margin-top: 2px; opacity: 0.85;">遗漏${omission}</span>
        </div>`;
    }

    const redEl = document.getElementById('redOmissionRanking');
    if (redEl) redEl.innerHTML = topRed.map(([b,o]) => makeTag(b, o, false)).join('');
    const blueEl = document.getElementById('blueOmissionRanking');
    if (blueEl) blueEl.innerHTML = topBlue.map(([b,o]) => makeTag(b, o, true)).join('');
}

function renderFrequencyChart() {
    const dataList = getFilteredLotteryData();
    if (dataList.length === 0) return;
    const chartEl = document.getElementById('frequencyChart');
    if (!chartEl) return;

    if (chartInstances['frequencyChart']) chartInstances['frequencyChart'].destroy();

    const frequency = {};
    for (let i = 1; i <= 33; i++) frequency[i.toString().padStart(2, '0')] = 0;
    dataList.forEach(draw => {
        draw.red_balls.forEach(ball => frequency[ball] = (frequency[ball] || 0) + 1);
    });

    const omissions = calculateOmissions(appData.lotteryHistory.data, 'red');
    const avg = Object.values(frequency).reduce((a,b)=>a+b,0) / 33;

    let entries = Object.entries(frequency);

    // Sort based on currentSortMode
    if (currentSortMode === 'freq') {
        entries.sort((a,b) => b[1] - a[1]);
    } else if (currentSortMode === 'omission') {
        entries.sort((a,b) => omissions[b[0]] - omissions[a[0]]);
    } else {
        entries.sort((a,b) => a[0].localeCompare(b[0]));
    }

    const labels = entries.map(e => e[0]);
    const data = entries.map(e => e[1]);
    const maxFreq = Math.max(...data);
    const minFreq = Math.min(...data);

    // Heat gradient coloring
    function heatColor(val) {
        if (maxFreq === minFreq) return '#fca5a5';
        const t = (val - minFreq) / (maxFreq - minFreq); // 0=cold, 1=hot
        if (t > 0.8) return '#dc2626';    // dark red - extremely hot
        if (t > 0.6) return '#ef4444';    // red - hot
        if (t > 0.4) return '#f87171';    // medium red
        if (t > 0.2) return '#fca5a5';    // light red - warm
        return '#94a3b8';                 // gray - cold
    }

    const backgroundColors = data.map(v => heatColor(v));

    chartInstances['frequencyChart'] = new Chart(chartEl, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    type: 'line',
                    label: '理论均值',
                    data: Array(labels.length).fill(avg),
                    borderColor: 'rgba(100,116,139,0.6)',
                    borderWidth: 1.5,
                    borderDash: [6, 4],
                    pointRadius: 0,
                    fill: false,
                    order: 0
                },
                {
                    type: 'bar',
                    label: '出现次数',
                    data: data,
                    backgroundColor: backgroundColors,
                    borderRadius: 5,
                    order: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 500, easing: 'easeInOutQuart' },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(15,23,42,0.9)',
                    titleColor: '#f8fafc',
                    bodyColor: '#cbd5e1',
                    padding: 12,
                    callbacks: {
                        title: ctx => `${ctx[0].label} 号`,
                        label: ctx => {
                            if (ctx.dataset.type === 'line') return null;
                            return [
                                `出现次数: ${ctx.raw} 次`,
                                `当前遗漏: ${omissions[ctx.label]} 期`,
                                `热度: ${(ctx.raw / maxFreq * 100).toFixed(0)}%`
                            ];
                        }
                    }
                }
            },
            scales: {
                x: { grid: { display: false } },
                y: { beginAtZero: true }
            }
        }
    });
}

// 渲染统计卡片

function getFilteredLotteryData() {
    if (!appData.lotteryHistory || !appData.lotteryHistory.data) return [];
    if (currentAnalysisPeriod === 'all') {
        return appData.lotteryHistory.data;
    }
    const limit = parseInt(currentAnalysisPeriod, 10);
    return appData.lotteryHistory.data.slice(0, limit);
}

// 计算遗漏值
function calculateOmissions(data, type) {
    const omissions = {};
    const max = type === 'red' ? 33 : 16;
    for (let i = 1; i <= max; i++) {
        const ball = i.toString().padStart(2, '0');
        let omission = 0;
        for (let j = 0; j < data.length; j++) {
            const draw = data[j];
            if (type === 'red' && draw.red_balls.includes(ball)) {
                break;
            } else if (type === 'blue' && draw.blue_ball === ball) {
                break;
            }
            omission++;
        }
        omissions[ball] = omission;
    }
    return omissions;
}

// 获取渐变颜色
function getHeatColor(value, min, max, baseColor) {
    if (max === min) return baseColor;
    const ratio = (value - min) / (max - min);
    // return color based on ratio. Simplified: return baseColor with opacity or a mix
    // but Chart.js works well with rgba. For simplicity, just return different colors for top 3 and bottom 3
    return baseColor;
}


function setSortMode(mode) {
    currentSortMode = mode;
    // Update button active states
    ['number','freq','omission'].forEach(m => {
        const btn = document.getElementById(`sortBy${m.charAt(0).toUpperCase() + m.slice(1)}`);
        if (btn) btn.classList.toggle('active', m === mode);
    });
    renderFrequencyChart();
}

function renderStatisticsCards() {
    const data = getFilteredLotteryData();
    if (data.length === 0) return;

    const redFrequency = {};
    for (let i = 1; i <= 33; i++) redFrequency[i.toString().padStart(2, '0')] = 0;
    const blueFrequency = {};
    for (let i = 1; i <= 16; i++) blueFrequency[i.toString().padStart(2, '0')] = 0;

    data.forEach(draw => {
        draw.red_balls.forEach(ball => redFrequency[ball] = (redFrequency[ball] || 0) + 1);
        blueFrequency[draw.blue_ball] = (blueFrequency[draw.blue_ball] || 0) + 1;
    });

    const hottestRed = Object.entries(redFrequency).sort((a, b) => b[1] - a[1])[0];
    const hottestBlue = Object.entries(blueFrequency).sort((a, b) => b[1] - a[1])[0];

    // Find coldest red (max omission)
    const redOmissions = calculateOmissions(appData.lotteryHistory.data, 'red'); // use all data for omission
    const coldestRed = Object.entries(redOmissions).sort((a, b) => b[1] - a[1])[0];

    const totalDrawsEl = document.getElementById('statTotalDraws');
    if (totalDrawsEl) totalDrawsEl.textContent = currentAnalysisPeriod === 'all' ? `全部 (${data.length}期)` : `近 ${data.length} 期`;

    const hottestRedEl = document.getElementById('statHottestRed');
    if (hottestRedEl) hottestRedEl.innerHTML = `<strong>${hottestRed[0]}</strong> <span style="font-size:0.8em;color:var(--slate-500)">(${hottestRed[1]}次)</span>`;

    const hottestBlueEl = document.getElementById('statHottestBlue');
    if (hottestBlueEl) hottestBlueEl.innerHTML = `<strong>${hottestBlue[0]}</strong> <span style="font-size:0.8em;color:var(--slate-500)">(${hottestBlue[1]}次)</span>`;

    const coldestRedEl = document.getElementById('statColdestRed');
    if (coldestRedEl) coldestRedEl.innerHTML = `<strong>${coldestRed[0]}</strong> <span style="font-size:0.8em;color:var(--slate-500)">(遗漏${coldestRed[1]}期)</span>`;
}

// 渲染蓝球频率图表
function renderBlueFrequencyChart() {
    const dataList = getFilteredLotteryData();
    if (dataList.length === 0) return;
    const chartEl = document.getElementById('blueFrequencyChart');
    if (!chartEl) return;

    if (chartInstances['blueFrequencyChart']) chartInstances['blueFrequencyChart'].destroy();

    const frequency = {};
    for (let i = 1; i <= 16; i++) frequency[i.toString().padStart(2, '0')] = 0;
    dataList.forEach(draw => {
        frequency[draw.blue_ball] = (frequency[draw.blue_ball] || 0) + 1;
    });

    const labels = Object.keys(frequency).sort();
    const data = labels.map(label => frequency[label]);
    const maxFreq = Math.max(...data);
    const minFreq = Math.min(...data);
    const avg = dataList.length / 16;

    const backgroundColors = data.map(val => {
        if (val === maxFreq) return '#2563eb';
        if (val === minFreq) return '#94a3b8';
        return '#93c5fd';
    });

    const omissions = calculateOmissions(appData.lotteryHistory.data, 'blue');

    chartInstances['blueFrequencyChart'] = new Chart(chartEl, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    type: 'line',
                    label: '理论均值',
                    data: Array(16).fill(avg),
                    borderColor: '#94a3b8',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    pointRadius: 0,
                    fill: false
                },
                {
                    type: 'bar',
                    label: '出现次数',
                    data: data,
                    backgroundColor: backgroundColors,
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                tooltip: {
                    callbacks: {
                        afterLabel: function(context) {
                            if (context.dataset.type === 'line') return null;
                            const ball = context.label;
                            return `当前遗漏: ${omissions[ball]} 期`;
                        }
                    }
                }
            }
        }
    });
}

// 渲染奇偶比图表
function renderOddEvenChart() {
    const dataList = getFilteredLotteryData();
    if (dataList.length === 0) return;
    const chartEl = document.getElementById('oddEvenChart');
    if (!chartEl) return;

    if (chartInstances['oddEvenChart']) chartInstances['oddEvenChart'].destroy();

    const ratioCount = {};
    dataList.forEach(draw => {
        const oddCount = draw.red_balls.filter(ball => parseInt(ball) % 2 === 1).length;
        const evenCount = 6 - oddCount;
        const ratio = `${oddCount}:${evenCount}`;
        ratioCount[ratio] = (ratioCount[ratio] || 0) + 1;
    });

    const commonRatios = ['0:6', '1:5', '2:4', '3:3', '4:2', '5:1', '6:0'];
    const labels = commonRatios.filter(r => ratioCount[r]);
    const data = labels.map(label => ratioCount[label] || 0);

    chartInstances['oddEvenChart'] = new Chart(chartEl, {
        type: 'doughnut',
        data: {
            labels: labels.map(l => l.replace(':', '奇')),
            datasets: [{
                data: data,
                backgroundColor: ['#f87171', '#fb923c', '#fbbf24', '#34d399', '#60a5fa', '#a78bfa', '#f472b6'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '65%'
        }
    });
}

// 渲染和值走势图表
function renderSumTrendChart() {
    let recentDraws = getFilteredLotteryData();
    if (recentDraws.length === 0) return;
    const chartEl = document.getElementById('sumTrendChart');
    if (!chartEl) return;

    if (chartInstances['sumTrendChart']) chartInstances['sumTrendChart'].destroy();

    recentDraws = [...recentDraws].reverse();
    const labels = recentDraws.map(draw => draw.period);
    const sums = recentDraws.map(draw => draw.red_balls.reduce((acc, ball) => acc + parseInt(ball), 0));
    const avgSum = sums.reduce((a, b) => a + b, 0) / sums.length;

    chartInstances['sumTrendChart'] = new Chart(chartEl, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: '红球和值',
                data: sums,
                borderColor: '#eab308',
                backgroundColor: 'rgba(234, 179, 8, 0.1)',
                borderWidth: 2,
                pointBackgroundColor: '#eab308',
                pointRadius: 3,
                fill: true,
                tension: 0.3
            }, {
                label: '均值',
                data: Array(labels.length).fill(avgSum),
                borderColor: '#94a3b8',
                borderWidth: 1,
                borderDash: [5, 5],
                pointRadius: 0,
                fill: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index'
            }
        }
    });
}

// 渲染区间分布图表
function renderZoneDistributionChart() {
    const dataList = getFilteredLotteryData();
    if (dataList.length === 0) return;
    const chartEl = document.getElementById('zoneDistributionChart');
    if (!chartEl) return;

    if (chartInstances['zoneDistributionChart']) chartInstances['zoneDistributionChart'].destroy();

    const zones = { '01-11': 0, '12-22': 0, '23-33': 0 };
    dataList.forEach(draw => {
        draw.red_balls.forEach(ball => {
            const num = parseInt(ball);
            if (num <= 11) zones['01-11']++;
            else if (num <= 22) zones['12-22']++;
            else zones['23-33']++;
        });
    });

    chartInstances['zoneDistributionChart'] = new Chart(chartEl, {
        type: 'bar',
        data: {
            labels: Object.keys(zones),
            datasets: [{
                label: '落球数',
                data: Object.values(zones),
                backgroundColor: ['#fca5a5', '#93c5fd', '#d8b4fe'],
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
}

// 渲染所有分析图表

function renderScatterChart() {
    const dataList = getFilteredLotteryData();
    if (dataList.length === 0) return;
    const chartEl = document.getElementById('scatterChart');
    if (!chartEl) return;

    if (chartInstances['scatterChart']) chartInstances['scatterChart'].destroy();

    const frequency = {};
    for (let i = 1; i <= 33; i++) frequency[i.toString().padStart(2, '0')] = 0;
    dataList.forEach(draw => {
        draw.red_balls.forEach(ball => frequency[ball] = (frequency[ball] || 0) + 1);
    });

    const omissions = calculateOmissions(appData.lotteryHistory.data, 'red');

    const scatterData = Object.entries(frequency).map(([ball, freq]) => ({
        x: freq,
        y: omissions[ball],
        label: ball
    }));

    const maxFreq = Math.max(...scatterData.map(d => d.x));
    const maxOmission = Math.max(...scatterData.map(d => d.y));

    // Color: hot+low omission = red, cold+high omission = purple/gray
    function dotColor(x, y) {
        const heatRatio = x / maxFreq;
        const coldRatio = y / maxOmission;
        if (coldRatio > 0.6) return 'rgba(124,58,237,0.85)';  // very cold - purple warning
        if (heatRatio > 0.7) return 'rgba(220,38,38,0.85)';   // very hot - red
        return 'rgba(100,116,139,0.6)';                         // normal - gray
    }

    chartInstances['scatterChart'] = new Chart(chartEl, {
        type: 'scatter',
        data: {
            datasets: [{
                label: '红球分布',
                data: scatterData,
                backgroundColor: scatterData.map(d => dotColor(d.x, d.y)),
                pointRadius: 8,
                pointHoverRadius: 12
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(15,23,42,0.9)',
                    callbacks: {
                        label: ctx => {
                            const d = ctx.raw;
                            return [`${d.label} 号`, `出现: ${d.x} 次`, `遗漏: ${d.y} 期`];
                        }
                    }
                }
            },
            scales: {
                x: { title: { display: true, text: '→ 出现频次 (越大越热)' }, beginAtZero: true },
                y: { title: { display: true, text: '遗漏期数 (越高越冷)' }, beginAtZero: true }
            }
        },
        plugins: [{
            id: 'labelPlugin',
            afterDatasetDraw(chart) {
                const ctx = chart.ctx;
                chart.data.datasets[0].data.forEach((d, i) => {
                    const meta = chart.getDatasetMeta(0);
                    const pt = meta.data[i];
                    if (!pt) return;
                    ctx.save();
                    ctx.fillStyle = '#1e293b';
                    ctx.font = '600 9px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText(d.label, pt.x, pt.y - 11);
                    ctx.restore();
                });
            }
        }]
    });
}

function renderAllAnalysisCharts() {
    renderStatisticsCards();
    renderOmissionPanel();
    renderFrequencyChart();
    renderBlueFrequencyChart();
    renderOddEvenChart();
    renderSumTrendChart();
    renderZoneDistributionChart();
    renderScatterChart();
}

// 设置事件监听
function setupEventListeners() {
    const periodSelect = document.getElementById('analysisPeriodSelect');
    if (periodSelect) {
        periodSelect.addEventListener('change', (e) => {
            currentAnalysisPeriod = e.target.value;
            renderAllAnalysisCharts();
        });
    }
    
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

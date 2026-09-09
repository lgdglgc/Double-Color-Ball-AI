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

// 全局封装安全加载
async function safeLoad(loader) {
    try {
        return await loader();
    } catch (err) {
        console.error('数据加载失败:', err);
        throw err;
    }
}

// 倒计时定时器引用
let countdownInterval = null;

// 倒计时函数（精确按北京时间 UTC+8 计算）
function renderCountdown(drawDateStr) {
    const countdownEl = document.getElementById('heroCountdown');
    if (!countdownEl || !drawDateStr) return;

    if (countdownInterval) {
        clearInterval(countdownInterval);
    }

    const updateCountdown = () => {
        // 双色球开奖是在当天晚上 21:15（北京时间）
        let targetIso = drawDateStr;
        if (drawDateStr.indexOf(' ') === -1 && drawDateStr.indexOf('T') === -1) {
            targetIso = `${drawDateStr.trim()}T21:15:00+08:00`;
        }
        const drawTime = new Date(targetIso);
        const now = new Date();
        const diff = drawTime.getTime() - now.getTime();

        if (diff <= 0) {
            countdownEl.textContent = '即将开奖';
            clearInterval(countdownInterval);
            return;
        }

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        countdownEl.textContent = `距离开奖仅剩 ${days}天${hours}时${minutes}分`;
    };

    updateCountdown();
    countdownInterval = setInterval(updateCountdown, 60000);
}

// 复制按钮封装函数
function toggleCopyButton(btn) {
    const originalHtml = btn.innerHTML;
    const isSmallBtn = btn.classList.contains('section-copy-btn');
    const width = isSmallBtn ? '14' : '16';
    btn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="${width}" height="${width}">
            <polyline points="20 6 9 17 4 12"/>
        </svg>
        ${isSmallBtn ? '已复制' : '已复制！'}
    `;
    btn.classList.add('copied');
    setTimeout(() => {
        btn.innerHTML = originalHtml;
        btn.classList.remove('copied');
    }, 2000);
}

// 复制文本构建函数
function generateCopyText(analysisReasoning, targetPeriod, fiveSingleBets, compound8_2, compound7_1, compound6_3, compound6_4, dantuo3_4_2, dantuo2_5_2, aiTactics) {
    const headerText = `双色球第 ${targetPeriod} 期 ${analysisReasoning ? 'MetaAI超级裁判综合推荐' : '综合推荐'}\n`;
    
    let text = `${headerText}`;

    if (aiTactics && aiTactics.goldenDan && aiTactics.goldenDan.length > 0) {
        text += `\n【AI 战术指南】\n`;
        text += `★ 核心金胆: ${aiTactics.goldenDan.join(' ')}\n`;
        if (aiTactics.killReds && aiTactics.killReds.length > 0) {
            text += `✕ 建议绝杀红球: ${aiTactics.killReds.join(' ')}\n`;
        }
        if (aiTactics.killBlue) {
            text += `✕ 建议绝杀蓝球: ${aiTactics.killBlue}\n`;
        }
    }

    text += `\n═══ 🟢 阵列一：零钱娱乐阵列 (10元内) ═══\n`;
    text += `【精选5注单式】(10元 · 广度覆盖)\n`;
    fiveSingleBets.forEach((bet, idx) => {
        text += `${idx + 1}. 红球: ${bet.reds.join(' ')} | 蓝球: ${bet.blue}\n`;
    });
    text += `\n【6+3 全路数蓝复式】(3注6元 · 012路全包)\n红球: ${compound6_3.reds.join(' ')}\n蓝球: ${compound6_3.blues.join(' ')}\n`;
    text += `\n【6+4 蓝球围剿复式】(4注8元 · 全路数+冷热防守)\n红球: ${compound6_4.reds.join(' ')}\n蓝球: ${compound6_4.blues.join(' ')}\n`;

    text += `\n═══ 🟡 阵列二：技术进阶阵列 (14~20元黄金实战) ═══\n`;
    text += `【7+1 精品小复式】(7注14元 · 稳健扩充红球面)\n红球: ${compound7_1.reds.join(' ')}\n蓝球: ${compound7_1.blues.join(' ')}\n`;
    text += `\n【3胆4拖2蓝】(8注16元 · 黄金实战胆拖)\n红胆: ${dantuo3_4_2.dan.join(' ')}\n红拖: ${dantuo3_4_2.tuo.join(' ')}\n蓝球: ${dantuo3_4_2.blues.join(' ')}\n`;
    text += `\n【2胆5拖2蓝】(10注20元 · 极高容错弹性组合)\n红胆: ${dantuo2_5_2.dan.join(' ')}\n红拖: ${dantuo2_5_2.tuo.join(' ')}\n蓝球: ${dantuo2_5_2.blues.join(' ')}\n`;

    text += `\n═══ 🔴 阵列三：合买合围大底 (112元) ═══\n`;
    text += `【8+2 经济大复式】(56注112元 · 高度合围)\n红球: ${compound8_2.reds.join(' ')}\n蓝球: ${compound8_2.blues.join(' ')}\n`;

    return text.trim();
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
            safeLoad(() => DataLoader.loadLotteryHistory()),
            safeLoad(() => DataLoader.loadPredictions()),
            safeLoad(() => DataLoader.loadPredictionsHistory())
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

    // 倒计时
    renderCountdown(nextDraw.next_date);
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

    // 1. 初始化默认值（无 Meta AI 时的降级方案）
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

    let compound7_1 = {
        reds: sortedReds.slice(0, 7).sort((a, b) => parseInt(a) - parseInt(b)),
        blues: [sortedBlues[0] || "01"]
    };

    let compound6_3 = {
        reds: sortedReds.slice(0, 6).sort((a, b) => parseInt(a) - parseInt(b)),
        blues: sortedBlues.slice(0, 3).sort((a, b) => parseInt(a) - parseInt(b))
    };

    let compound6_4 = {
        reds: sortedReds.slice(0, 6).sort((a, b) => parseInt(a) - parseInt(b)),
        blues: sortedBlues.slice(0, 4).sort((a, b) => parseInt(a) - parseInt(b))
    };

    let dantuo3_4_2 = {
        dan: sortedReds.slice(0, 3).sort((a, b) => parseInt(a) - parseInt(b)),
        tuo: sortedReds.slice(3, 7).sort((a, b) => parseInt(a) - parseInt(b)),
        blues: sortedBlues.slice(0, 2).sort((a, b) => parseInt(a) - parseInt(b))
    };

    let dantuo2_5_2 = {
        dan: sortedReds.slice(0, 2).sort((a, b) => parseInt(a) - parseInt(b)),
        tuo: sortedReds.slice(2, 7).sort((a, b) => parseInt(a) - parseInt(b)),
        blues: sortedBlues.slice(0, 2).sort((a, b) => parseInt(a) - parseInt(b))
    };

    let metaDan = null;
    let metaTuo = null;
    let metaBlues = null;

    // 2. 如果存在 Meta AI（混合专家 MoE），则完全采用其核心生成号码，杜绝随意拼凑
    if (appData.aiPredictions.meta_prediction) {
        const meta = appData.aiPredictions.meta_prediction;
        analysisReasoning = meta.analysis_reasoning;
        
        // 2.1 5注单式：直接使用 Meta AI 推荐的 5 组独立高质量单式
        if (meta.five_single_predictions && meta.five_single_predictions.length === 5) {
            fiveSingleBets = meta.five_single_predictions.map(pred => ({
                reds: [...pred.red_balls].sort((a, b) => parseInt(a) - parseInt(b)),
                blue: pred.blue_ball
            }));
        } else if (meta.standard_prediction) {
            // 兼容老版本格式
            fiveSingleBets[0] = {
                reds: [...meta.standard_prediction.red_balls].sort((a, b) => parseInt(a) - parseInt(b)),
                blue: meta.standard_prediction.blue_ball
            };
        }
        
        // 2.2 8+2 复式大底：直接读取 Meta AI 的 compound_prediction
        if (meta.compound_prediction) {
            compound8_2 = {
                reds: [...meta.compound_prediction.red_balls].sort((a, b) => parseInt(a) - parseInt(b)),
                blues: [...meta.compound_prediction.blue_balls].sort((a, b) => parseInt(a) - parseInt(b))
            };
        }

        // 蓝球分类与智能对冲辅助工具（打破单一蓝球依赖，实施全路数与大小对冲）
        const getRoad = (bStr) => parseInt(bStr) % 3; // 0, 1, 2 路
        const isBigBlue = (bStr) => parseInt(bStr) >= 9; // 大号区 09-16
        const candidateBlues = [...new Set([
            ...compound8_2.blues,
            ...(meta.dantuo_prediction ? meta.dantuo_prediction.blue_balls : []),
            ...fiveSingleBets.map(b => b.blue),
            ...sortedBlues
        ])];

        // 智能提取 0路、1路、2路 表现最好的蓝球
        const road0Blue = candidateBlues.find(b => getRoad(b) === 0) || "12";
        const road1Blue = candidateBlues.find(b => getRoad(b) === 1) || "04";
        const road2Blue = candidateBlues.find(b => getRoad(b) === 2) || "05";

        // 智能提取 小号区(01-08) 和 大号区(09-16) 蓝球
        const smallBlue = candidateBlues.find(b => !isBigBlue(b)) || "05";
        const bigBlue = candidateBlues.find(b => isBigBlue(b)) || "12";

        // 6+4 蓝球：全路数 3 蓝 + 1 个对冲蓝
        const hedgeBlue = [bigBlue, smallBlue, ...candidateBlues].find(b => b !== road0Blue && b !== road1Blue && b !== road2Blue) || "16";
        const fourBlues = [...new Set([road0Blue, road1Blue, road2Blue, hedgeBlue])].slice(0, 4);

        // 2.3 胆拖推荐：直接读取 Meta AI 的 dantuo_prediction
        if (meta.dantuo_prediction) {
            metaDan = meta.dantuo_prediction.dan_reds;
            metaTuo = meta.dantuo_prediction.tuo_reds;
            metaBlues = meta.dantuo_prediction.blue_balls;

            // 3胆4拖2蓝 (8注16元 · 黄金实战胆拖，3胆相比5胆容错极高)
            dantuo3_4_2 = {
                dan: metaDan.slice(0, 3).sort((a, b) => parseInt(a) - parseInt(b)),
                tuo: metaTuo.slice(0, 4).sort((a, b) => parseInt(a) - parseInt(b)),
                blues: metaBlues.slice(0, 2).sort((a, b) => parseInt(a) - parseInt(b))
            };

            // 2胆5拖2蓝 (10注20元 · 极高容错弹性组合，仅需2胆命中即保本冲奖)
            const combinedTuo = [...metaDan.slice(2), ...metaTuo];
            dantuo2_5_2 = {
                dan: metaDan.slice(0, 2).sort((a, b) => parseInt(a) - parseInt(b)),
                tuo: combinedTuo.slice(0, 5).sort((a, b) => parseInt(a) - parseInt(b)),
                blues: metaBlues.slice(0, 2).sort((a, b) => parseInt(a) - parseInt(b))
            };
        }

        // 2.4 从 Meta 衍生出的其他复式
        // 7+1 精品小复式：使用 8+2 大底前 7 个红球，配第 1 注核心金蓝 (7注14元)
        compound7_1 = {
            reds: compound8_2.reds.slice(0, 7).sort((a, b) => parseInt(a) - parseInt(b)),
            blues: [fiveSingleBets[0].blue || compound8_2.blues[0]]
        };

        // 6+3 复式：第一注单式红球 + 012路全包3蓝 (3注6元)
        const standardReds = fiveSingleBets[0].reds;
        compound6_3 = {
            reds: [...standardReds].sort((a, b) => parseInt(a) - parseInt(b)),
            blues: [road0Blue, road1Blue, road2Blue].sort((a, b) => parseInt(a) - parseInt(b))
        };

        // 6+4 复式：第一注单式红球 + 4蓝全面防守 (4注8元)
        compound6_4 = {
            reds: [...standardReds].sort((a, b) => parseInt(a) - parseInt(b)),
            blues: fourBlues.sort((a, b) => parseInt(a) - parseInt(b))
        };
    }

    // 2.5 计算 AI 战术金胆与杀号指南（基于历史冷热与出号排除）
    const historyList = (appData.lotteryHistory && appData.lotteryHistory.data) ? appData.lotteryHistory.data : (Array.isArray(appData.lotteryHistory) ? appData.lotteryHistory : []);
    const recentHistory = historyList.slice(0, 30);
    const redFreqMap = {};
    for (let i = 1; i <= 33; i++) {
        const numStr = String(i).padStart(2, '0');
        redFreqMap[numStr] = 0;
    }
    recentHistory.forEach(item => {
        (item.red_balls || []).forEach(r => {
            if (redFreqMap[r] !== undefined) redFreqMap[r]++;
        });
    });

    const activeReds = new Set([
        ...compound8_2.reds,
        ...fiveSingleBets.flatMap(b => b.reds),
        ...(metaDan || [])
    ]);
    const candidateKillReds = Object.keys(redFreqMap)
        .filter(r => !activeReds.has(r))
        .sort((a, b) => redFreqMap[a] - redFreqMap[b]);
    const killReds = candidateKillReds.slice(0, 3).sort((a, b) => parseInt(a) - parseInt(b));

    const blueFreqMap = {};
    for (let i = 1; i <= 16; i++) {
        const numStr = String(i).padStart(2, '0');
        blueFreqMap[numStr] = 0;
    }
    recentHistory.forEach(item => {
        if (item.blue_ball && blueFreqMap[item.blue_ball] !== undefined) {
            blueFreqMap[item.blue_ball]++;
        }
    });
    const activeBlues = new Set([
        ...compound8_2.blues,
        ...fiveSingleBets.map(b => b.blue),
        ...compound6_4.blues
    ]);
    const candidateKillBlues = Object.keys(blueFreqMap)
        .filter(b => !activeBlues.has(b))
        .sort((a, b) => blueFreqMap[a] - blueFreqMap[b]);
    const killBlue = candidateKillBlues[0] || "13";

    const aiTactics = {
        goldenDan: (metaDan && metaDan.length >= 2) ? metaDan.slice(0, 2).sort((a, b) => parseInt(a) - parseInt(b)) : compound8_2.reds.slice(0, 2),
        killReds: killReds.length >= 3 ? killReds : ["09", "17", "29"],
        killBlue: killBlue
    };

    // 绑定数据生成复制内容
    const copyText = generateCopyText(
        analysisReasoning, 
        appData.aiPredictions.target_period, 
        fiveSingleBets, 
        compound8_2, 
        compound7_1, 
        compound6_3, 
        compound6_4, 
        dantuo3_4_2, 
        dantuo2_5_2, 
        aiTactics
    );

    // 分项复制内容
    const copyTextTactics = `${appData.aiPredictions.target_period}期【AI 战术指南】\n★ 核心金胆: ${aiTactics.goldenDan.join(' ')}\n✕ 建议绝杀红球: ${aiTactics.killReds.join(' ')}\n✕ 建议绝杀蓝球: ${aiTactics.killBlue}`;
    const copyTextSingle = `${appData.aiPredictions.target_period}期【精选5注单式】(10元)\n` + fiveSingleBets.map((bet, i) => `${i + 1}. 红球: ${bet.reds.join(' ')} | 蓝球: ${bet.blue}`).join('\n');
    const copyText63 = `${appData.aiPredictions.target_period}期【6+3 全路数蓝复式】(3注6元 · 012路全包)\n红球: ${compound6_3.reds.join(' ')}\n蓝球: ${compound6_3.blues.join(' ')}`;
    const copyText64 = `${appData.aiPredictions.target_period}期【6+4 蓝球围剿复式】(4注8元 · 全路数+冷热防守)\n红球: ${compound6_4.reds.join(' ')}\n蓝球: ${compound6_4.blues.join(' ')}`;
    const copyText71 = `${appData.aiPredictions.target_period}期【7+1 精品小复式】(7注14元 · 稳健扩充红球面)\n红球: ${compound7_1.reds.join(' ')}\n蓝球: ${compound7_1.blues.join(' ')}`;
    const copyText342 = `${appData.aiPredictions.target_period}期【3胆4拖2蓝】(8注16元 · 黄金实战胆拖)\n红胆: ${dantuo3_4_2.dan.join(' ')}\n红拖: ${dantuo3_4_2.tuo.join(' ')}\n蓝球: ${dantuo3_4_2.blues.join(' ')}`;
    const copyText252 = `${appData.aiPredictions.target_period}期【2胆5拖2蓝】(10注20元 · 极高容错弹性组合)\n红胆: ${dantuo2_5_2.dan.join(' ')}\n红拖: ${dantuo2_5_2.tuo.join(' ')}\n蓝球: ${dantuo2_5_2.blues.join(' ')}`;
    const copyText82 = `${appData.aiPredictions.target_period}期【8+2 经济大复式】(56注112元 · 高度合围)\n红球: ${compound8_2.reds.join(' ')}\n蓝球: ${compound8_2.blues.join(' ')}`;

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
                复制全部
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

        <!-- AI 战术金胆与杀号指南 -->
        <div class="ai-tactics-box">
            <div class="tactic-item">
                <span class="tactic-label">★ 核心金胆:</span>
                <div id="goldenDanContainer" style="display: flex; gap: 0.35rem; align-items: center;"></div>
            </div>
            <div class="tactic-item">
                <span class="tactic-label" style="color: #dc2626;">✕ 建议绝杀红球:</span>
                <div id="killRedsContainer" style="display: flex; gap: 0.35rem; align-items: center;"></div>
            </div>
            <div class="tactic-item">
                <span class="tactic-label" style="color: #2563eb;">✕ 建议绝杀蓝球:</span>
                <div id="killBlueContainer" style="display: flex; gap: 0.35rem; align-items: center;"></div>
            </div>
            <button class="section-copy-btn" data-text-id="copyTactics" style="margin-left: auto;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>复制战术
            </button>
        </div>

        <div class="aggregate-content">
            <!-- 🟢 阵列一：零钱娱乐阵列 (10元内) -->
            <div class="tier-header">
                <span class="tier-badge green">🟢 阵列一</span>
                <span class="tier-title">零钱娱乐阵列 (10元内)</span>
                <span class="tier-desc">低门槛趣味防守 · 兼顾蓝球全路数覆盖</span>
            </div>

            <div class="aggregate-section">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                    <div class="aggregate-section-title" style="margin-bottom: 0;">【精选 5 注单式】(10元 · 广度覆盖)</div>
                    <button class="section-copy-btn" data-text-id="copySingle">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>复制
                    </button>
                </div>
                <div class="strategy-row" style="padding: 0; flex-direction: column; gap: 0.25rem;" id="fiveSingleContainer">
                </div>
            </div>
            
            <div class="aggregate-section" style="margin-top: 1.25rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                    <div class="aggregate-section-title" style="margin-bottom: 0;">【6+3 全路数蓝复式】(3注6元 · 012路100%全包)</div>
                    <button class="section-copy-btn" data-text-id="copy63">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>复制
                    </button>
                </div>
                <div class="strategy-row" style="padding: 0;">
                    <div class="strategy-balls" id="compound63Container" style="align-items: center;"></div>
                </div>
            </div>

            <div class="aggregate-section" style="margin-top: 1.25rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                    <div class="aggregate-section-title" style="margin-bottom: 0;">【6+4 蓝球围剿复式】(4注8元 · 全路数+冷热防守)</div>
                    <button class="section-copy-btn" data-text-id="copy64">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>复制
                    </button>
                </div>
                <div class="strategy-row" style="padding: 0;">
                    <div class="strategy-balls" id="compound64Container" style="align-items: center;"></div>
                </div>
            </div>

            <!-- 🟡 阵列二：技术进阶阵列 (14~20元黄金实战) -->
            <div class="tier-header" style="margin-top: 2rem;">
                <span class="tier-badge amber">🟡 阵列二</span>
                <span class="tier-title">技术进阶阵列 (14~20元黄金实战)</span>
                <span class="tier-desc">告别高胆死锁陷阱 · 兼顾红球扩充与高容错弹性</span>
            </div>

            <div class="aggregate-section">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                    <div class="aggregate-section-title" style="margin-bottom: 0;">【7+1 精品小复式】(7注14元 · 稳健扩充红球面)</div>
                    <button class="section-copy-btn" data-text-id="copy71">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>复制
                    </button>
                </div>
                <div class="strategy-row" style="padding: 0;">
                    <div class="strategy-balls" id="compound71Container" style="align-items: center;"></div>
                </div>
            </div>

            <div class="aggregate-section" style="margin-top: 1.25rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                    <div class="aggregate-section-title" style="margin-bottom: 0;">【3胆4拖2蓝】(8注16元 · 黄金实战胆拖)</div>
                    <button class="section-copy-btn" data-text-id="copy342">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>复制
                    </button>
                </div>
                <div class="strategy-row" style="padding: 0;">
                    <div class="strategy-balls" id="dantuo342BallsContainer" style="align-items: center;"></div>
                </div>
            </div>

            <div class="aggregate-section" style="margin-top: 1.25rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                    <div class="aggregate-section-title" style="margin-bottom: 0;">【2胆5拖2蓝】(10注20元 · 极高容错弹性组合)</div>
                    <button class="section-copy-btn" data-text-id="copy252">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>复制
                    </button>
                </div>
                <div class="strategy-row" style="padding: 0;">
                    <div class="strategy-balls" id="dantuo252BallsContainer" style="align-items: center;"></div>
                </div>
            </div>

            <!-- 🔴 阵列三：合买合围大底 (112元) -->
            <div class="tier-header" style="margin-top: 2rem;">
                <span class="tier-badge red">🔴 阵列三</span>
                <span class="tier-title">合买合围大底 (112元)</span>
                <span class="tier-desc">彩店合买/多人包号 · 覆盖核心出号趋势与大底</span>
            </div>

            <div class="aggregate-section">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                    <div class="aggregate-section-title" style="margin-bottom: 0;">【8+2 经济大复式】(56注112元 · 高度合围)</div>
                    <button class="section-copy-btn" data-text-id="copy82">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>复制
                    </button>
                </div>
                <div class="strategy-row" style="padding: 0;">
                    <div class="strategy-balls" id="compound82Container" style="align-items: center;"></div>
                </div>
            </div>
        </div>
    `;

    // 渲染 AI 战术指南
    const goldenDanContainer = aggregateCardEl.querySelector('#goldenDanContainer');
    if (goldenDanContainer) {
        aiTactics.goldenDan.forEach(num => {
            goldenDanContainer.appendChild(Components.createLotteryBall(num, 'red', 'md', actualReds.includes(num)));
        });
    }

    const killRedsContainer = aggregateCardEl.querySelector('#killRedsContainer');
    if (killRedsContainer) {
        aiTactics.killReds.forEach(num => {
            const span = document.createElement('span');
            span.className = 'kill-ball red';
            span.textContent = num;
            killRedsContainer.appendChild(span);
        });
    }

    const killBlueContainer = aggregateCardEl.querySelector('#killBlueContainer');
    if (killBlueContainer && aiTactics.killBlue) {
        const span = document.createElement('span');
        span.className = 'kill-ball blue';
        span.textContent = aiTactics.killBlue;
        killBlueContainer.appendChild(span);
    }

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

    // 渲染 6+3 蓝球复式
    const compound63Container = aggregateCardEl.querySelector('#compound63Container');
    compound6_3.reds.forEach(num => {
        compound63Container.appendChild(Components.createLotteryBall(num, 'red', 'md', actualReds.includes(num)));
    });
    compound63Container.appendChild(Components.createBallDivider());
    compound6_3.blues.forEach(num => {
        compound63Container.appendChild(Components.createLotteryBall(num, 'blue', 'md', actualBlue === num));
    });

    // 渲染 6+4 蓝球围剿复式
    const compound64Container = aggregateCardEl.querySelector('#compound64Container');
    compound6_4.reds.forEach(num => {
        compound64Container.appendChild(Components.createLotteryBall(num, 'red', 'md', actualReds.includes(num)));
    });
    compound64Container.appendChild(Components.createBallDivider());
    compound6_4.blues.forEach(num => {
        compound64Container.appendChild(Components.createLotteryBall(num, 'blue', 'md', actualBlue === num));
    });

    // 渲染 7+1 复式
    const compound71Container = aggregateCardEl.querySelector('#compound71Container');
    compound7_1.reds.forEach(num => {
        compound71Container.appendChild(Components.createLotteryBall(num, 'red', 'md', actualReds.includes(num)));
    });
    compound71Container.appendChild(Components.createBallDivider());
    compound7_1.blues.forEach(num => {
        compound71Container.appendChild(Components.createLotteryBall(num, 'blue', 'md', actualBlue === num));
    });

    // 渲染 3胆4拖2蓝
    const dantuo342Container = aggregateCardEl.querySelector('#dantuo342BallsContainer');
    const danLabel342 = document.createElement('span');
    danLabel342.className = 'ball-label red-label';
    danLabel342.textContent = '胆';
    dantuo342Container.appendChild(danLabel342);
    dantuo3_4_2.dan.forEach(num => {
        dantuo342Container.appendChild(Components.createLotteryBall(num, 'red', 'md', actualReds.includes(num)));
    });
    const tuoLabel342 = document.createElement('span');
    tuoLabel342.className = 'ball-label red-label';
    tuoLabel342.style.marginLeft = '0.5rem';
    tuoLabel342.textContent = '拖';
    dantuo342Container.appendChild(tuoLabel342);
    dantuo3_4_2.tuo.forEach(num => {
        dantuo342Container.appendChild(Components.createLotteryBall(num, 'red', 'md', actualReds.includes(num)));
    });
    const blueLabel342 = document.createElement('span');
    blueLabel342.className = 'ball-label blue-label';
    blueLabel342.style.marginLeft = '0.5rem';
    blueLabel342.textContent = '蓝';
    dantuo342Container.appendChild(blueLabel342);
    dantuo3_4_2.blues.forEach(num => {
        dantuo342Container.appendChild(Components.createLotteryBall(num, 'blue', 'md', actualBlue === num));
    });

    // 渲染 2胆5拖2蓝
    const dantuo252Container = aggregateCardEl.querySelector('#dantuo252BallsContainer');
    const danLabel252 = document.createElement('span');
    danLabel252.className = 'ball-label red-label';
    danLabel252.textContent = '胆';
    dantuo252Container.appendChild(danLabel252);
    dantuo2_5_2.dan.forEach(num => {
        dantuo252Container.appendChild(Components.createLotteryBall(num, 'red', 'md', actualReds.includes(num)));
    });
    const tuoLabel252 = document.createElement('span');
    tuoLabel252.className = 'ball-label red-label';
    tuoLabel252.style.marginLeft = '0.5rem';
    tuoLabel252.textContent = '拖';
    dantuo252Container.appendChild(tuoLabel252);
    dantuo2_5_2.tuo.forEach(num => {
        dantuo252Container.appendChild(Components.createLotteryBall(num, 'red', 'md', actualReds.includes(num)));
    });
    const blueLabel252 = document.createElement('span');
    blueLabel252.className = 'ball-label blue-label';
    blueLabel252.style.marginLeft = '0.5rem';
    blueLabel252.textContent = '蓝';
    dantuo252Container.appendChild(blueLabel252);
    dantuo2_5_2.blues.forEach(num => {
        dantuo252Container.appendChild(Components.createLotteryBall(num, 'blue', 'md', actualBlue === num));
    });

    // 渲染 8+2 复式
    const compound82Container = aggregateCardEl.querySelector('#compound82Container');
    compound8_2.reds.forEach(num => {
        compound82Container.appendChild(Components.createLotteryBall(num, 'red', 'md', actualReds.includes(num)));
    });
    compound82Container.appendChild(Components.createBallDivider());
    compound8_2.blues.forEach(num => {
        compound82Container.appendChild(Components.createLotteryBall(num, 'blue', 'md', actualBlue === num));
    });

    // 绑定复制按钮事件
    const copyBtn = aggregateCardEl.querySelector('#copyAggregateBtn');
    copyBtn.addEventListener('click', () => {
        copyTextToClipboard(copyText).then(() => {
            toggleCopyButton(copyBtn);
        }).catch(err => {
            console.error('复制失败:', err);
            alert('复制失败，请手动选择号码复制');
        });
    });

    // 绑定分项复制按钮事件
    const copyTexts = {
        'copyTactics': copyTextTactics.trim(),
        'copySingle': copyTextSingle.trim(),
        'copy63': copyText63.trim(),
        'copy64': copyText64.trim(),
        'copy71': copyText71.trim(),
        'copy342': copyText342.trim(),
        'copy252': copyText252.trim(),
        'copy82': copyText82.trim()
    };
    aggregateCardEl.querySelectorAll('.section-copy-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const copyId = btn.getAttribute('data-text-id');
            const textToCopy = copyTexts[copyId];
            copyTextToClipboard(textToCopy).then(() => {
                toggleCopyButton(btn);
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

    if (chartInstances['accuracyChart']) {
        chartInstances['accuracyChart'].destroy();
    }

    // 准备图表数据
    const chartData = prepareChartData();

    // 使用Chart.js渲染
    chartInstances['accuracyChart'] = new Chart(chartEl, {
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
        'MetaAI 超级裁判': '#ec4899',
        'MetaAI': '#ec4899',
        'GPT-5': '#10b981',
        'GPT 120B': '#10b981',
        'Claude 4.5': '#8b5cf6',
        'Claude Sonnet': '#8b5cf6',
        'Claude Opus': '#a855f7',
        'Gemini 2.5': '#3b82f6',
        'Gemini 3.1 Pro': '#3b82f6',
        'Gemini 3.8 Flash': '#06b6d4',
        'Grok 4.3': '#e11d48',
        'DeepSeek R1': '#f59e0b',
        'Deep Learning Prediction Model': '#f59e0b'
    };

    const modelKeys = Object.keys(modelsData);
    // 确保 MetaAI 在前面
    modelKeys.sort((a, b) => {
        const isMetaA = a.includes('MetaAI') || a.includes('超级裁判');
        const isMetaB = b.includes('MetaAI') || b.includes('超级裁判');
        if (isMetaA && !isMetaB) return -1;
        if (!isMetaA && isMetaB) return 1;
        return 0;
    });

    const datasets = modelKeys.map(modelName => {
        const isMeta = modelName.includes('MetaAI') || modelName.includes('超级裁判');
        const color = colors[modelName] || (isMeta ? '#ec4899' : '#6b7280');
        return {
            label: modelName,
            data: modelsData[modelName],
            borderColor: color,
            backgroundColor: color,
            borderWidth: isMeta ? 4 : 3,
            pointRadius: isMeta ? 6 : 4,
            pointHoverRadius: isMeta ? 8 : 7,
            tension: 0.1,
            order: isMeta ? 0 : 1
        };
    });

    return { labels, datasets };
}

// 历史回溯展示条数控制
let accuracyDisplayLimit = 10;

// 渲染准确度卡片
function renderAccuracyCards() {
    if (!appData.predictionsHistory) return;

    const containerEl = document.getElementById('accuracyCardsContainer');
    if (!containerEl) return;

    // 清空现有内容
    containerEl.innerHTML = '';

    const records = appData.predictionsHistory.predictions_history || [];
    const visibleRecords = records.slice(0, accuracyDisplayLimit);

    // 渲染可视记录 (每个卡片独立容错，杜绝单卡片数据缺失导致整页空白)
    visibleRecords.forEach((record, index) => {
        try {
            const card = Components.createAccuracyCard(record, index);
            if (card) {
                containerEl.appendChild(card);
            }
        } catch (err) {
            console.warn(`渲染第 ${index} 项历史回溯卡片时发生警告:`, err);
        }
    });

    // 如果还有更多记录，添加“加载更多”按钮
    if (records.length > accuracyDisplayLimit) {
        const loadMoreBox = document.createElement('div');
        loadMoreBox.style.display = 'flex';
        loadMoreBox.style.justifyContent = 'center';
        loadMoreBox.style.margin = '1.5rem 0';

        const loadMoreBtn = document.createElement('button');
        loadMoreBtn.className = 'btn-load-more';
        loadMoreBtn.style.padding = '0.65rem 1.75rem';
        loadMoreBtn.style.borderRadius = '9999px';
        loadMoreBtn.style.border = '1px solid var(--slate-300)';
        loadMoreBtn.style.background = 'white';
        loadMoreBtn.style.color = 'var(--slate-700)';
        loadMoreBtn.style.fontWeight = '600';
        loadMoreBtn.style.fontSize = '0.875rem';
        loadMoreBtn.style.cursor = 'pointer';
        loadMoreBtn.style.boxShadow = '0 2px 4px rgba(0,0,0,0.04)';
        loadMoreBtn.style.transition = 'all 0.2s ease';
        loadMoreBtn.textContent = `查看更多历史回溯 (已显示 ${visibleRecords.length} / ${records.length} 期)`;

        loadMoreBtn.addEventListener('mouseenter', () => {
            loadMoreBtn.style.background = 'var(--slate-50)';
            loadMoreBtn.style.borderColor = 'var(--slate-400)';
        });
        loadMoreBtn.addEventListener('mouseleave', () => {
            loadMoreBtn.style.background = 'white';
            loadMoreBtn.style.borderColor = 'var(--slate-300)';
        });

        loadMoreBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            accuracyDisplayLimit += 15;
            renderAccuracyCards();
        });

        loadMoreBox.appendChild(loadMoreBtn);
        containerEl.appendChild(loadMoreBox);
    }
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

// 计算红球跨度与 AC 值
function calculateSpanAndAC(redBalls) {
    const nums = redBalls.map(Number).sort((a, b) => a - b);
    const span = nums[nums.length - 1] - nums[0];
    
    // AC 值（数字复杂度）：所有正差值不重复个数 - (r - 1)
    const diffs = new Set();
    for (let i = 0; i < nums.length; i++) {
        for (let j = i + 1; j < nums.length; j++) {
            diffs.add(nums[j] - nums[i]);
        }
    }
    const ac = Math.max(0, diffs.size - (nums.length - 1));
    return { span, ac };
}

// 计算红球三态：重号、邻号、连号
function calculateRedPatterns(currentReds, prevReds) {
    const cur = currentReds.map(Number).sort((a, b) => a - b);
    
    // 连码组数 (如 13-14)
    let consecutivePairs = 0;
    for (let i = 0; i < cur.length - 1; i++) {
        if (cur[i + 1] - cur[i] === 1) {
            consecutivePairs++;
        }
    }

    if (!prevReds || prevReds.length === 0) {
        return { repeatCount: 0, neighborCount: 0, consecutivePairs };
    }

    const prev = prevReds.map(Number);
    // 重号：同时存在于本期和上期
    const repeatCount = cur.filter(n => prev.includes(n)).length;

    // 邻号/斜连号：在本期出号中，非重号但等于上期某个号码 ±1
    const neighborCount = cur.filter(n => !prev.includes(n) && prev.some(p => Math.abs(p - n) === 1)).length;

    return { repeatCount, neighborCount, consecutivePairs };
}

// 当前图表分类与形态指标
let currentChartCategory = 'all';
let currentSumMetric = 'sum'; // 'sum' | 'span' | 'ac'

function filterChartCategory(cat) {
    currentChartCategory = cat;
    const btns = document.querySelectorAll('.chart-cat-btn');
    btns.forEach(btn => {
        if (btn.dataset.cat === cat) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    const containers = document.querySelectorAll('.analysis-charts-grid .chart-container');
    containers.forEach(box => {
        const itemCat = box.dataset.category;
        if (cat === 'all' || itemCat === cat) {
            box.style.display = '';
        } else {
            box.style.display = 'none';
        }
    });
}
window.filterChartCategory = filterChartCategory;

function setSumMetric(metric) {
    currentSumMetric = metric;
    ['btnMetricSum', 'btnMetricSpan', 'btnMetricAC'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.classList.remove('active');
    });
    if (metric === 'sum') document.getElementById('btnMetricSum')?.classList.add('active');
    else if (metric === 'span') document.getElementById('btnMetricSpan')?.classList.add('active');
    else if (metric === 'ac') document.getElementById('btnMetricAC')?.classList.add('active');

    renderSumTrendChart();
}
window.setSumMetric = setSumMetric;

// 渲染蓝球期号动态走势与振幅追踪图表
function renderBlueTrendChart() {
    let recentDraws = getFilteredLotteryData();
    if (recentDraws.length === 0) return;
    const chartEl = document.getElementById('blueTrendChart');
    if (!chartEl) return;

    if (chartInstances['blueTrendChart']) chartInstances['blueTrendChart'].destroy();

    recentDraws = [...recentDraws].reverse();
    const labels = recentDraws.map(d => d.period);
    const blueNums = recentDraws.map(d => parseInt(d.blue_ball, 10));

    // 计算相邻期位移振幅
    const amplitudes = [0];
    for (let i = 1; i < blueNums.length; i++) {
        amplitudes.push(Math.abs(blueNums[i] - blueNums[i - 1]));
    }

    chartInstances['blueTrendChart'] = new Chart(chartEl, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    type: 'line',
                    label: '开奖蓝球',
                    data: blueNums,
                    borderColor: '#2563eb',
                    backgroundColor: 'rgba(37, 99, 235, 0.08)',
                    borderWidth: 2.5,
                    pointBackgroundColor: blueNums.map(n => n > 8 ? '#dc2626' : '#2563eb'),
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 1.5,
                    pointRadius: 4.5,
                    pointHoverRadius: 7,
                    tension: 0.25,
                    fill: false,
                    yAxisID: 'y'
                },
                {
                    type: 'bar',
                    label: '位移振幅',
                    data: amplitudes,
                    backgroundColor: 'rgba(139, 92, 246, 0.35)',
                    hoverBackgroundColor: 'rgba(139, 92, 246, 0.75)',
                    borderRadius: 3,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                tooltip: {
                    backgroundColor: 'rgba(15,23,42,0.92)',
                    padding: 10,
                    callbacks: {
                        label: function(ctx) {
                            if (ctx.dataset.type === 'line') {
                                const val = ctx.raw;
                                const size = val > 8 ? '大号(09-16)' : '小号(01-08)';
                                const road = `${val % 3}路`;
                                const oe = val % 2 === 1 ? '单' : '双';
                                return `蓝球: ${val.toString().padStart(2, '0')} (${size} · ${oe} · ${road})`;
                            } else {
                                return `振幅位移: ${ctx.raw}`;
                            }
                        }
                    }
                }
            },
            scales: {
                y: {
                    type: 'linear',
                    position: 'left',
                    min: 1,
                    max: 16,
                    ticks: {
                        stepSize: 2,
                        callback: v => `${v}号`
                    },
                    grid: {
                        color: 'rgba(226, 232, 240, 0.6)'
                    }
                },
                y1: {
                    type: 'linear',
                    position: 'right',
                    min: 0,
                    max: 15,
                    grid: {
                        display: false
                    },
                    ticks: {
                        stepSize: 3,
                        callback: v => `±${v}`
                    }
                }
            }
        }
    });
}

// 渲染红球三态走势图表（重号 · 邻号 · 连号）
function renderRedPatternsChart() {
    let recentDraws = getFilteredLotteryData();
    if (recentDraws.length === 0) return;
    const chartEl = document.getElementById('redPatternsChart');
    if (!chartEl) return;

    if (chartInstances['redPatternsChart']) chartInstances['redPatternsChart'].destroy();

    recentDraws = [...recentDraws].reverse();
    const labels = recentDraws.map(d => d.period);
    
    const repeatData = [];
    const neighborData = [];
    const consecutiveData = [];

    for (let i = 0; i < recentDraws.length; i++) {
        const curReds = recentDraws[i].red_balls;
        const prevReds = i > 0 ? recentDraws[i - 1].red_balls : null;
        const p = calculateRedPatterns(curReds, prevReds);
        repeatData.push(p.repeatCount);
        neighborData.push(p.neighborCount);
        consecutiveData.push(p.consecutivePairs);
    }

    chartInstances['redPatternsChart'] = new Chart(chartEl, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: '重号(传号)',
                    data: repeatData,
                    backgroundColor: 'rgba(239, 68, 68, 0.75)',
                    borderRadius: 4
                },
                {
                    type: 'line',
                    label: '邻号(斜连)',
                    data: neighborData,
                    borderColor: '#3b82f6',
                    backgroundColor: '#3b82f6',
                    pointBackgroundColor: '#3b82f6',
                    pointRadius: 3,
                    borderWidth: 2,
                    tension: 0.2
                },
                {
                    label: '连码组数',
                    data: consecutiveData,
                    backgroundColor: 'rgba(16, 185, 129, 0.75)',
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                tooltip: {
                    backgroundColor: 'rgba(15,23,42,0.92)',
                    padding: 10
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { stepSize: 1 },
                    title: { display: true, text: '个数 / 组数' }
                }
            }
        }
    });
}

// 渲染和值/跨度/AC值综合走势图表
function renderSumTrendChart() {
    let recentDraws = getFilteredLotteryData();
    if (recentDraws.length === 0) return;
    const chartEl = document.getElementById('sumTrendChart');
    if (!chartEl) return;

    if (chartInstances['sumTrendChart']) chartInstances['sumTrendChart'].destroy();

    recentDraws = [...recentDraws].reverse();
    const labels = recentDraws.map(draw => draw.period);

    let values, avgValue, metricLabel, lineColor, bgColor, titleText, descText;

    if (currentSumMetric === 'span') {
        values = recentDraws.map(draw => {
            const { span } = calculateSpanAndAC(draw.red_balls);
            return span;
        });
        avgValue = values.reduce((a, b) => a + b, 0) / values.length;
        metricLabel = '红球跨度 (Span)';
        lineColor = '#0d9488';
        bgColor = 'rgba(13, 148, 136, 0.1)';
        titleText = '红球跨度走势（Max - Min）';
        descText = '跨度衡量首尾距离，黄金正常区间为 20~30，统计均值约 25';
    } else if (currentSumMetric === 'ac') {
        values = recentDraws.map(draw => {
            const { ac } = calculateSpanAndAC(draw.red_balls);
            return ac;
        });
        avgValue = values.reduce((a, b) => a + b, 0) / values.length;
        metricLabel = '红球 AC 值 (数字复杂度)';
        lineColor = '#8b5cf6';
        bgColor = 'rgba(139, 92, 246, 0.1)';
        titleText = '红球 AC 值（复杂度）走势';
        descText = 'AC值衡量离散随机度，黄金区间为 7~11（过低说明等差分布明显）';
    } else {
        values = recentDraws.map(draw => draw.red_balls.reduce((acc, ball) => acc + parseInt(ball, 10), 0));
        avgValue = values.reduce((a, b) => a + b, 0) / values.length;
        metricLabel = '红球和值 (Sum)';
        lineColor = '#eab308';
        bgColor = 'rgba(234, 179, 8, 0.1)';
        titleText = '红球和值走势（带均线参考）';
        descText = '近期红球总和变化趋势（理论均值约 102，常见区间 90~120）';
    }

    const titleEl = document.getElementById('sumMetricTitle');
    if (titleEl) titleEl.textContent = titleText;
    const descEl = document.getElementById('sumMetricDesc');
    if (descEl) descEl.textContent = descText;

    chartInstances['sumTrendChart'] = new Chart(chartEl, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: metricLabel,
                data: values,
                borderColor: lineColor,
                backgroundColor: bgColor,
                borderWidth: 2,
                pointBackgroundColor: lineColor,
                pointRadius: 3,
                fill: true,
                tension: 0.3
            }, {
                label: `平均值 (${avgValue.toFixed(1)})`,
                data: Array(labels.length).fill(avgValue),
                borderColor: '#94a3b8',
                borderWidth: 1.5,
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

// 渲染 012 路数论平衡走势图表
function renderRoad012Chart() {
    let recentDraws = getFilteredLotteryData();
    if (recentDraws.length === 0) return;
    const chartEl = document.getElementById('road012Chart');
    if (!chartEl) return;

    if (chartInstances['road012Chart']) chartInstances['road012Chart'].destroy();

    recentDraws = [...recentDraws].reverse();
    const labels = recentDraws.map(draw => draw.period);

    const road0 = [];
    const road1 = [];
    const road2 = [];

    recentDraws.forEach(draw => {
        const nums = draw.red_balls.map(Number);
        road0.push(nums.filter(n => n % 3 === 0).length);
        road1.push(nums.filter(n => n % 3 === 1).length);
        road2.push(nums.filter(n => n % 3 === 2).length);
    });

    chartInstances['road012Chart'] = new Chart(chartEl, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: '0路 (余0)',
                    data: road0,
                    backgroundColor: '#f59e0b',
                    stack: 'road'
                },
                {
                    label: '1路 (余1)',
                    data: road1,
                    backgroundColor: '#3b82f6',
                    stack: 'road'
                },
                {
                    label: '2路 (余2)',
                    data: road2,
                    backgroundColor: '#10b981',
                    stack: 'road'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { stacked: true },
                y: {
                    stacked: true,
                    min: 0,
                    max: 6,
                    ticks: { stepSize: 1 }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        footer: function(items) {
                            const r0 = items.find(i => i.datasetIndex === 0)?.raw || 0;
                            const r1 = items.find(i => i.datasetIndex === 1)?.raw || 0;
                            const r2 = items.find(i => i.datasetIndex === 2)?.raw || 0;
                            return `012路比: ${r0}:${r1}:${r2}`;
                        }
                    }
                }
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
            const num = parseInt(ball, 10);
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

// 渲染频率 vs 遗漏散点图
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

    // 散点颜色映射
    function dotColor(x, y) {
        const heatRatio = x / maxFreq;
        const coldRatio = y / maxOmission;
        if (coldRatio > 0.6) return 'rgba(124,58,237,0.85)';  // 极冷号 - 紫色预警
        if (heatRatio > 0.7) return 'rgba(220,38,38,0.85)';   // 极热号 - 红色
        return 'rgba(100,116,139,0.6)';                         // 常态 - 灰色
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

// 渲染所有分析图表
function renderAllAnalysisCharts() {
    renderStatisticsCards();
    renderOmissionPanel();
    renderFrequencyChart();
    renderBlueFrequencyChart();
    renderBlueTrendChart();
    renderRedPatternsChart();
    renderSumTrendChart();
    renderRoad012Chart();
    renderOddEvenChart();
    renderZoneDistributionChart();
    renderScatterChart();

    // 维持当前分类过滤状态
    if (typeof filterChartCategory === 'function') {
        filterChartCategory(currentChartCategory);
    }
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
    
    // Tab切换 - 桌面端 (严格限定在顶部导航栏内，避免捕获页面内部其他按钮)
    const navItems = document.querySelectorAll('.header-nav .nav-item, nav .nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            if (item.dataset && item.dataset.tab) {
                handleTabSwitch(item.dataset.tab, navItems);
            }
        });
    });

    // Tab切换 - 移动端
    const mobileNavItems = document.querySelectorAll('.mobile-nav-item');
    mobileNavItems.forEach(item => {
        item.addEventListener('click', () => {
            if (item.dataset && item.dataset.tab) {
                handleTabSwitch(item.dataset.tab, mobileNavItems);
            }
        });
    });
}

// 处理Tab切换
function handleTabSwitch(tabName, navItems) {
    if (!tabName) return; // 容错保护：无指定tab时不进行切换，防止清空所有激活容器导致白屏

    // 更新导航项状态
    if (navItems) {
        navItems.forEach(item => {
            if (item.dataset.tab === tabName) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    }

    // 同步桌面端和移动端状态
    const allNavItems = document.querySelectorAll('.header-nav .nav-item, nav .nav-item, .mobile-nav-item');
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

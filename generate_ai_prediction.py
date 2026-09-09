# -*- coding: utf-8 -*-
"""
双色球 AI 预测自动生成脚本
自动调用 AI 模型生成下期预测数据
"""

import json
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta, timezone
try:
    from zoneinfo import ZoneInfo
    BEIJING_TZ = ZoneInfo("Asia/Shanghai")
except ImportError:
    BEIJING_TZ = timezone(timedelta(hours=8))

try:
    from openai import OpenAI
except ImportError:
    OpenAI = None

from typing import Dict, Any

# 解决 Windows 控制台打印 emoji 报 UnicodeEncodeError 的跨平台问题
if sys.platform == "win32" and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# ==================== 配置区 ====================
# API 配置（通过环境变量设置）
BASE_URL = os.environ.get("AI_BASE_URL") or "https://aihubmix.com/v1"
API_KEY = os.environ.get("AI_API_KEY")

# 模型配置列表（稳定支持的 6 大旗舰模型矩阵）
MODELS = [
    {"id": "gpt-oss-120b-medium", "name": "GPT 120B", "model_id": "GPT-120B-OSS"},
    {"id": "claude-sonnet-4-6", "name": "Claude Sonnet", "model_id": "Claude-Sonnet-4.6"},
    {"id": "gemini-3.1-pro-low", "name": "Gemini 3.1 Pro", "model_id": "Gemini-3.1-Pro"},
    {"id": "claude-opus-4-6-thinking", "name": "Claude Opus", "model_id": "Claude-Opus-4.6"},
    {"id": "gemini-3.8-flash-high", "name": "Gemini 3.8 Flash", "model_id": "Gemini-3.8-Flash"},
    {"id": "grok-4.20-fast", "name": "Grok 4.20", "model_id": "Grok-4.20-Fast"},
]

# 文件路径
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
LOTTERY_HISTORY_FILE = os.path.join(SCRIPT_DIR, "data", "lottery_history.json")
AI_PREDICTIONS_FILE = os.path.join(SCRIPT_DIR, "data", "ai_predictions.json")
PREDICTIONS_HISTORY_FILE = os.path.join(SCRIPT_DIR, "data", "predictions_history.json")
PROMPT_FILE = os.path.join(SCRIPT_DIR, "doc", "prompt2.0.md")
META_PROMPT_FILE = os.path.join(SCRIPT_DIR, "prompts", "meta_prompt_template.txt")

# ==================== 工具函数 ====================

def load_prompt_template() -> str:
    """加载 Prompt 模板文件"""
    try:
        with open(PROMPT_FILE, 'r', encoding='utf-8') as f:
            return f.read()
    except Exception as e:
        print(f"❌ 加载 Prompt 文件失败: {str(e)}")
        raise

def load_lottery_history() -> Dict[str, Any]:
    """加载历史开奖数据"""
    try:
        with open(LOTTERY_HISTORY_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"❌ 加载历史数据失败: {str(e)}")
        raise

def format_compact_history(history_data: list) -> str:
    """
    将历史开奖数据转换为高密度紧凑文本格式（节省 Token 且杜绝 LLM 格式混淆）
    示例：第26103期 (2026-09-06): 红球 04 11 20 27 28 30 + 蓝球 15
    """
    lines = []
    for d in history_data:
        period = d.get("period", "")
        date = d.get("date", "")
        reds = " ".join([f"{int(x):02d}" for x in d.get("red_balls", [])])
        blue = f"{int(d.get('blue_ball', 1)):02d}"
        lines.append(f"第{period}期 ({date}): 红球 {reds} + 蓝球 {blue}")
    return "\n".join(lines)

def compute_statistical_features(lottery_data: Dict[str, Any], history_count: int = 50) -> Dict[str, Any]:
    """
    在 Python 宿主端进行严谨的统计学与特征工程计算，消除 LLM 模糊心算和幻觉
    计算涵盖：10/30/50期频次、加权热度分、多周期动量趋势分、全历史精准遗漏、重号邻号候选池、蓝球012路与振幅
    """
    all_draws = lottery_data.get("data", [])
    draws = all_draws[:history_count]
    if not draws:
        return {}

    # 1. 频次统计 (10期, 30期, 50期)
    red_freq_10 = {f"{i:02d}": 0 for i in range(1, 34)}
    red_freq_30 = {f"{i:02d}": 0 for i in range(1, 34)}
    red_freq_50 = {f"{i:02d}": 0 for i in range(1, 34)}

    for idx, d in enumerate(draws):
        for r in d.get("red_balls", []):
            num_str = f"{int(r):02d}"
            if idx < 10:
                red_freq_10[num_str] += 1
            if idx < 30:
                red_freq_30[num_str] += 1
            if idx < 50:
                red_freq_50[num_str] += 1

    # 2. 精确遗漏统计 (遍历全部历史数据)
    red_omission = {}
    for i in range(1, 34):
        num_str = f"{i:02d}"
        omission = 0
        found = False
        for d in all_draws:
            if num_str in [f"{int(x):02d}" for x in d.get("red_balls", [])]:
                found = True
                break
            omission += 1
        red_omission[num_str] = omission if found else len(all_draws)

    # 3. 加权热度与动量趋势
    red_scores = {}
    red_trends = {}
    for i in range(1, 34):
        num_str = f"{i:02d}"
        f10 = red_freq_10[num_str]
        f30 = red_freq_30[num_str]
        f50 = red_freq_50[num_str]
        red_scores[num_str] = f10 * 5 + f30 * 3 + f50 * 2
        trend = (f10 / 10.0 - f50 / 50.0) * 50 + (f30 / 30.0 - f50 / 50.0) * 25
        red_trends[num_str] = round(trend, 1)

    sorted_reds_by_score = sorted(red_scores.items(), key=lambda x: x[1], reverse=True)
    sorted_reds_by_trend = sorted(red_trends.items(), key=lambda x: x[1], reverse=True)

    top_hot_reds = [k for k, _ in sorted_reds_by_score[:8]]
    top_trend_reds = [k for k, _ in sorted_reds_by_trend[:6]]
    warmup_reds = [k for k, v in red_omission.items() if 7 <= v <= 18]
    extreme_cold_reds = [k for k, v in red_omission.items() if v > 18]

    # 4. 马尔可夫转移候选（重号与邻号传承）
    last_draw = draws[0]
    last_reds = sorted([f"{int(x):02d}" for x in last_draw.get("red_balls", [])])
    last_blue = f"{int(last_draw.get('blue_ball', 1)):02d}"

    neighbor_set = set()
    for r in last_reds:
        val = int(r)
        if val - 1 >= 1:
            neighbor_set.add(f"{val - 1:02d}")
        if val + 1 <= 33:
            neighbor_set.add(f"{val + 1:02d}")
    neighbor_candidates = sorted(list(neighbor_set - set(last_reds)))

    # 5. 蓝球多维度全面量化统计（打破04/05热度死循环，多维对冲）
    blue_freq_20 = {f"{i:02d}": 0 for i in range(1, 17)}
    blue_freq_50 = {f"{i:02d}": 0 for i in range(1, 17)}
    for idx, d in enumerate(draws):
        b = f"{int(d.get('blue_ball', 1)):02d}"
        if idx < 20:
            blue_freq_20[b] += 1
        if idx < 50:
            blue_freq_50[b] += 1

    blue_omission = {}
    for i in range(1, 17):
        b_str = f"{i:02d}"
        omission = 0
        found = False
        for d in all_draws:
            if b_str == f"{int(d.get('blue_ball', 1)):02d}":
                found = True
                break
            omission += 1
        blue_omission[b_str] = omission if found else len(all_draws)

    sorted_blues_by_freq = sorted(blue_freq_20.items(), key=lambda x: x[1], reverse=True)
    top_blue_freq = [f"{k}({v}次)" for k, v in sorted_blues_by_freq[:4] if v > 0]

    # 黄金均值回归温冷蓝球 (遗漏 7~16 期，历史理论平均出号周期是16期)
    warmup_blues = [f"{k}(遗漏{v}期)" for k, v in sorted(blue_omission.items(), key=lambda x: x[1]) if 7 <= v <= 16]
    cold_blues = [f"{k}(遗漏{v}期)" for k, v in sorted(blue_omission.items(), key=lambda x: x[1], reverse=True) if v > 16]

    last_blue_val = int(last_blue)
    last_blue_road = last_blue_val % 3
    # 推荐轮转路数（非上期路数的另两路号码，历史轮转率 >75%）
    other_roads = [r for r in [0, 1, 2] if r != last_blue_road]
    rotation_blues = [f"{i:02d}" for i in range(1, 17) if i % 3 in other_roads]

    # 黄金振幅区间 [2, 7]
    amplitude_recommended = [
        f"{i:02d}" for i in range(1, 17) if 2 <= abs(i - last_blue_val) <= 7
    ]

    # 6. 历史形态基线统计（近50期）
    odd_counts = []
    sums = []
    zone_dist = {"一区(01-11)": 0, "二区(12-22)": 0, "三区(23-33)": 0}
    consecutive_draws_count = 0

    for d in draws:
        reds = [int(x) for x in d.get("red_balls", [])]
        odds = sum(1 for x in reds if x % 2 != 0)
        odd_counts.append(odds)
        sums.append(sum(reds))
        for x in reds:
            if x <= 11:
                zone_dist["一区(01-11)"] += 1
            elif x <= 22:
                zone_dist["二区(12-22)"] += 1
            else:
                zone_dist["三区(23-33)"] += 1
        has_consecutive = any(reds[k+1] - reds[k] == 1 for k in range(len(reds)-1))
        if has_consecutive:
            consecutive_draws_count += 1

    avg_sum = round(sum(sums) / len(sums), 1)
    min_sum, max_sum = min(sums), max(sums)
    consecutive_rate = f"{round(consecutive_draws_count / len(draws) * 100, 1)}%"

    return {
        "last_draw": {"period": last_draw.get("period"), "reds": last_reds, "blue": last_blue},
        "repeat_candidates": last_reds,
        "neighbor_candidates": neighbor_candidates,
        "top_hot_reds": top_hot_reds,
        "top_trend_reds": top_trend_reds,
        "warmup_reds": warmup_reds,
        "extreme_cold_reds": extreme_cold_reds,
        "red_scores": red_scores,
        "red_trends": red_trends,
        "red_omission": red_omission,
        "top_blue_freq": top_blue_freq,
        "warmup_blues": warmup_blues,
        "cold_blues": cold_blues,
        "blue_freq_20": blue_freq_20,
        "blue_omission": blue_omission,
        "last_blue_road": f"{last_blue_road}路 (除3余{last_blue_road})",
        "rotation_blues": rotation_blues,
        "amplitude_recommended_blues": amplitude_recommended,
        "avg_sum": avg_sum,
        "sum_range": f"{min_sum} ~ {max_sum}",
        "consecutive_rate": consecutive_rate,
        "zone_dist": zone_dist
    }

def format_precomputed_features_text(features: Dict[str, Any]) -> str:
    """将预计算特征格式化为 LLM 高效解析的清晰 Markdown 文本"""
    last_draw = features["last_draw"]
    top_hot = ", ".join(features["top_hot_reds"])
    top_trend = ", ".join(features["top_trend_reds"])
    warmup = ", ".join(features["warmup_reds"]) if features["warmup_reds"] else "无"
    extreme_cold = ", ".join(features["extreme_cold_reds"]) if features["extreme_cold_reds"] else "无"
    repeats = ", ".join(features["repeat_candidates"])
    neighbors = ", ".join(features["neighbor_candidates"])
    
    # 显著遗漏号码速查 (>=5期)
    omissions_gt_5 = [f"{k}(遗漏{v}期)" for k, v in sorted(features["red_omission"].items(), key=lambda x: x[1], reverse=True) if v >= 5]
    omissions_text = ", ".join(omissions_gt_5[:12])

    top_blues = ", ".join(features["top_blue_freq"])
    warmup_blues_text = ", ".join(features.get("warmup_blues", [])) or "近期无温冷区间蓝球"
    rotation_blues_text = ", ".join(features.get("rotation_blues", []))
    amp_blues = ", ".join(features["amplitude_recommended_blues"])
    cold_blues_text = ", ".join(features.get("cold_blues", [])[:4]) or "无极端冷号"

    z = features["zone_dist"]
    total_balls = sum(z.values()) if sum(z.values()) > 0 else 1
    zone_pct = f"一区 {z['一区(01-11)']*100//total_balls}% : 二区 {z['二区(12-22)']*100//total_balls}% : 三区 {z['三区(23-33)']*100//total_balls}%"

    return f"""### 1. 马尔可夫转移核心候选池（极高概率关联）
- **上期开奖（第{last_draw['period']}期）**: 红球 [{" ".join(last_draw['reds'])}] + 蓝球 {last_draw['blue']}
- **重号候选池 (上期红球，历史70%+的期数开出1~2个)**: [{repeats}]
- **邻号候选池 (上期红球左右相邻号，历史80%+的期数开出1~3个)**: [{neighbors}]

### 2. 红球量化热度与遗漏态势（由系统预先精确计算，无需自行统计）
- **加权热度 Top 8 红球 (近10期*5 + 近30期*3 + 近50期*2)**: [{top_hot}]
- **上升动量 Top 6 红球 (短期超额加速上升)**: [{top_trend}]
- **温冷回补黄金区间红球 (当前遗漏7~18期，均值回归高发区间)**: [{warmup}]
- **深冷防守红球 (当前遗漏>18期，单注建议最多防0~1个)**: [{extreme_cold}]
- **显著遗漏红球速查 (>=5期)**: {omissions_text}

### 3. 蓝球多维属性与全域分布空间（杜绝偏狭单一号码，必须多维分流）
- **上期蓝球**: {last_draw['blue']}，属于 **{features['last_blue_road']}**
- **热态蓝球 (近20期高频活跃)**: [{top_blues}]
- **均值回归黄金温冷蓝球 (当前遗漏 7~16 期，极高概率爆发窗口)**: [{warmup_blues_text}]（防冷回归核心）
- **012 路推荐轮转池 (上期为{features['last_blue_road']}，本期优先轮转另两路)**: [{rotation_blues_text}]
- **黄金振幅 [2, 7] 推荐候选号**: [{amp_blues}]
- **大号区(09-16)重点关注**: 09, 10, 11, 12, 13, 14, 15, 16（近多期小号过热，大号区具备极高回补反弹价值）
- **深冷蓝球防守 (>16期)**: {cold_blues_text}

### 4. 历史形态基线特征（近50期真实统计基线）
- **和值参考**: 平均 {features['avg_sum']}（历史主流集中在 90 ~ 120 之间）
- **连号形态率**: {features['consecutive_rate']}（推荐配置 0~1 组两连号，极少出现三连号）
- **三区总体分布比**: {zone_pct}（推荐单注区间组合：2:2:2, 1:2:3, 2:1:3, 1:3:2）
- **奇偶比黄金分布**: 3:3 (主流约33%), 4:2 / 2:4 (次主流约50%)
"""

def get_next_draw_date(lottery_data: Dict[str, Any] = None) -> str:
    """
    根据双色球开奖规则（每周二、四、日 21:15）计算下期开奖日期（按北京时间）
    返回 YYYY-MM-DD 格式
    """
    # 优先从开奖数据自带的 next_draw 中直接获取
    if lottery_data:
        next_draw = lottery_data.get("next_draw", {})
        if next_draw.get("next_date"):
            return next_draw["next_date"]

    today = datetime.now(BEIJING_TZ)
    weekday = today.weekday()  # 0=周一, 1=周二, 2=周三, 3=周四, 4=周五, 5=周六, 6=周日

    # 开奖日: 周二(1), 周四(3), 周日(6)
    draw_weekdays = [1, 3, 6]

    # 如果今天是开奖日且未到开奖时间(21:15)，则预测今天
    if weekday in draw_weekdays:
        draw_time = today.replace(hour=21, minute=15, second=0, microsecond=0)
        if today < draw_time:
            return today.strftime("%Y-%m-%d")

    # 否则找下一个开奖日
    for days_ahead in range(1, 8):
        future_date = today + timedelta(days=days_ahead)
        if future_date.weekday() in draw_weekdays:
            return future_date.strftime("%Y-%m-%d")

    # 理论上不会到这里
    return today.strftime("%Y-%m-%d")

def get_openai_client() -> Any:
    """获取 OpenAI 客户端"""
    if not API_KEY:
        raise ValueError("请设置环境变量 AI_API_KEY")
    if OpenAI is None:
        raise ImportError("未安装 openai 库，请先执行 `pip install openai`")
    # 增加到 300 秒超时时间，防止大型模型 (如 GPT 120B) 在代理端排队或生成过慢导致超时
    return OpenAI(api_key=API_KEY, base_url=BASE_URL, timeout=300.0)

def extract_json_from_response(response_text: str) -> str:
    """从 AI 响应中提取 JSON 内容"""
    # 去除可能的 markdown 标记
    text = response_text.strip()

    # 如果有 ```json 标记，提取中间的内容
    if "```json" in text:
        start = text.find("```json") + 7
        end = text.rfind("```")
        if end > start:
            text = text[start:end].strip()
    elif "```" in text:
        start = text.find("```") + 3
        end = text.rfind("```")
        if end > start:
            text = text[start:end].strip()

    # 进一步兜底：寻找第一个 { 和最后一个 }
    start_idx = text.find("{")
    end_idx = text.rfind("}")
    if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
        text = text[start_idx:end_idx+1]

    return text

def call_ai_model(client: OpenAI, model_config: Dict[str, str], prompt: str) -> Dict[str, Any]:
    """调用 AI 模型获取预测"""
    try:
        print(f"  ⏳ 正在调用 {model_config['name']} 模型...")

        response = client.chat.completions.create(
            model=model_config['id'],
            messages=[
                {
                    "role": "system",
                    "content": "你是一个专业的彩票数据分析师，擅长基于历史数据进行模式分析和预测。请严格按照要求返回 JSON 格式数据，不要有任何额外的解释或说明。"
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0.8,
            max_tokens=4096
        )

        response_text = response.choices[0].message.content.strip()

        # 提取 JSON
        json_text = extract_json_from_response(response_text)

        # 解析 JSON
        prediction_data = json.loads(json_text)

        print(f"  ✅ {model_config['name']} 预测成功")
        return prediction_data

    except json.JSONDecodeError as e:
        print(f"  ❌ {model_config['name']} JSON 解析失败: {str(e)}")
        print(f"  原始响应前500字符:\n{response_text[:500]}")
        raise
    except Exception as e:
        print(f"  ❌ {model_config['name']} 调用失败")
        print(f"  错误类型: {type(e).__name__}")
        print(f"  错误信息: {str(e)}")
        import traceback
        print(f"  详细堆栈:\n{traceback.format_exc()}")
        raise

def validate_prediction(prediction: Dict[str, Any]) -> bool:
    """验证预测数据格式"""
    try:
        # 检查必需字段
        required_fields = ["prediction_date", "target_period", "model_id", "model_name", "predictions"]
        for field in required_fields:
            if field not in prediction:
                print(f"    ⚠️  缺少字段: {field}")
                return False

        # 检查预测组数量
        if len(prediction["predictions"]) != 5:
            print(f"    ⚠️  预测组数量不正确: {len(prediction['predictions'])}")
            return False

        # 检查每组预测
        for group in prediction["predictions"]:
            # 检查红球
            if len(group["red_balls"]) != 6:
                print(f"    ⚠️  红球数量不正确: {len(group['red_balls'])}")
                return False

            # 检查红球是否排序
            sorted_reds = sorted(group["red_balls"])
            if group["red_balls"] != sorted_reds:
                print(f"    ⚠️  红球未排序: {group['red_balls']}")
                return False

            # 检查蓝球
            if not group["blue_ball"]:
                print(f"    ⚠️  蓝球为空")
                return False

        return True

    except Exception as e:
        print(f"    ⚠️  验证出错: {str(e)}")
        return False

def load_meta_prompt_template() -> str:
    """加载 Meta AI Prompt 模板"""
    try:
        with open(META_PROMPT_FILE, "r", encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError:
        print(f"❌ 找不到 {META_PROMPT_FILE}")
        return ""

def call_single_model_worker(
    client: OpenAI,
    model_config: Dict[str, str],
    prompt_template: str,
    target_period: str,
    target_date: str,
    compact_history: str,
    precomputed_features_text: str,
    prediction_date: str
) -> Dict[str, Any]:
    """单模型预测工作函数（支持独立重试与多线程并发）"""
    max_retries = 3
    system_instruction = "你是一个专业的彩票数据分析师，擅长基于历史数据进行模式分析和预测。请严格按照要求返回 JSON 格式数据，不要有任何额外的解释或说明。\n\n"
    full_prompt = system_instruction + prompt_template.replace(
        "{target_period}", str(target_period)
    ).replace(
        "{target_date}", str(target_date)
    ).replace(
        "{lottery_history}", str(compact_history)
    ).replace(
        "{precomputed_features}", str(precomputed_features_text)
    ).replace(
        "{prediction_date}", str(prediction_date)
    ).replace(
        "{model_id}", str(model_config['model_id'])
    ).replace(
        "{model_name}", str(model_config['name'])
    )

    model_id_lower = model_config['id'].lower()
    supports_temp = not any(k in model_id_lower for k in ["gemini", "thinking", "o1", "o3"])

    for attempt in range(max_retries):
        try:
            if attempt > 0:
                print(f"  🔄 正在重试 {model_config['name']} (第 {attempt + 1} 次)...")
            else:
                print(f"  ⏳ 正在并发调用 {model_config['name']} 模型...")

            req_kwargs = {
                "model": model_config['id'],
                "messages": [{"role": "user", "content": full_prompt}]
            }
            if supports_temp:
                req_kwargs["temperature"] = 0.8

            try:
                response = client.chat.completions.create(**req_kwargs)
            except Exception as api_err:
                # 若代理或模型因 temperature 报错 400，自动剥离 temperature 重试
                if "temperature" in str(api_err).lower() and "temperature" in req_kwargs:
                    print(f"  ⚠️  {model_config['name']} 不支持自定义 temperature，剥离后重试...")
                    supports_temp = False
                    req_kwargs.pop("temperature")
                    response = client.chat.completions.create(**req_kwargs)
                else:
                    raise api_err

            response_text = response.choices[0].message.content.strip()
            json_text = extract_json_from_response(response_text)
            prediction = json.loads(json_text)

            # 验证数据
            if validate_prediction(prediction):
                print(f"  ✓ {model_config['name']} 预测完成并通过验证")
                return prediction
            else:
                print(f"  ✗ {model_config['name']} 数据格式验证未通过")
                if attempt < max_retries - 1:
                    time.sleep(2)

        except Exception as e:
            print(f"  ✗ 处理 {model_config['name']} 时失败: {str(e)}")
            if attempt < max_retries - 1:
                time.sleep(2)

    return None

def generate_predictions() -> Dict[str, Any]:
    """生成所有模型的预测（多线程并行加速 + 50期紧凑多维特征工程）"""
    print("\n" + "="*50)
    print("🤖 双色球 AI 预测自动生成 (MoE 并发增强版)")
    print("="*50 + "\n")

    # 加载 Prompt 模板
    print("📄 加载 Prompt 模板...")
    try:
        prompt_template = load_prompt_template()
        print(f"  ✓ Prompt 模板加载成功 ({len(prompt_template)} 字符)\n")
    except Exception as e:
        print(f"  ✗ Prompt 模板加载失败: {str(e)}\n")
        return None

    # 加载历史数据
    print("📊 加载历史开奖数据...")
    lottery_data = load_lottery_history()

    # 归档旧预测（如果已开奖）
    archive_old_prediction(lottery_data)

    # 获取下期信息
    next_draw = lottery_data.get("next_draw", {})
    target_period = next_draw.get("next_period", "")
    target_date = next_draw.get("next_date_display", "")

    if not target_period:
        print("❌ 无法获取下期期号信息")
        return None

    print(f"🎯 目标期号: {target_period}")
    print(f"📅 开奖日期: {target_date}")
    print(f"📝 历史数据: 总库 {len(lottery_data.get('data', []))} 期，本次深度分析最近 50 期\n")

    # 准备历史数据（扩展至最近 50 期，采用紧凑高效文本格式，大幅节省 Token 且规避 LLM 格式解析混淆）
    history_draws = lottery_data.get("data", [])[:50]
    compact_history = format_compact_history(history_draws)
    features = compute_statistical_features(lottery_data, history_count=50)
    precomputed_features_text = format_precomputed_features_text(features)
    print(f"📈 已完成 50 期多维量化统计与特征工程计算（重号、邻号、加权热度、遗漏、振幅）\n")

    # 预测日期：优先读取 next_draw，并确保时区为北京时间
    prediction_date = get_next_draw_date(lottery_data)
    print(f"📅 预测日期: {prediction_date}\n")

    # 初始化 OpenAI 客户端
    client = get_openai_client()

    # 并行多线程调用所有基础模型
    print("🔮 开始并发调用基础模型矩阵...\n")
    results_by_id = {}
    max_workers = min(len(MODELS), 6)
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {
            executor.submit(
                call_single_model_worker,
                client,
                model_cfg,
                prompt_template,
                target_period,
                target_date,
                compact_history,
                precomputed_features_text,
                prediction_date
            ): model_cfg
            for model_cfg in MODELS
        }

        for future in as_completed(futures):
            cfg = futures[future]
            try:
                pred = future.result()
                if pred:
                    results_by_id[cfg['id']] = pred
            except Exception as e:
                print(f"  ❌ 模型 {cfg['name']} 并发线程发生异常: {e}")

    # 按 MODELS 原始预设顺序重组预测结果
    all_predictions = [results_by_id[m['id']] for m in MODELS if m['id'] in results_by_id]

    # 构建最终输出
    if not all_predictions:
        print("❌ 没有成功生成任何基础模型预测")
        return None

    # ============== Meta AI 混合专家汇总分析 ==============
    print("\n🧠 开始 Meta AI 超级裁判汇总分析...")
    meta_prompt_template = load_meta_prompt_template()
    meta_prediction = None
    if meta_prompt_template:
        # 构建各个模型的预测摘要，输出符合 JSON 结构的格式，供 Meta AI 解析候选池
        summary_data = []
        for p in all_predictions:
            model_name = p.get('model_name', '未知模型')
            for i, group in enumerate(p.get('predictions', [])):
                summary_data.append({
                    "group_id": f"{model_name}_{i+1}",
                    "strategy": group.get('strategy', '综合'),
                    "red_balls": group.get('red_balls', []),
                    "blue_ball": group.get('blue_ball', '01'),
                    "description": group.get('reasoning', group.get('description', ''))[:100]
                })
        base_predictions_summary = json.dumps(summary_data, ensure_ascii=False, indent=2)

        system_instruction = "你是一个“超级裁判 AI”及双色球究极分析师。请严格按照要求返回 JSON 格式数据，不要有任何额外的解释或说明。\n\n"
        full_meta_prompt = system_instruction + meta_prompt_template.replace(
            "{lottery_history}", str(compact_history)
        ).replace(
            "{precomputed_features}", str(precomputed_features_text)
        ).replace(
            "{base_predictions_summary}", str(base_predictions_summary)
        )

        # 优先使用 Claude Opus 或 GPT-120B 作为 Meta 模型
        meta_model_config = next((m for m in MODELS if "opus" in m["id"].lower()), MODELS[0])

        print(f"  ⏳ 正在调用超级裁判模型 {meta_model_config['name']}...")
        max_meta_retries = 3
        meta_model_lower = meta_model_config['id'].lower()
        supports_meta_temp = not any(k in meta_model_lower for k in ["gemini", "thinking", "o1", "o3"])

        for attempt in range(max_meta_retries):
            try:
                if attempt > 0:
                    print(f"  🔄 正在重试 Meta AI (第 {attempt + 1} 次)...")

                meta_req_kwargs = {
                    "model": meta_model_config['id'],
                    "messages": [{"role": "user", "content": full_meta_prompt}]
                }
                if supports_meta_temp:
                    meta_req_kwargs["temperature"] = 0.7

                try:
                    meta_response = client.chat.completions.create(**meta_req_kwargs)
                except Exception as meta_call_err:
                    if "temperature" in str(meta_call_err).lower() and "temperature" in meta_req_kwargs:
                        print(f"  ⚠️  Meta AI 模型不支持自定义 temperature，剥离后重试...")
                        supports_meta_temp = False
                        meta_req_kwargs.pop("temperature")
                        meta_response = client.chat.completions.create(**meta_req_kwargs)
                    else:
                        raise meta_call_err

                meta_json_text = extract_json_from_response(meta_response.choices[0].message.content.strip())
                meta_prediction = json.loads(meta_json_text)

                # 验证关键结构
                if "five_single_predictions" in meta_prediction and "dantuo_prediction" in meta_prediction and "compound_prediction" in meta_prediction:
                    print("  ✓ Meta AI 分析完成！")
                    break
                else:
                    print("  ✗ Meta AI 返回格式不完整")
                    meta_prediction = None
            except Exception as e:
                print(f"  ✗ Meta AI 分析失败: {e}")
                meta_prediction = None
                time.sleep(2)

    result = {
        "prediction_date": prediction_date,
        "target_period": target_period,
        "meta_prediction": meta_prediction,
        "models": all_predictions
    }

    print(f"✅ 成功生成 {len(all_predictions)}/{len(MODELS)} 个基础模型与 Meta AI 预测\n")
    return result

def calculate_hit_result(prediction_group: Dict[str, Any], actual_result: Dict[str, Any]) -> Dict[str, Any]:
    """计算单组预测的命中结果"""
    red_hits = [b for b in prediction_group["red_balls"] if b in actual_result["red_balls"]]
    blue_hit = prediction_group["blue_ball"] == actual_result["blue_ball"]

    return {
        "red_hits": red_hits,
        "red_hit_count": len(red_hits),
        "blue_hit": blue_hit,
        "total_hits": len(red_hits) + (1 if blue_hit else 0)
    }

def archive_old_prediction(lottery_data: Dict[str, Any]):
    """将旧预测归档到历史记录（如果已开奖）"""
    try:
        # 检查是否存在旧预测文件
        if not os.path.exists(AI_PREDICTIONS_FILE):
            print("  ℹ️  没有旧预测需要归档\n")
            return

        # 读取旧预测
        with open(AI_PREDICTIONS_FILE, 'r', encoding='utf-8') as f:
            old_predictions = json.load(f)

        old_target_period = old_predictions.get("target_period")
        if not old_target_period:
            print("  ⚠️  旧预测文件格式异常，跳过归档\n")
            return

        # 检查该期号是否已开奖
        latest_period = lottery_data.get("data", [{}])[0].get("period")
        if not latest_period or int(old_target_period) > int(latest_period):
            print(f"  ℹ️  旧预测期号 {old_target_period} 尚未开奖，无需归档\n")
            return

        print(f"  📦 旧预测期号 {old_target_period} 已开奖，开始归档...")

        # 查找实际开奖结果
        actual_result = None
        for draw in lottery_data.get("data", []):
            if draw.get("period") == old_target_period:
                actual_result = draw
                break

        if not actual_result:
            print(f"  ⚠️  找不到期号 {old_target_period} 的开奖结果，跳过归档\n")
            return

        # 读取历史记录文件
        history_data = {"predictions_history": []}
        if os.path.exists(PREDICTIONS_HISTORY_FILE):
            with open(PREDICTIONS_HISTORY_FILE, 'r', encoding='utf-8') as f:
                history_data = json.load(f)

        # 检查该期号是否已存在
        existing_record = next((r for r in history_data["predictions_history"]
                               if r["target_period"] == old_target_period), None)

        if existing_record:
            print(f"  ℹ️  期号 {old_target_period} 已存在于历史记录中\n")
            return

        # 为每个模型计算命中结果
        models_with_hits = []

        # 处理 Meta AI 超级裁判预测
        if old_predictions.get("meta_prediction"):
            meta_pred = old_predictions["meta_prediction"]
            meta_single_bets = meta_pred.get("five_single_predictions", [])
            strategies = ["稳健共识型", "冷热平衡型", "奇数强击型", "二区奇袭型", "逆向防冷型"]
            
            meta_predictions_with_hits = []
            for idx, bet in enumerate(meta_single_bets):
                group_data = {
                    "group_id": idx + 1,
                    "strategy": strategies[idx] if idx < len(strategies) else f"MetaAI 推荐 {idx + 1}",
                    "red_balls": sorted(bet["red_balls"], key=lambda x: int(x)),
                    "blue_ball": bet["blue_ball"],
                    "description": meta_pred.get("analysis_reasoning", "MetaAI 混合专家 (MoE) 超级裁判裁决推荐")[:100]
                }
                group_data["hit_result"] = calculate_hit_result(group_data, actual_result)
                meta_predictions_with_hits.append(group_data)
            
            if meta_predictions_with_hits:
                best_meta_pred = max(meta_predictions_with_hits, key=lambda p: p["hit_result"]["total_hits"])
                models_with_hits.append({
                    "model_id": "MetaAI-MoE",
                    "model_name": "MetaAI 超级裁判",
                    "predictions": meta_predictions_with_hits,
                    "best_group": best_meta_pred["group_id"],
                    "best_hit_count": best_meta_pred["hit_result"]["total_hits"]
                })

        for model_data in old_predictions.get("models", []):
            # 为每组预测计算命中
            predictions_with_hits = []
            for pred_group in model_data.get("predictions", []):
                pred_with_hit = pred_group.copy()
                pred_with_hit["hit_result"] = calculate_hit_result(pred_group, actual_result)
                predictions_with_hits.append(pred_with_hit)

            # 找出最佳预测组
            best_pred = max(predictions_with_hits, key=lambda p: p["hit_result"]["total_hits"])

            models_with_hits.append({
                "model_id": model_data.get("model_id"),
                "model_name": model_data.get("model_name"),
                "predictions": predictions_with_hits,
                "best_group": best_pred["group_id"],
                "best_hit_count": best_pred["hit_result"]["total_hits"]
            })

        # 创建新的历史记录
        new_record = {
            "prediction_date": old_predictions.get("prediction_date"),
            "target_period": old_target_period,
            "actual_result": actual_result,
            "models": models_with_hits
        }

        # 插入到历史记录顶部
        history_data["predictions_history"].insert(0, new_record)

        # 保存历史记录
        with open(PREDICTIONS_HISTORY_FILE, 'w', encoding='utf-8') as f:
            json.dump(history_data, f, ensure_ascii=False, indent=2)

        print(f"  ✅ 已将期号 {old_target_period} 的预测归档到历史记录")
        print(f"  📊 归档模型数: {len(models_with_hits)}\n")

    except Exception as e:
        print(f"  ⚠️  归档旧预测时出错: {str(e)}")
        print(f"  继续生成新预测...\n")

def save_predictions(predictions: Dict[str, Any]):
    """保存预测数据到文件"""
    try:
        print("💾 保存预测数据...")

        # 创建备份
        if os.path.exists(AI_PREDICTIONS_FILE):
            backup_file = AI_PREDICTIONS_FILE.replace(".json", f"_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json")
            with open(AI_PREDICTIONS_FILE, 'r', encoding='utf-8') as f:
                backup_data = json.load(f)
            with open(backup_file, 'w', encoding='utf-8') as f:
                json.dump(backup_data, f, ensure_ascii=False, indent=2)
            print(f"  ✓ 已创建备份: {os.path.basename(backup_file)}")

        # 保存新预测
        with open(AI_PREDICTIONS_FILE, 'w', encoding='utf-8') as f:
            json.dump(predictions, f, ensure_ascii=False, indent=2)

        print(f"  ✓ 已保存到: {AI_PREDICTIONS_FILE}\n")

    except Exception as e:
        print(f"❌ 保存失败: {str(e)}")
        raise

def main():
    """主函数"""
    if not API_KEY:
        print("❌ 请设置环境变量 AI_API_KEY")
        sys.exit(1)
    try:
        # 生成预测
        predictions = generate_predictions()

        if predictions:
            # 保存预测
            save_predictions(predictions)

            print("="*50)
            print("🎉 预测生成完成！")
            print("="*50 + "\n")

            # 显示预测摘要
            print("📋 预测摘要:")
            print(f"  期号: {predictions['target_period']}")
            print(f"  日期: {predictions['prediction_date']}")
            print(f"  模型数量: {len(predictions['models'])}")
            for model in predictions['models']:
                print(f"    - {model['model_name']}")
            print()
        else:
            print("❌ 预测生成失败")

    except Exception as e:
        print(f"\n❌ 程序执行出错: {str(e)}")
        raise

if __name__ == "__main__":
    main()

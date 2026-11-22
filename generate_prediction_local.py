#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
本地统计分析预测脚本（零依赖 / 无需 API Key）

基于历史开奖数据的统计特征生成下一期预测：
  - 冷热号频率（近 30/50/100 期）
  - 遗漏值（当前连续未开出期数）
  - 邻号 / 重号（上期号码的相邻与重复）
  - 区间分布（三区配比）
  - 和值 / 奇偶 / 大小 平衡

输出结构完全兼容前端（ai_predictions.json）：
  prediction_date / target_period / meta_prediction / models

用法：
    python generate_prediction_local.py
    python generate_prediction_local.py --quiet
"""
import os
import sys
import json
import random
from collections import Counter
from datetime import datetime
from typing import List, Dict, Any

if sys.platform == "win32" and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(SCRIPT_DIR, "data")
HISTORY_FILE = os.path.join(DATA_DIR, "lottery_history.json")
PREDICTION_FILE = os.path.join(DATA_DIR, "ai_predictions.json")

RED_RANGE = range(1, 34)
BLUE_RANGE = range(1, 17)
STRATEGIES = ["热号追随者", "冷号逆向者", "连重邻形态师", "区间均衡派", "遗漏回补派"]


def log(msg: str, quiet: bool = False) -> None:
    if not quiet:
        print(msg)


def b2s(n: int) -> str:
    return f"{n:02d}"


def load_history(quiet: bool = False) -> Dict[str, Any]:
    with open(HISTORY_FILE, "r", encoding="utf-8") as fh:
        data = json.load(fh)
    log(f"  ✓ 加载历史 {len(data.get('data', []))} 期", quiet)
    return data


def compute_features(draws: List[Dict[str, Any]]) -> Dict[str, Any]:
    """计算红球/蓝球的频率、遗漏、冷热特征"""
    reds_all = [[int(b) for b in d["red_balls"]] for d in draws]
    blues_all = [int(d["blue_ball"]) for d in draws]

    freq30 = Counter(r for row in reds_all[:30] for r in row)
    freq50 = Counter(r for row in reds_all[:50] for r in row)
    freq100 = Counter(r for row in reds_all[:100] for r in row)
    blue_freq50 = Counter(blues_all[:50])

    # 遗漏值：从最新一期往前数，每个号码连续多少期未出现
    red_missing: Dict[int, int] = {}
    for n in RED_RANGE:
        miss = 0
        for row in reds_all:
            if n in row:
                break
            miss += 1
        red_missing[n] = miss
    blue_missing: Dict[int, int] = {}
    for n in BLUE_RANGE:
        miss = 0
        for b in blues_all:
            if b == n:
                break
            miss += 1
        blue_missing[n] = miss

    return {
        "freq30": freq30, "freq50": freq50, "freq100": freq100,
        "blue_freq50": blue_freq50,
        "red_missing": red_missing, "blue_missing": blue_missing,
        "last_reds": reds_all[0] if reds_all else [],
        "last_blue": blues_all[0] if blues_all else 0,
    }


def pick_group(features: Dict[str, Any], strategy: str) -> tuple[List[str], str]:
    """按策略生成一组 6 红 + 1 蓝，返回号码与说明"""
    freq30, freq50 = features["freq30"], features["freq50"]
    missing = features["red_missing"]
    last = features["last_reds"]

    if strategy == "热号追随者":
        pool = sorted(RED_RANGE, key=lambda n: (-freq50[n], -freq30[n]))
        chosen = pool[:6]
        desc = "近 50 期高频热号主导，跟随长期趋势"
    elif strategy == "冷号逆向者":
        pool = sorted(RED_RANGE, key=lambda n: (-missing[n], freq50[n]))
        chosen = pool[:6]
        desc = "深遗漏冷号逆向布局，博均值回归"
    elif strategy == "连重邻形态师":
        neighbors = set()
        for n in last:
            for d in (-1, 1):
                if n + d in RED_RANGE:
                    neighbors.add(n + d)
        chosen = sorted(list(neighbors | set(last)))[:6]
        if len(chosen) < 6:
            extra = [n for n in sorted(RED_RANGE, key=lambda x: -freq30[x]) if n not in chosen]
            chosen = sorted(chosen + extra[:6 - len(chosen)])
        desc = "上期重号与邻号传承，博弈连号形态"
    elif strategy == "区间均衡派":
        zones = [list(range(1, 12)), list(range(12, 23)), list(range(23, 34))]
        chosen = []
        for zone in zones:
            top = sorted(zone, key=lambda n: -freq50[n])[:2]
            chosen.extend(top)
        chosen = sorted(chosen)[:6]
        desc = "一区二区三区 2-2-2 均衡配比"
    else:  # 遗漏回补派
        pool = sorted(RED_RANGE, key=lambda n: (-missing[n], -freq100[n]))
        chosen = pool[:6]
        desc = "长遗漏号码回补，搭配中频抗氧化"

    # 蓝球：按策略在热门 / 遗漏间切换
    blue_freq = features["blue_freq50"]
    blue_miss = features["blue_missing"]
    if strategy in ("热号追随者", "区间均衡派"):
        blue = sorted(BLUE_RANGE, key=lambda n: -blue_freq[n])[0]
        blue_note = "近期热蓝"
    else:
        blue = sorted(BLUE_RANGE, key=lambda n: -blue_miss[n])[0]
        blue_note = "高遗漏回补蓝"

    return [b2s(n) for n in sorted(chosen)], b2s(blue), f"{desc}；蓝球取{blue_note}"


def build_models(features: Dict[str, Any], period: str, date: str) -> List[Dict[str, Any]]:
    """生成 4 个模拟模型，每个模型 5 组预测"""
    model_names = [
        ("STAT-HOT", "统计热号模型"),
        ("STAT-COLD", "统计冷号模型"),
        ("STAT-FORM", "形态邻号模型"),
        ("STAT-BAL", "区间均衡模型"),
    ]
    models = []
    for idx, (mid, name) in enumerate(model_names):
        strategy = STRATEGIES[idx]
        predictions = []
        for g in range(1, 6):
            reds, blue, desc = pick_group(features, strategy)
            predictions.append({
                "group_id": g,
                "strategy": strategy,
                "red_balls": reds,
                "blue_ball": blue,
                "description": desc,
            })
        models.append({
            "prediction_date": date,
            "target_period": period,
            "model_id": mid,
            "model_name": name,
            "predictions": predictions,
            "statistics": {
                "total_groups": 5,
                "strategy": strategy,
            },
        })
    return models


def build_meta(models: List[Dict[str, Any]], features: Dict[str, Any],
               period: str, date: str) -> Dict[str, Any]:
    """基于各模型结果构建 Meta 综合推荐"""
    red_counter = Counter()
    blue_counter = Counter()
    for model in models:
        for pred in model["predictions"]:
            for r in pred["red_balls"]:
                red_counter[r] += 1
            blue_counter[pred["blue_ball"]] += 1

    # counter 的 key 已是 "04" 格式字符串，直接取用
    top_reds = [n for n, _ in red_counter.most_common(8)]
    top_blues = [n for n, _ in blue_counter.most_common(3)]

    # 5 注单式：从高频池中做不同组合
    pool = top_reds + [b2s(n) for n in
                       sorted(RED_RANGE, key=lambda x: -features["freq50"][x])[:8]]
    pool = list(dict.fromkeys(pool))
    singles = []
    for i in range(5):
        start = (i * 2) % max(1, len(pool) - 6)
        reds = sorted(pool[start:start + 6], key=int)
        if len(reds) < 6:
            reds = sorted(pool[:6], key=int)
        singles.append({"red_balls": reds, "blue_ball": top_blues[i % len(top_blues)]})

    reasoning = (
        f"基于近 100 期数据统计分析：红球高频集中在 {'/'.join(top_reds[:5])}，"
        f"蓝球热门 {'/'.join(top_blues)}。冷号回补与邻号传承并重，"
        f"5 注覆盖 {len(set(r for s in singles for r in s['red_balls']))} 个独立红球、"
        f"{len(set(s['blue_ball'] for s in singles))} 个独立蓝球，实现风险对冲。"
    )

    return {
        "analysis_reasoning": reasoning,
        "five_single_predictions": singles,
        "dantuo_prediction": {
            "dan_reds": top_reds[:4],
            "tuo_reds": top_reds[4:8],
            "blue_balls": top_blues[:2],
        },
        "compound_prediction": {
            "red_balls": top_reds[:8],
            "blue_balls": top_blues[:2],
        },
    }


def archive_old(data: Dict[str, Any], quiet: bool = False) -> None:
    """若上一期预测已开奖，归档到预测历史"""
    if not os.path.exists(PREDICTION_FILE):
        return
    try:
        with open(PREDICTION_FILE, "r", encoding="utf-8") as fh:
            old = json.load(fh)
    except Exception:
        return
    old_period = old.get("target_period")
    draws = {d["period"] for d in data.get("data", [])}
    if not old_period or old_period not in draws:
        return

    hist_file = os.path.join(DATA_DIR, "predictions_history.json")
    try:
        with open(hist_file, "r", encoding="utf-8") as fh:
            hist = json.load(fh)
    except Exception:
        hist = {"predictions_history": []}
    records = hist.setdefault("predictions_history", [])
    if any(r.get("target_period") == old_period for r in records):
        return
    actual = next((d for d in data["data"] if d["period"] == old_period), None)
    records.insert(0, {
        "target_period": old_period,
        "prediction_date": old.get("prediction_date", ""),
        "models": old.get("models", []),
        "meta_prediction": old.get("meta_prediction", {}),
        "actual_result": actual,
    })
    with open(hist_file, "w", encoding="utf-8") as fh:
        json.dump(hist, fh, ensure_ascii=False, indent=2)
    log(f"  ✓ 已归档旧预测 {old_period} 期", quiet)


def main() -> int:
    quiet = "--quiet" in sys.argv
    log("=" * 50, quiet)
    log("本地统计分析预测（零依赖）", quiet)
    log("=" * 50, quiet)

    data = load_history(quiet)
    draws = data.get("data", [])
    if not draws:
        log("✗ 无历史数据，请先运行抓取脚本", quiet)
        return 1

    archive_old(data, quiet)

    target_period = data.get("next_draw", {}).get("next_period", "")
    target_date = data.get("next_draw", {}).get("next_date", "")
    if not target_period:
        log("✗ 无法获取下一期期号", quiet)
        return 1

    log(f"  ✓ 目标期号 {target_period} / {target_date}", quiet)
    features = compute_features(draws[:100])
    models = build_models(features, target_period, target_date)
    meta = build_meta(models, features, target_period, target_date)

    result = {
        "prediction_date": datetime.now().strftime("%Y-%m-%d"),
        "target_period": target_period,
        "meta_prediction": meta,
        "models": models,
    }

    tmp = PREDICTION_FILE + ".tmp"
    try:
        with open(tmp, "w", encoding="utf-8") as fh:
            json.dump(result, fh, ensure_ascii=False, indent=2)
        os.replace(tmp, PREDICTION_FILE)
    except Exception as exc:
        log(f"✗ 写入预测失败: {exc}", quiet)
        return 1

    log("", quiet)
    log(f"✓ 预测已生成：{target_period} 期 / {len(models)} 个模型 / {len(meta['five_single_predictions'])} 注推荐", quiet)
    log(f"  综合红球: {' '.join(meta['compound_prediction']['red_balls'])}", quiet)
    log(f"  综合蓝球: {' '.join(meta['compound_prediction']['blue_balls'])}", quiet)
    return 0


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
双色球历史开奖数据获取脚本（零依赖版）

数据源：500 彩票网静态 XML（kaijiang.500.com）
  - 纯标准库实现，无需 requests / bs4
  - 一次拉取全量历史（3000+ 期），自动合并去重
  - 自动更新 data/lottery_history.json 与 fetch_history/lottery_data.json
  - 自动重算 next_draw（下一期期号 / 开奖日）

用法：
    python fetch_lottery_history.py
    python fetch_lottery_history.py --quiet      # 静默模式，供一键脚本调用
"""
import os
import re
import sys
import json
import urllib.request
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional

# Windows 控制台 UTF-8 输出
if sys.platform == "win32" and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(SCRIPT_DIR)
DEFAULT_OUTPUT_FILE = os.path.join(SCRIPT_DIR, "lottery_data.json")
WEB_DATA_PATH = os.path.join(ROOT_DIR, "data", "lottery_history.json")
XML_URL = "https://kaijiang.500.com/static/info/kaijiang/xml/ssq/list.xml"
KEEP_RECENT = 500  # 本地保留最近 N 期（控制文件体积，统计足够）
DRAW_WEEKDAYS = [1, 3, 6]  # 周二 / 周四 / 周日
WEEKDAY_NAMES = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"]


def log(msg: str, quiet: bool = False) -> None:
    if not quiet:
        print(msg)


def fetch_xml(quiet: bool = False) -> Optional[str]:
    """拉取 500 彩票网开奖 XML，返回 UTF-8 文本"""
    req = urllib.request.Request(
        XML_URL,
        headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read()
        log(f"  ✓ 数据源响应 {len(raw)} 字节", quiet)
        return raw.decode("utf-8", errors="replace")
    except Exception as exc:
        log(f"  ✗ 数据源请求失败: {exc}", quiet)
        return None


def parse_xml(xml_text: str, quiet: bool = False) -> List[Dict[str, str]]:
    """解析 XML 中的开奖记录"""
    rows = re.findall(r"<row\s+([^>]+?)/?>", xml_text)
    result: List[Dict[str, str]] = []
    for attrs in rows:
        period_m = re.search(r'expect="(\d+)"', attrs)
        code_m = re.search(r'opencode="([^"]+)"', attrs)
        time_m = re.search(r'opentime="([^"]+)"', attrs)
        if not (period_m and code_m and time_m):
            continue
        period = period_m.group(1)
        code = code_m.group(1)
        if "|" not in code:
            continue
        reds_str, blue = code.split("|", 1)
        reds = [r.strip() for r in reds_str.split(",") if r.strip()]
        if len(reds) != 6:
            continue
        result.append({
            "period": period,
            "red_balls": reds,
            "blue_ball": blue.strip(),
            "date": time_m.group(1)[:10],
        })
    log(f"  ✓ 解析到 {len(result)} 期开奖数据", quiet)
    return result


def merge_data(new_data: List[Dict[str, str]], existing_file: str,
               quiet: bool = False) -> List[Dict[str, str]]:
    """按期号合并新旧数据（新数据覆盖同期号），按数值降序排序"""
    merged: Dict[str, Dict[str, str]] = {}
    if os.path.exists(existing_file):
        try:
            with open(existing_file, "r", encoding="utf-8") as fh:
                for item in json.load(fh):
                    if item.get("period"):
                        merged[item["period"]] = item
            log(f"  ✓ 加载已有数据 {len(merged)} 期", quiet)
        except Exception as exc:
            log(f"  ⚠ 加载已有数据失败（将全量重建）: {exc}", quiet)

    added = 0
    for item in new_data:
        if item["period"] not in merged:
            added += 1
        merged[item["period"]] = item

    ordered = sorted(merged.values(),
                     key=lambda x: int(x["period"]) if x["period"].isdigit() else 0,
                     reverse=True)
    log(f"  ✓ 合并完成：新增 {added} 期，总计 {len(ordered)} 期", quiet)
    return ordered


def next_draw_after(last_period: str, last_date: str) -> Dict[str, str]:
    """根据最新开奖期与日期推算下一期信息"""
    last_dt = datetime.strptime(last_date, "%Y-%m-%d")
    next_dt = last_dt + timedelta(days=1)
    while next_dt.weekday() not in DRAW_WEEKDAYS:
        next_dt += timedelta(days=1)
    return {
        "next_period": str(int(last_period) + 1).zfill(len(last_period)),
        "next_date": next_dt.strftime("%Y-%m-%d"),
        "next_date_display": next_dt.strftime("%Y年%m月%d日"),
        "weekday": WEEKDAY_NAMES[next_dt.weekday()],
        "draw_time": "21:15",
    }


def write_json(path: str, data: Any, quiet: bool = False) -> bool:
    """原子写入 JSON，失败时保留原文件"""
    tmp = path + ".tmp"
    try:
        with open(tmp, "w", encoding="utf-8") as fh:
            json.dump(data, fh, ensure_ascii=False, indent=2)
        os.replace(tmp, path)
        log(f"  ✓ 写入 {os.path.basename(path)}", quiet)
        return True
    except Exception as exc:
        log(f"  ✗ 写入 {path} 失败: {exc}", quiet)
        if os.path.exists(tmp):
            try:
                os.remove(tmp)
            except OSError:
                pass
        return False


def main() -> int:
    quiet = "--quiet" in sys.argv
    log("=" * 50, quiet)
    log("双色球开奖数据抓取（500 彩票网 XML 源）", quiet)
    log("=" * 50, quiet)

    xml_text = fetch_xml(quiet)
    if not xml_text:
        log("✗ 抓取失败：无法获取数据源", quiet)
        return 1

    fetched = parse_xml(xml_text, quiet)
    if not fetched:
        log("✗ 抓取失败：未解析到有效数据", quiet)
        return 1

    # 1) 更新 fetch_history/lottery_data.json（纯数组，仅保留最近 N 期）
    merged = merge_data(fetched, DEFAULT_OUTPUT_FILE, quiet)
    merged = merged[:KEEP_RECENT]
    if not write_json(DEFAULT_OUTPUT_FILE, merged, quiet):
        return 1

    # 2) 更新 data/lottery_history.json（带 next_draw 的网页数据）
    latest = merged[0]
    web_payload = {
        "last_updated": datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "data": merged,
        "next_draw": next_draw_after(latest["period"], latest["date"]),
    }
    if not write_json(WEB_DATA_PATH, web_payload, quiet):
        return 1

    log("", quiet)
    log(f"✓ 最新开奖：{latest['period']} 期 / {latest['date']}", quiet)
    log(f"  {' '.join(latest['red_balls'])} + {latest['blue_ball']}", quiet)
    log(f"✓ 下一期：{web_payload['next_draw']['next_period']} 期 / "
        f"{web_payload['next_draw']['next_date_display']}", quiet)
    return 0


if __name__ == "__main__":
    sys.exit(main())

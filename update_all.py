#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
一键更新：抓取最新开奖数据 → 生成下一期预测

串联两个零依赖脚本，供手动运行或自动化定时任务调用。
用法：
    python update_all.py              # 完整输出
    python update_all.py --quiet      # 静默（自动化用）
"""
import os
import sys
import subprocess

if sys.platform == "win32" and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
FETCH_SCRIPT = os.path.join(SCRIPT_DIR, "fetch_history", "fetch_lottery_history.py")
PREDICT_SCRIPT = os.path.join(SCRIPT_DIR, "generate_prediction_local.py")


def run(script: str, quiet: bool) -> int:
    cmd = [sys.executable, script]
    if quiet:
        cmd.append("--quiet")
    return subprocess.call(cmd, cwd=SCRIPT_DIR)


def main() -> int:
    quiet = "--quiet" in sys.argv
    if not quiet:
        print("=" * 50)
        print("双色球一键更新：抓取开奖 + 生成预测")
        print("=" * 50)

    if not os.path.exists(FETCH_SCRIPT):
        print(f"✗ 缺少抓取脚本: {FETCH_SCRIPT}")
        return 1
    if not os.path.exists(PREDICT_SCRIPT):
        print(f"✗ 缺少预测脚本: {PREDICT_SCRIPT}")
        return 1

    print("\n[1/2] 抓取最新开奖数据...")
    if run(FETCH_SCRIPT, quiet) != 0:
        print("✗ 抓取失败，流程中止")
        return 1

    print("\n[2/2] 生成下一期预测...")
    if run(PREDICT_SCRIPT, quiet) != 0:
        print("✗ 预测生成失败")
        return 1

    print("\n" + "=" * 50)
    print("✓ 一键更新完成")
    print("=" * 50)
    return 0


if __name__ == "__main__":
    sys.exit(main())

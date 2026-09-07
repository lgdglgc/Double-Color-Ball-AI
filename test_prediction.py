#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""测试 AI 预测脚本功能与数据文件结构（支持 MoE v3.0 规范）"""

import json
import os
import sys

# 解决 Windows 控制台打印 emoji 报 UnicodeEncodeError 的跨平台问题
if sys.platform == "win32" and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
AI_PREDICTIONS_FILE = os.path.join(SCRIPT_DIR, "data", "ai_predictions.json")

def test_prediction_file():
    """测试预测文件格式"""
    print("=" * 50)
    print("测试 AI 预测数据文件 (MoE v3.0 校验)")
    print("=" * 50 + "\n")
    
    try:
        with open(AI_PREDICTIONS_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        # 基本字段检查
        assert "prediction_date" in data, "缺少 prediction_date 字段"
        assert "target_period" in data, "缺少 target_period 字段"
        assert "models" in data, "缺少 models 字段"
        
        print(f"✅ 基本字段完整")
        print(f"   预测日期: {data['prediction_date']}")
        print(f"   目标期号: {data['target_period']}\n")
        
        # 模型数量检查
        models = data["models"]
        print(f"✅ 基础模型数量: {len(models)}")
        
        # 检查每个模型
        for model in models:
            model_name = model.get("model_name", "未知")
            predictions = model.get("predictions", [])
            
            # 检查预测组数量
            assert len(predictions) == 5, f"{model_name} 预测组数量不正确: {len(predictions)}"
            
            # 检查每组预测
            for pred in predictions:
                red_balls = pred.get("red_balls", [])
                blue_ball = pred.get("blue_ball")
                
                # 红球检查
                assert len(red_balls) == 6, f"{model_name} 红球数量不正确: {red_balls}"
                assert red_balls == sorted(red_balls), f"{model_name} 红球未按升序排列: {red_balls}"
                
                # 蓝球检查
                assert blue_ball, f"{model_name} 蓝球为空"
            
            print(f"   ✓ {model_name}: 5 组预测，格式正确")

        # MoE 超级裁判预测检查
        if "meta_prediction" in data and data["meta_prediction"]:
            meta = data["meta_prediction"]
            print("\n✅ 检查 Meta AI 混合专家超级裁判结果:")
            assert "analysis_reasoning" in meta, "Meta AI 缺少 analysis_reasoning"
            print(f"   ✓ 裁判点评完整 ({len(meta['analysis_reasoning'])} 字符)")
            
            # 检查5注单式
            assert "five_single_predictions" in meta, "Meta AI 缺少 five_single_predictions"
            singles = meta["five_single_predictions"]
            assert len(singles) == 5, f"Meta AI 精选单式数量不为 5 注 (实际: {len(singles)})"
            for idx, s in enumerate(singles):
                assert len(s["red_balls"]) == 6, f"单式第 {idx+1} 注红球数量不正确"
                assert s["blue_ball"], f"单式第 {idx+1} 注缺少蓝球"
            print("   ✓ 精选 5 注单式完整且符合硬约束")

            # 检查胆拖
            assert "dantuo_prediction" in meta, "Meta AI 缺少 dantuo_prediction"
            dt = meta["dantuo_prediction"]
            assert len(dt["dan_reds"]) == 4, f"胆码数量不符合 4 胆 (实际: {len(dt['dan_reds'])})"
            assert len(dt["tuo_reds"]) == 4, f"拖码数量不符合 4 拖 (实际: {len(dt['tuo_reds'])})"
            assert len(dt["blue_balls"]) == 2, f"蓝球数量不符合 2 蓝 (实际: {len(dt['blue_balls'])})"
            print("   ✓ 4胆4拖2蓝 胆拖组合校验通过")

            # 检查复式大底
            assert "compound_prediction" in meta, "Meta AI 缺少 compound_prediction"
            cp = meta["compound_prediction"]
            assert len(cp["red_balls"]) == 8, f"复式红球数量不符合 8 红 (实际: {len(cp['red_balls'])})"
            assert len(cp["blue_balls"]) == 2, f"复式蓝球数量不符合 2 蓝 (实际: {len(cp['blue_balls'])})"
            print("   ✓ 8+2 复式大底校验通过")
        
        print("\n" + "=" * 50)
        print("🎉 所有数据校验测试均已通过！")
        print("=" * 50)
        
    except Exception as e:
        print(f"\n❌ 测试失败: {str(e)}")
        raise

if __name__ == "__main__":
    test_prediction_file()

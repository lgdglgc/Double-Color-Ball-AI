# -*- coding: utf-8 -*-
"""
双色球 AI 预测自动生成脚本
自动调用 AI 模型生成下期预测数据
"""

import json
import os
import sys
from datetime import datetime, timedelta
from openai import OpenAI
from typing import Dict, Any

# ==================== 配置区 ====================
# API 配置（通过环境变量设置）
BASE_URL = os.environ.get("AI_BASE_URL") or "https://aihubmix.com/v1"
API_KEY = os.environ.get("AI_API_KEY")
if not API_KEY:
    print("❌ 请设置环境变量 AI_API_KEY")
    sys.exit(1)

# 模型配置列表
MODELS = [
    {"id": "gpt-oss-120b-medium", "name": "GPT 120B", "model_id": "GPT-120B-OSS"},
    {"id": "claude-sonnet-4-6", "name": "Claude Sonnet", "model_id": "Claude-Sonnet-4.6"},
    {"id": "gemini-3.1-pro-high", "name": "Gemini 3.1 Pro", "model_id": "Gemini-3.1-Pro"},
    {"id": "claude-opus-4-6-thinking", "name": "Claude Opus", "model_id": "Claude-Opus-4.6"}
]

# 文件路径
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
LOTTERY_HISTORY_FILE = os.path.join(SCRIPT_DIR, "data", "lottery_history.json")
AI_PREDICTIONS_FILE = os.path.join(SCRIPT_DIR, "data", "ai_predictions.json")
PREDICTIONS_HISTORY_FILE = os.path.join(SCRIPT_DIR, "data", "predictions_history.json")
PROMPT_FILE = os.path.join(SCRIPT_DIR, "doc", "prompt2.0.md")

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

def get_next_draw_date() -> str:
    """
    根据双色球开奖规则（每周二、四、日 21:15）计算下期开奖日期
    返回 YYYY-MM-DD 格式
    """
    today = datetime.now()
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

def get_openai_client() -> OpenAI:
    """获取 OpenAI 客户端"""
    return OpenAI(api_key=API_KEY, base_url=BASE_URL)

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
            temperature=0.8
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
        with open("prompts/meta_prompt_template.txt", "r", encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError:
        print("❌ 找不到 prompts/meta_prompt_template.txt")
        return ""

def generate_predictions() -> Dict[str, Any]:
    """生成所有模型的预测"""
    print("\n" + "="*50)
    print("🤖 双色球 AI 预测自动生成")
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
    print(f"📝 历史数据: 最近 {len(lottery_data.get('data', []))} 期\n")

    # 准备历史数据（最近30期）
    history_data = lottery_data.get("data", [])[:30]
    history_json = json.dumps(history_data, ensure_ascii=False, indent=2)

    # 预测日期：根据开奖规则计算下期开奖日期
    prediction_date = get_next_draw_date()
    print(f"📅 预测日期: {prediction_date}\n")

    # 初始化 OpenAI 客户端
    client = get_openai_client()

    # 存储所有模型的预测
    all_predictions = []

    # 逐个调用模型
    print("🔮 开始生成预测...\n")
    for model_config in MODELS:
        max_retries = 3
        for attempt in range(max_retries):
            try:
                if attempt > 0:
                    print(f"  🔄 正在重试 {model_config['name']} (第 {attempt + 1} 次)...")
                
                # 构建 prompt
                system_instruction = "你是一个专业的彩票数据分析师，擅长基于历史数据进行模式分析和预测。请严格按照要求返回 JSON 格式数据，不要有任何额外的解释或说明。\n\n"
                
                full_prompt = system_instruction + prompt_template.format(
                    target_period=target_period,
                    target_date=target_date,
                    lottery_history=history_json,
                    prediction_date=prediction_date,
                    model_id=model_config['model_id'],
                    model_name=model_config['name']
                )

                # 调用模型
                print(f"  ⏳ 正在调用 {model_config['name']} 模型...")
                response = client.chat.completions.create(
                    model=model_config['id'],
                    messages=[
                        {
                            "role": "user",
                            "content": full_prompt
                        }
                    ],
                    temperature=0.8
                )

                response_text = response.choices[0].message.content.strip()
                json_text = extract_json_from_response(response_text)
                prediction = json.loads(json_text)

                # 验证数据
                if validate_prediction(prediction):
                    all_predictions.append(prediction)
                    print(f"  ✓ 验证通过\n")
                    break  # 成功，跳出重试循环
                else:
                    print(f"  ✗ 验证失败")
                    if attempt < max_retries - 1:
                        import time
                        time.sleep(2)
            except Exception as e:
                print(f"  ✗ 处理 {model_config['name']} 时失败: {str(e)}")
                if attempt < max_retries - 1:
                    import time
                    time.sleep(2)

    # 构建最终输出
    if not all_predictions:
        print("❌ 没有成功生成任何预测")
        return None

    # ============== Meta AI 混合专家汇总分析 ==============
    print("\n🧠 开始 Meta AI 汇总分析...")
    meta_prompt_template = load_meta_prompt_template()
    meta_prediction = None
    if meta_prompt_template:
        # 构建各个模型的预测摘要
        summary_lines = []
        for p in all_predictions:
            summary_lines.append(f"【{p.get('model_name', '未知模型')}】的预测：")
            for i, group in enumerate(p.get('predictions', [])):
                reds = ",".join(group['red_balls'])
                summary_lines.append(f"  预测{i+1}: 红球[{reds}] 蓝球[{group['blue_ball']}] (理由: {group.get('strategy', '无')})")
        
        base_predictions_summary = "\n".join(summary_lines)
        
        system_instruction = "你是一个“超级裁判 AI”及双色球究极分析师。请严格按照要求返回 JSON 格式数据，不要有任何额外的解释或说明。\n\n"
        full_meta_prompt = system_instruction + meta_prompt_template.format(
            lottery_history=history_json,
            base_predictions_summary=base_predictions_summary
        )

        # 优先使用 Claude Opus 或 GPT-120B 作为 Meta 模型
        meta_model_config = next((m for m in MODELS if "opus" in m["id"].lower()), MODELS[0])
        
        print(f"  ⏳ 正在调用超级裁判模型 {meta_model_config['name']}...")
        max_meta_retries = 3
        for attempt in range(max_meta_retries):
            try:
                if attempt > 0:
                    print(f"  🔄 正在重试 Meta AI (第 {attempt + 1} 次)...")
                meta_response = client.chat.completions.create(
                    model=meta_model_config['id'],
                    messages=[{"role": "user", "content": full_meta_prompt}],
                    temperature=0.7
                )
                meta_json_text = extract_json_from_response(meta_response.choices[0].message.content.strip())
                meta_prediction = json.loads(meta_json_text)
                
                # 简单验证
                if "standard_prediction" in meta_prediction and "dantuo_prediction" in meta_prediction:
                    print("  ✓ Meta AI 分析完成！")
                    break
                else:
                    print("  ✗ Meta AI 返回格式不完整")
                    meta_prediction = None
            except Exception as e:
                print(f"  ✗ Meta AI 分析失败: {e}")
                meta_prediction = None
                import time
                time.sleep(2)

    result = {
        "prediction_date": prediction_date,
        "target_period": target_period,
        "meta_prediction": meta_prediction,
        "models": all_predictions
    }

    print(f"✅ 成功生成 {len(all_predictions)}/{len(MODELS)} 个模型的预测\n")
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

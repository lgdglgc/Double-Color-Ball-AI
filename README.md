# 🎱 双色球 AI 预测系统

> 🌐 在线访问：[https://dcb.kqsdw.com](https://dcb.kqsdw.com)

<img src="images/image1.jpg" width="80%">

一个现代化的双色球数据展示与 AI 预测系统。  
基于历史开奖数据，通过多模型 AI 生成预测结果，并提供数据趋势与遗漏分析仪表盘。

---

## ✨ 主要特性

- 🤖 **多模型 AI 预测** — 多个顶级 AI 模型独立预测，MetaAI 超级裁判综合定夺
- 📊 **数据趋势与遗漏分析** — 热力渐变图、遗漏预警面板、散点图、排序切换
- 🎯 **历史命中回溯** — 自动对比预测与实际开奖，可视化命中表现
- 📅 **官方历史开奖** — 完整历史开奖记录独立展示
- 🔄 **GitHub Actions 自动化** — 定时自动获取开奖数据并生成 AI 预测
- 📱 **响应式设计** — 桌面端与移动端完整适配

---

## 🔮 AI 预测策略

每期由多个独立 AI 模型生成预测，再由 MetaAI 超级裁判综合分析后给出终极推荐。

| 策略 | 说明 |
|------|------|
| 🔥 热号追随 | 追踪近期高频出现号码 |
| ❄️ 冷号逆向 | 捕捉长期未出的极冷号码 |
| ⚖️ 平衡策略 | 综合奇偶比、大小比、和值多维度平衡 |
| 📈 周期理论 | 短期频率上穿长期频率的号码 |
| 🧠 综合决策 | 融合以上所有策略 |

---

## 📊 数据趋势分析模块

- **周期切换**：支持近 30 / 50 / 100 期及全部数据动态分析
- **遗漏预警面板**：实时展示极冷红球 Top 5、蓝球遗漏 Top 5
- **热力渐变柱状图**：5 级热度颜色渐变 + 理论均值基准线
- **排序切换**：号码 / 出现频次 / 遗漏期数三种排序模式
- **频率 vs 遗漏散点图**：二维空间直观展示各号码的冷热定位

---

## 🛠️ 技术栈

- **前端**：原生 HTML5 + CSS3 + JavaScript (ES6+)
- **图表**：Chart.js
- **自动化**：GitHub Actions (Python)
- **部署**：Vercel

---

## 📁 项目结构

```
Double-Color-Ball-AI/
├── index.html                     # 主页面
├── css/
│   └── style.css                  # 样式文件
├── js/
│   ├── app.js                     # 主应用逻辑
│   ├── data-loader.js             # 数据加载
│   └── components.js              # UI 组件
├── data/
│   ├── lottery_history.json       # 历史开奖数据
│   ├── ai_predictions.json        # 最新 AI 预测
│   └── predictions_history.json   # 预测历史记录
├── fetch_history/                 # 数据爬取脚本
├── prompts/                       # AI Prompt 模板
├── generate_ai_prediction.py      # AI 预测自动生成脚本
└── .github/workflows/             # GitHub Actions 自动化
```

---

## 🔄 自动化运行

本项目通过 **GitHub Actions** 实现全自动化：

1. **定时触发**：每周一、三、五 UTC 00:00（北京时间 08:00）
2. **自动生成**：调用 AI API 生成新一期预测
3. **自动提交**：将预测结果写入 `data/` 目录并 push 到仓库
4. **自动部署**：Vercel 检测到 push 后自动更新线上网站

### 配置 Secrets

在仓库 `Settings → Secrets and variables → Actions` 中添加：

| Secret 名称 | 说明 |
|---|---|
| `AI_API_KEY` | AI 服务的 API Key |
| `AI_BASE_URL` | API 端点地址（如使用中转服务填写，否则可不填）|

---

## 🚀 本地运行

```bash
# 使用 Python 启动本地服务器
python3 -m http.server 8000
```

然后访问：http://localhost:8000

> ⚠️ 请勿直接双击打开 `index.html`，浏览器的同源策略会导致 JSON 数据加载失败。

---

## 🌐 Vercel 部署

```bash
npm install -g vercel
vercel login
vercel
```

- ✅ 永久免费
- ✅ 自动 HTTPS
- ✅ 全球 CDN
- ✅ GitHub 自动部署

---

## 🙏 致谢

本项目基于 [sinyu1012/Double-Color-Ball-AI](https://github.com/sinyu1012/Double-Color-Ball-AI) 进行了大幅功能扩展与重构，主要新增了：

- MetaAI 超级裁判综合预测机制
- 多维数据趋势分析仪表盘（遗漏分析、散点图、热力配色等）
- 完整的历史命中回溯与可视化
- GitHub Actions 全自动化流水线

感谢原作者提供的基础框架与思路。

---

## ⚠️ 免责声明

本网站展示的 AI 预测数据**仅供参考和研究使用，不构成任何购彩建议**。  
彩票开奖结果具有随机性，任何预测都无法保证中奖。  
请理性购彩，量力而行。

---

<p align="center">
  Made with ❤️ | Powered by AI | 仅供娱乐与统计研究
</p>

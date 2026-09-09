# 🎱 双色球 AI 智能预测与多维量化分析系统 (MoE v4.0)

<p align="center">
  <img src="images/image1.jpg" width="85%" alt="双色球 AI 预测系统界面预览" style="border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.12);">
</p>

<p align="center">
  <strong>基于混合专家模型 (MoE v4.0) + 50期量化特征工程 + 6大顶流 AI 矩阵 + 超级裁判双轨对冲裁决</strong>
</p>

<p align="center">
  <a href="https://dcb.kqsdw.com">🌐 在线体验 (Demo)</a> &nbsp;|&nbsp; 
  <a href="#-ai-预测架构-moe-v40">🔮 预测架构</a> &nbsp;|&nbsp; 
  <a href="#-推荐阵列与实战指南">🎟️ 推荐阵列</a> &nbsp;|&nbsp; 
  <a href="#-数据可视化与数论图表">📊 走势分析</a> &nbsp;|&nbsp; 
  <a href="#-本地运行与部署指南">🚀 部署指南</a>
</p>

---

## 🌟 项目简介

本项目是一套**开源、全自动化、高颜值**的双色球（SSQ）历史开奖数据深度挖掘与 AI 综合预测系统。

传统大模型在预测彩票时常常存在“数字幻觉”、模糊估算和容易扎堆相同号码的问题。本项目创新性地采用了 **Python 宿主端严谨量化统计 + 6 大异构 AI 独立推理 + MetaAI 超级裁判双轨对冲裁决** 的完整工业级方案：
1. **真实数据严谨统计**：在 Python 宿主端精确预计算近 50 期重号、邻号、加权热度、上升动量、极值遗漏和 012 路振幅，杜绝大模型心算偏差；
2. **六大顶级模型矩阵**：全面接入来自 OpenAI、Anthropic、Google、xAI 四大领军厂商的 6 款旗舰模型多线程并发独立分析；
3. **MoE v4.0 双轨独立纠偏**：由 Claude Opus 超级裁判统筹全局，既吸纳多模型共识，又引入概率论硬约束强制打破同质化聚集，精选 5 注单式覆盖 20+ 个独立红球，实现全域概率网格化对冲防偏。

---

## ✨ 核心特性

- 🤖 **6 大顶级 AI 基础模型矩阵**：
  搭载 **GPT 120B**、**Claude Sonnet**、**Claude Opus**、**Gemini 3.1 Pro**、**Gemini 3.8 Flash** 以及 **Grok 4.20**，兼顾大参数深层模式挖掘、极速推理与异构多元思维。
- 🧠 **MoE 超级裁判 (v4.0 双轨对冲版)**：
  终极预测由裁判 AI 站在 MoE 全局高度进行数学硬约束筛选，彻底杜绝前端无序随机凑号。
- 📈 **宿主端 Python 特征工程 (50 期深度窗口)**：
  在输入大模型前完成 10/30/50 期加权热度、动态趋势分、全历史精准遗漏、蓝球 012 路与黄金振幅 `[2, 7]` 预计算，从根源消除模型幻觉。
- 🎟️ **科学实战推荐矩阵**：
  提供 5 注单式、7+1/6+4/8+2 经济实用小复式、2胆5拖/3胆4拖/4胆4拖高防守胆拖组合，满足不同预算策略需求。
- 📊 **专业级走势与数论图表库**：
  包含红球热度·遗漏复合图（支持号码/频次/遗漏排序）、蓝球动态走势振幅追踪图、红球三态走势（重号/邻号/连号）、012 路与指标胶囊导航。
- 🎯 **全自动历史命中回溯评测**：
  自动比对历史各期真实开奖结果，精确记录并生成各大 AI 模型的历史命中走势对比折线图。
- ⚡ **全自动 CI/CD 无人值守流水线**：
  GitHub Actions 定时爬取最新开奖结果 + 多线程并发生成新一期预测 + 自动归档 + 联动 Vercel 秒级部署。
- 🐳 **现代轻量化部署体系**：
  支持 Vercel 静态托管、Docker 一键容器化运行、Nginx 动静分离与本地一键极速启动。

---

## 🔮 AI 预测架构 (MoE v4.0)

```mermaid
graph TD
    A[福彩官方最新历史开奖数据] --> B[Python 宿主端特征工程引擎 (50期窗口)]
    B -->|重号/邻号池| C[Prompt 结构化量化指令]
    B -->|10/30/50期加权热度| C
    B -->|动量上升分 & 遗漏预警| C
    B -->|蓝球012路 & 黄金振幅| C
    
    C --> D1[GPT 120B]
    C --> D2[Claude Sonnet]
    C --> D3[Gemini 3.1 Pro]
    C --> D4[Claude Opus]
    C --> D5[Gemini 3.8 Flash]
    C --> D6[Grok 4.20]
    
    D1 & D2 & D3 & D4 & D5 & D6 -->|并发产出各5组策略预测| E[MetaAI 超级裁判 (MoE v4.0)]
    
    E -->|双轨独立纠偏机制| F1[5注单式 (覆盖20+独立红球)]
    E -->|全局硬约束筛选| F2[三大预算复式阵列]
    E -->|蓝球012路对冲| F3[科学矩阵胆拖阵]
    
    F1 & F2 & F3 --> G[ai_predictions.json 自动存档与前端展示]
```

### 1. 宿主端严谨量化统计
在调用任何大模型前，Python 脚本完成高精度统计并以 Markdown 结构化紧凑格式注入 Prompt：
- **加权热度**：`近10期出现数 * 5 + 近30期出现数 * 3 + 近50期出现数 * 2`
- **动量趋势**：`短期相对频率 - 长期相对频率`，捕捉正处于上升期的活跃号
- **马尔可夫继承池**：自动提取上期红球的重复传承候选池与左右相邻斜连号候选池（统计占开奖 70%~80%+）
- **蓝球多维属性**：上一期 012 路归属、近 20 期热态蓝球、7~16 期均值回归温冷蓝球、区间振幅 `[2, 7]` 推荐

### 2. 6 大 AI 旗舰基础模型分工矩阵

| 厂商 | 模型名称 | API 模型标识 | 算法与策略倾向 |
| :--- | :--- | :--- | :--- |
| **OpenAI** | **GPT 120B** | `gpt-oss-120b-medium` | 宏观统计模式识别，善于捕捉大样本分布概率与均衡结构 |
| **Anthropic** | **Claude Sonnet** | `claude-sonnet-4-6` | 精密逻辑推演，擅长区间比、奇偶比与和值约束计算 |
| **Google** | **Gemini 3.1 Pro** | `gemini-3.1-pro-low` | 超长上下文趋势关联，敏锐捕获多周期跨度规律 |
| **Anthropic** | **Claude Opus** | `claude-opus-4-6-thinking` | 深度思维链（Thinking），作为基准模型并兼任超级裁判 |
| **Google** | **Gemini 3.8 Flash** | `gemini-3.8-flash-high` | 高响应低延迟，聚焦近期高频爆发号与短期波动 |
| **xAI** | **Grok 4.20** | `grok-4.20-fast` | 异构探索思维，打破主流模型共识锁定，挖掘冷态奇袭号 |

### 3. MetaAI 超级裁判双轨裁决机制
- **共识提炼**：聚合并统计 6 个模型共 30 组预测的红蓝球投票频次，提炼核心共识池；
- **反同质化纠偏**：坚决破除传统 AI 扎堆预测单张蓝球（如死锁在 04/05）的弊端，实施蓝球 012 路全包与大小号对冲（小号 01~08 + 大号 09~16 搭配）；
- **20+ 独立红球全域覆盖**：精选的 5 注单式之间进行差分对冲，强制覆盖 20 个以上的不同红球，极大提高中奖网格的捕捉概率。

---

## 🎟️ 推荐阵列与实战指南

系统将裁判 AI 输出的黄金候选池转化为面向不同玩法的实战组合：

| 方案类别 | 具体方案 | 预算金额 | 核心策略优势 |
| :--- | :--- | :---: | :--- |
| **精选单式** | **5 注精选单式** | 10 元 | 裁判直接裁决，5 注号码覆盖 20+ 个独立红球，攻守兼备 |
| **实用小复式** | **7+1 经济小复式** | 14 元 | 在保本前提下增加 1 枚红球容错率，性价比极高 |
| **实用小复式** | **6+4 蓝球全防复式** | 8 元 | 锁定高置信红球，蓝球四路全防（兼顾012路与大小号） |
| **实用小复式** | **8+2 均值大底复式** | 112 元 | MoE 全局大底，覆盖核心共识号 + 均值回归温冷号 |
| **科学胆拖阵** | **2胆5拖2蓝 (精炼型)** | 20 元 | 锁定 2 枚极高概率胆码，以极低预算实现大底覆盖 |
| **科学胆拖阵** | **3胆4拖2蓝 (均衡型)** | 8 元 | 3 枚主心骨红球带 4 枚拖码，击中胆码即获倍增收益 |
| **科学胆拖阵** | **4胆4拖2蓝 (强攻型)** | 24 元 | 超级裁判推荐口袋，高密度捕获目标区域 |

---

## 📊 数据可视化与数论图表

系统内置基于 Chart.js 深度定制的响应式专业图表库，支持 30/50/100/全部 周期自由切换：

1. **红球热度分布 · 遗漏复合图**：
   柱状热度渐变 + 遗漏折线复合展示，支持按“号码顺序”、“出现频次”、“遗漏期数”一键排序切换。
2. **蓝球期号动态走势与振幅追踪**：
   上方折线清晰标出 01-08 小区与 09-16 大区背景色带；下方柱状图动态显示相邻期振幅（位移跨度）。
3. **红球三态走势图**：
   直观呈现每期相比上期的“重号数（重复传承）”、“邻号数（斜连号）”与“连码组数”。
4. **数论指标分析**：
   一键切换和值曲线（附 90~120 黄金带）、跨度走势、AC 值复杂度分析与 012 路比例分布图。
5. **极冷号码 Top 5 预警看板**：
   自动提取当前遗漏最大的红球与蓝球，提供均值回归窗口提醒。

---

## 📁 项目结构

```
Double-Color-Ball-AI/
├── index.html                     # 前端主页面 (响应式 SPA 单页架构)
├── css/
│   └── style.css                  # 全局精细主题样式、图表与卡片动画
├── js/
│   ├── app.js                     # 核心交互、Tab 导航与 Chart.js 图表渲染
│   ├── components.js              # 彩票球、模型卡片、复式表格与推荐阵列组件
│   └── data-loader.js             # 异步数据加载与缓存调度
├── data/
│   ├── lottery_history.json       # 历史开奖全量数据库 (官方源自动同步)
│   ├── ai_predictions.json        # 当前最新一期 6 模型与 MetaAI 预测结果
│   └── predictions_history.json   # 历期预测归档与命中回溯数据库
├── fetch_history/
│   └── fetch_lottery_history.py   # 中国福彩网官方数据自动化抓取爬虫
├── prompts/
│   └── meta_prompt_template.txt   # MetaAI 超级裁判 MoE Prompt 模板
├── doc/
│   └── prompt2.0.md               # 基础模型 50 期量化预测 Prompt 模板
├── generate_ai_prediction.py      # AI 预测核心生成引擎 (多线程并发 + 特征工程)
├── test_prediction.py             # 预测结果数据结构与 MoE 规范自动化测试脚本
├── Dockerfile                     # 极轻量 Alpine Nginx 生产级镜像构建文件
├── docker-compose.yml             # Docker Compose 容器编排配置 (支持数据实时热挂载)
├── nginx.conf                     # 生产环境 Nginx 反向代理与动静分离配置
└── .github/workflows/
    ├── update-lottery-data.yml    # 开奖日爬虫自动化工作流
    └── generate-ai-prediction.yml # 预测全自动生成、归档与推送工作流
```

---

## 🔄 全自动运行流水线

```text
[官方开奖 (二/四/日 21:15)]
         │
         ▼
[GitHub Actions: Update Lottery Data (21:40)] ──> 爬取最新开奖并推送到仓库
         │
         ▼ (自动联动触发)
[GitHub Actions: Generate AI Prediction]
         ├─ 1. 读取上期预测，与刚开出的奖号比对，计算命中并归档到 predictions_history.json
         ├─ 2. 执行 Python 特征工程，生成近 50 期量化统计数据
         ├─ 3. 并发调用 6 大模型 (GPT 120B / Claude / Gemini / Grok)
         ├─ 4. 调用 Claude Opus 超级裁判执行 MoE 双轨裁决
         ├─ 5. 自动备份并安全原子写入 ai_predictions.json
         └─ 6. Commit 并 Push 最新数据回 GitHub 仓库
         │
         ▼ (自动监听 Push)
[Vercel / 本地 WebHook] ──> 秒级重新发布上线，用户即刻刷新可见最新预测
```

---

## 🚀 本地运行与部署指南

### 1. 本地快速预览（无需安装任何重量级环境）

只需本地安装有 Python 3：
```bash
# 进入项目根目录
cd Double-Color-Ball-AI

# 启动简易 HTTP 服务器 (Windows / macOS / Linux 通用)
python -m http.server 8000
```
浏览器打开 `http://localhost:8000` 即可访问。

> ⚠️ **注意**：请勿直接双击在浏览器中打开 `index.html`，浏览器的安全同源策略（CORS）会拦截本地 JSON 文件的加载，必须通过 HTTP 服务访问。

---

### 2. Docker & Docker Compose 一键容器化部署（推荐企业与服务器）

本项目已预置高度优化的 Alpine Nginx Docker 环境，支持**宿主机数据热挂载**（定时更新宿主机 `data/` 目录时，网页容器无需重新构建即可即时呈现最新数据）：

```bash
# 使用 Docker Compose 后台启动
docker compose up -d

# 查看运行状态
docker compose ps

# 停止运行
docker compose down
```
服务将在宿主机 `8080` 端口启动，访问 `http://你的服务器IP:8080` 即可。

若要自定义端口，只需在启动时传入环境变量：
```bash
PORT=80 docker compose up -d
```

---

### 3. Vercel 免费一键托管（自动化云端部署）

本项目完全基于纯前端静态资源 + 静态 JSON，支持免费部署到 Vercel：

1. 将本项目 Fork 或推送至您的 GitHub 仓库；
2. 登录 [Vercel](https://vercel.com)，点击 **"Add New Project"**；
3. 选择刚才导入的 GitHub 仓库，框架预设选择 **Other**，根目录保持为 `./`；
4. 点击 **Deploy**，约 10 秒后即可获得全球 CDN 加速的访问域名；
5. 后续 GitHub Actions 每次推送新开奖或新预测数据，Vercel 均会自动触发秒级热更新。

---

## 💻 手动执行 AI 预测生成脚本

如果您需要在本地测试或手动运行预测引擎，请先准备好 API 密钥（兼容 OpenAI 规范的聚合中转或官方 API）：

#### Windows (PowerShell):
```powershell
# 设置环境变量
$env:AI_API_KEY="您的_API_KEY"
$env:AI_BASE_URL="https://aihubmix.com/v1" # 或您自定义的中转代理地址

# 安装依赖
pip install openai

# 执行生成
python generate_ai_prediction.py
```

#### Linux / macOS:
```bash
export AI_API_KEY="您的_API_KEY"
export AI_BASE_URL="https://aihubmix.com/v1"

pip install openai

python3 generate_ai_prediction.py
```

#### 校验数据完整性：
```bash
python test_prediction.py
```

---

## ⚙️ GitHub Actions 自动化配置

若要在您自己的 GitHub 仓库中开启全自动流水线，只需在仓库中配置以下 GitHub Secrets：

1. 打开 GitHub 仓库，进入 `Settings` -> `Secrets and variables` -> `Actions`；
2. 点击 **New repository secret**，添加：
   - `AI_API_KEY`: 您的 API 访问密钥
   - `AI_BASE_URL`: API 接口端点（如 `https://aihubmix.com/v1`）
3. 确保仓库 Settings -> Actions -> General -> **Workflow permissions** 设置为 **Read and write permissions**（允许 Action 自动推送更新后的 JSON 文件）。

---

## ⚠️ 免责声明 (Disclaimer)

1. 本系统所展示的所有开奖数据、统计指标与 AI 预测结果**仅供技术交流、概率与机器学习算法研究、数据可视化展示及娱乐使用**。
2. **本系统不构成任何购彩、投注或投资建议**。
3. 彩票属于严格的随机独立事件，任何数学统计规律与人工智能模型均无法预测绝对中奖结果。请保持理性心态，切勿盲目沉迷！

---

<p align="center">
  Made with ❤️ by Double Color Ball AI Team<br/>
  <strong>Powered by 喀秋莎电玩</strong>
</p>

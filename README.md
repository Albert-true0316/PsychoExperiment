# 认知卸载实验平台

> 《云端的记忆2.0：大语言模型作为认知卸载伙伴对大学生陈述性记忆与元认知校准的影响》

## 研究引言

### 研究背景
经典“谷歌效应（Google Effect）”表明：当个体预期信息可由外部系统再次检索时，其对信息本身的编码与保持会下降，而对“信息存放位置或检索线索”的记忆会增强。既有研究多基于搜索引擎情境。随着大语言模型（LLM）成为高频使用的信息伙伴，外部记忆支持已从“关键词检索”扩展为“对话式调用”。因此，有必要在 LLM 参与条件下重新检验并拓展谷歌效应，并进一步考察其对元认知判断的影响机制。

### 研究目的
本实验旨在比较 `control`、`cloud`、`ai` 三种条件下被试在陈述性记忆任务中的表现差异，重点考察：
- 外部可得性预期是否降低 List A 的记忆成绩；
- 当 List B 明确“不可再次呈现”时，是否出现资源释放或策略回调；
- 被试的元认知预测是否与真实表现一致，以及不同条件下校准误差是否变化。

### 研究创新点
- **理论拓展：** 将经典谷歌效应从“搜索引擎检索情境”拓展到“LLM 对话式外部记忆情境”。
- **操纵分化：** 并行设置 `cloud` 与 `ai` 两类外部支持，区分“云端保存线索”与“AI 伙伴线索”的影响差异。
- **机制整合：** 在行为成绩之外引入操纵检查与元认知指标，联合评估“客观表现-主观判断-操纵有效性”的关系链。
- **边界条件：** 通过 List B 的“不可再次呈现”提示，检验策略回调与资源释放的可能边界。

### 研究问题与假设
围绕“LLM 参与条件下谷歌效应是否再现并发生机制变化”这一核心问题，本研究提出以下可检验假设：

- H1（认知卸载主效应）：与 `control` 组相比，`cloud` 与 `ai` 组在 List A 测验中的客观记忆成绩显著降低。  
  **字段映射：** 自变量 `condition`；因变量 `listA_score`；协变量建议 `baseline_score`、`ai_freq`、`excluded`。

- H2（卸载强度差异假设）：与 `cloud` 组相比，`ai` 组在 List A 成绩上的下降幅度更大（即 `ai < cloud`）。  
  **字段映射：** 自变量 `condition`（重点比较 `ai` vs `cloud`）；因变量 `listA_score`。

- H3（操纵有效性假设）：三组在“可再次查看/呈现预期”及“提示语可信度”上存在显著组间差异，且方向与实验操纵一致。  
  **字段映射：** 自变量 `condition`；操纵检查因变量 `manip_a_represent`、`manip_b_represent`、`manip_instruction_trust`；行为辅助指标 `blocked_view_attempts_listb`（用于描述或稳健性分析）。

- H4（元认知校准假设）：被试对自身记忆表现存在系统性偏差，且该偏差在不同组别间的幅度不同。  
  **字段映射：** 预测变量 `metacog_pred_a`、`metacog_pred_b`；实际表现 `listA_score`、`listB_score`；派生指标 `metacog_error_a`、`metacog_error_b`（由导出数据自动计算）；组别变量 `condition`。

- H5（资源回调/释放探索假设）：在 List B 明确“不可再次呈现”条件下，组间差异可能减弱或出现回调。  
  **字段映射：** 自变量 `condition`；因变量 `listB_score`；可结合 `manip_b_represent` 与 `manip_instruction_trust` 做稳健性检验。

## 项目结构

```
experiment/
├── backend/
│   ├── main.py          # FastAPI 主应用（5个API接口）
│   ├── database.py      # SQLite 数据库操作
│   ├── models.py        # Pydantic 数据模型
│   └── export.py        # CSV 导出逻辑
├── frontend/
│   ├── index.html       # 实验入口页面
│   ├── experiment.js    # jsPsych 实验主流程
│   ├── listA_cloud.html # 云端组：已保存内容查看页
│   ├── ai_chat.html     # AI组：伪AI对话界面
│   ├── stimuli/
│   │   ├── listA.json   # List A 题库（20题）
│   │   ├── listB.json   # List B 题库（20题）
│   │   └── baseline.json# 基线题库（10题）
│   └── styles/
│       └── main.css     # 全局样式（所有页面统一引用）
├── data/
│   └── participants.db  # SQLite 数据库（自动生成）
├── requirements.txt
└── README.md
```

## 实验设计

**单因素三水平组间设计**，随机分配被试至以下三组：

| 组别 | 操纵 | 理论预期 |
|------|------|----------|
| 控制组 (control) | 无保存提示 | List A 成绩最高基准 |
| 云储存组 (cloud) | 模拟文件保存进度条，可查看已保存内容 | List A 成绩下降 |
| AI卸载组 (ai) | 伪AI对话界面，可查询已保存内容 | List A 成绩下降最多 |

### 实验1（独立实验，主效应检验）
实验1用于检验 LLM 参与条件下谷歌效应是否再现，以及其与操纵检查与元认知指标的关系。

**实验1流程（约45分钟）：**
1. 知情同意
2. 筛查问卷（年龄、AI使用频率、记忆自评、是否了解相关研究）
3. 基线记忆测试（10题，作为协变量）
4. 学习阶段1：List A（20题 × 5000ms）
5. 实验操纵（List A 后按组别呈现不同界面）
6. 学习阶段2：List B（20题 × 5000ms，cloud/ai 组明确提示本阶段不会再次呈现）
7. 干扰任务（2分钟数学计算）
8. 突击测试：List A + List B 回忆
9. 使用体验反馈问卷（操纵核实）
10. 学习效果评估问卷（元认知）
11. 事后知情（Debriefing）

**实验1核心指标与字段映射：**
- **组别变量**：`condition`
- **客观记忆成绩**：`baseline_score`、`listA_score`、`listB_score`
- **操纵检查**：`manip_a_represent`、`manip_b_represent`、`manip_instruction_trust`
- **元认知**：`metacog_pred_a`、`metacog_pred_b`、`metacog_error_a`、`metacog_error_b`
- **行为辅助指标**：`blocked_view_attempts_listb`

### 实验2（独立实验，机制检验）：学习阶段双任务（听音按键）
在确认采用“两项独立实验”设计后，实验2将作为**单独版本**运行（招募新样本），用于检验“认知卸载是否体现为编码阶段内部资源占用的变化”。实验2在 **List A 与 List B 的学习阶段**加入双任务（tone-discrimination），并以逐事件数据作为机制指标，而非替代实验1的主效应指标。

**实验2用于解释实验1的机制不确定性：**
- **区分“卸载”与“干扰/负荷”**：实验1若出现 `cloud/ai` 组记忆成绩下降（如 `listA_score` 降低），仅凭成绩无法区分其来源是“将编码资源转移至外部系统（卸载）”，还是“界面/工具引发分心与额外负荷（干扰）”。实验2通过双任务 RT/ACC 作为在线资源占用指标，提供对两种机制的可检验区分。
- **检验策略回调/资源释放是否真实发生**：实验1中 List B 的变化（`listB_score`）可能混入疲劳、练习或材料差异。实验2在 A/B 均加入双任务，可使用被试内变化指标（\(\Delta RT=RT_B-RT_A\)、\(\Delta ACC=ACC_B-ACC_A\)）更直接评估在“不可再次呈现”提示后资源分配是否回调。
- **补充解释元认知偏差来源**：实验1的 `metacog_error_a/b` 反映预测—表现偏差，但其来源可能是监控失败或策略错配。实验2提供“编码投入/资源占用”的额外证据，使对元认知偏差的解释更机制化（例如：投入下降但预测不降 → 把握感错觉风险更大）。

**双任务说明（最小科学实现）：**
- **任务**：在被试阅读陈述的 5 秒内，随机播放一次高/低音；高音按 `J`，低音按 `F`。
- **出现概率**：每条陈述随机 0/1 次音调（示例：70% 有音调，30% 无音调），避免可预测性。
- **出现时机**：在 5 秒内随机（示例：800–4200ms），避免固定时间点导致策略化反应。
- **反应窗口**：音调出现后 1500ms 内记为有效反应；超时记为漏答。
- **练习**：正式开始前加入 10–20 次练习（建议准确率 ≥70% 方可进入正式），以确保理解规则。
- **控制要求**：建议佩戴耳机、固定音量、安静环境；记录浏览器/系统信息用于噪声控制。

**建议记录（逐事件 trial-level data）：**
`participant_id`、`condition`、`phase`(A/B)、`item_index`、`tone_type`(high/low)、`correct_key`(F/J)、`key_pressed`、`rt_ms`、`is_correct`(1/0)、`onset_ms`（音调出现时间点）

**核心派生指标（用于机制分析）：**
- 双任务准确率（ACC）与正确反应 RT（建议中位数）
- **双任务成本变化**：\(\Delta RT = RT_B - RT_A\)、\(\Delta ACC = ACC_B - ACC_A\)（被试内变化更能抵消设备差异）

## 操纵说明

### 云储存组 (cloud)
- List A 学习开始前提示：本阶段材料将被云端保存，后续可查看
- List A 学习后呈现进度条动画，提示内容已保存至云端
- 页面左上角出现「listA」按钮，**测试开始前**可点击查看 `listA_cloud.html`（展示全部20条陈述）
- **测试开始后**点击按钮提示「文件已损毁，无法查看」；已打开的查看页同步清空内容并显示损毁提示（通过 `localStorage` 跨标签页通信实现）
- List B 学习开始前提示：本阶段材料不会被云端保存，且不会再次呈现

### AI卸载组 (ai)
- List A 学习开始前提示：本阶段材料将提供给 AI 助手，后续可查询
- List A 学习后呈现伪AI对话确认界面
- 页面左上角出现「AI 助手」按钮，**测试开始前**可点击打开 `ai_chat.html`（本地伪AI，预设了对 listA 内容的关键词匹配回答）
- **测试开始后**点击按钮提示「AI 助手已断开连接」；已打开的对话页同步清空记录并禁用输入框
- 伪AI可正确回答「我学了什么」及各知识点相关提问，能抵御「你是真的AI吗」等戳穿型问题
- List B 学习开始前提示：本阶段材料不会提供给 AI 助手，且不会再次呈现

## 快速启动

### 1. 安装依赖

```bash
cd experiment
pip3 install -r requirements.txt
```

### 2. 本地启动（仅本机调试）

```bash
cd experiment
export DB_PATH=./data/participants.db
python3 -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```

本机访问：`http://localhost:8000`

### 3. 本地局域网部署（正式收数推荐）

适用场景：被试与主试在同一实验室/同一可互通内网（同一 WiFi 或有线局域网均可，不要求 WiFi 名称相同）。

**主试电脑启动服务：**

```bash
cd experiment
export DB_PATH=./data/participants_exp1.db
python3 -m uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

**查看本机局域网 IP（Mac）：**

```bash
ipconfig getifaddr en0
```

假设输出为 `192.168.1.23`，则发给被试的链接为：

```
http://192.168.1.23:8000
```

**收数前 30 秒自检（必做）：**
- 主试机先打开 `http://localhost:8000` 确认服务正常
- 被试机浏览器打开 `http://192.168.1.23:8000`（不要用 localhost）
- 若被试机打不开：检查是否在同一可互通内网、Mac 防火墙是否放行 8000、路由器是否开启 AP 隔离

**正式收数注意：**
- 实验期间主试电脑不要休眠/关机
- 正式链接不要带 `?condition=`（仅开发调试使用）
- 每收 5–10 名被试导出一次备份：

```bash
curl http://127.0.0.1:8000/api/export -o data/results_$(date +%F).csv
cp data/participants_exp1.db data/backup/participants_exp1_$(date +%F).db
```

**实验1 / 实验2 本地并行（可选，两个端口）：**

| 实验 | 分支 | 端口 | DB_PATH |
|------|------|------|---------|
| 实验1 | main | 8000 | `./data/participants_exp1.db` |
| 实验2 | exp2 | 8001 | `./data/participants_exp2.db` |

### 4. 查看API文档

`http://localhost:8000/api/docs`

### 5. 调试指定组别

URL 后加 `?condition=` 参数可强制覆盖随机分组，仅用于开发调试：

```
http://localhost:8000/?condition=cloud
http://localhost:8000/?condition=ai
http://localhost:8000/?condition=control
```

正式收数据时不带参数，服务器自动均衡分配。

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/register` | 注册被试，返回随机分配的组别 |
| POST | `/api/submit` | 提交作答数据 |
| POST | `/api/questionnaire` | 提交问卷数据 |
| POST | `/api/dual_task` | 批量提交双任务逐事件数据（Exp2） |
| GET | `/api/export` | 导出全部被试汇总 CSV |
| GET | `/api/export/dual_task` | 导出双任务逐事件长表 CSV（Exp2） |
| GET | `/api/status` | 查看三组当前人数 |

## 导出数据

```bash
curl http://localhost:8000/api/export -o data/results.csv
# Exp2 双任务长表
curl http://127.0.0.1:8001/api/export/dual_task -o data/dual_task_events.csv
```

CSV 主要字段说明：

| 字段 | 说明 |
|------|------|
| participant_id | 被试唯一ID |
| condition | 组别：control / cloud / ai |
| age | 年龄 |
| ai_freq | 每日AI使用频率（1-7） |
| mem_self | 记忆能力自评（1-7） |
| excluded | 是否了解相关研究（1=是，作为协变量，不排除） |
| baseline_score | 基线正确题数（0-10） |
| listA_score | List A 正确题数（0-20） |
| listB_score | List B 正确题数（0-20） |
| manip_a_represent | List A 阶段是否预期可再次查看/调用（1=是, 0=否） |
| manip_b_represent | List B 阶段是否预期会再次呈现（1=是, 0=否） |
| manip_instruction_trust | 对“是否再次呈现”提示语的可信度（1-7） |
| metacog_pred_a | 预测 List A 答对题数 |
| metacog_pred_b | 预测 List B 答对题数 |
| cognitive_dep | 对工具辅助功能满意度（1-7） |
| suspected_deception | 是否怀疑实验目的与说明不符（1/0） |
| blocked_view_attempts_listb | List B 阶段尝试访问 cloud/AI 但被拦截的次数 |
| （实验2）dual_task_* | 双任务逐事件或汇总指标（如 `tone_type`、`rt_ms`、`is_correct`、`onset_ms`；实验2建议独立表/独立导出） |

## 清空实验数据

**方式一（推荐，保留表结构）：**
```bash
sqlite3 data/participants.db "DELETE FROM responses; DELETE FROM questionnaires; DELETE FROM participants;"
```

**方式二（彻底删除，下次启动自动重建）：**
```bash
rm data/participants.db
```

## UI 定制

所有页面（主实验、云端查看页、AI对话页）统一引用 `frontend/styles/main.css`。
修改 `:root` 中的 CSS 变量即可全局生效：

```css
:root {
  --bg: #000000;          /* 背景色 */
  --accent: #8e84f2;      /* 主色调（标题、按钮、徽标） */
  --accent2: #6c62d4;     /* 悬停色 */
  --card-bg: ...;         /* 卡片背景 */
  --text-main: #ffffff;   /* 正文颜色 */
  --text-muted: #86868b;  /* 辅助文字颜色 */
  --radius: 20px;         /* 卡片圆角 */
  --radius-sm: 12px;      /* 小元素圆角 */
}
```

## 分析建议

**主分析：**
- 单因素 ANOVA：因变量 `listA_score`，组间因素 `condition`（三水平）
- 事后检验：Tukey HSD 两两比较
- 协变量：`baseline_score`、`ai_freq`、`excluded`（是否了解相关研究）
- 若违反方差齐性则改用 Welch's ANOVA

**资源释放假设（List B）：**
- 单因素 ANOVA：因变量 `listB_score`，组间因素 `condition`

**操纵成功检验（新增）：**
- `manip_a_represent`（List A 是否预期可再次查看/调用）：三组列联表 + 卡方检验（或二项 logistic 回归）
- `manip_b_represent`（List B 是否预期会再次呈现）：三组列联表 + 卡方检验（重点检验 cloud/ai 组“不会再次呈现”比例是否更高）
- `manip_instruction_trust`（对提示语可信度）：单因素 ANOVA（若分布偏态可改 Kruskal-Wallis）

**主效应稳健性分析（可选）：**
- ANCOVA：`listA_score ~ condition + baseline_score + ai_freq + excluded + manip_instruction_trust`
- ANCOVA：`listB_score ~ condition + baseline_score + ai_freq + excluded + manip_instruction_trust`

**元认知分析：**
- 独立样本 t 检验：`metacog_error_a`（预测值−实际值），控制组 vs. AI卸载组
- 单样本 t 检验：各组 `metacog_error` 是否显著大于 0（验证普遍高估）

**双任务机制分析（实验2）：**
- 质量控制：双任务准确率（ACC）过低者可设阈值剔除或做敏感性分析（例如 ACC < 60%）
- 主要检验：`condition × phase(A/B)` 对双任务 RT/ACC 的交互（更贴合“策略回调/资源释放”逻辑）
- 关联/解释：双任务指标与 `listA_score/listB_score`、`metacog_error_a/metacog_error_b` 的相关或回归（作为机制证据，不将其等同于记忆成绩）

**论文结果报告模板（可直接套用）：**
- ANOVA：`F(df1, df2) = x.xx, p = .xxx, η²p = .xx`；事后比较使用 Tukey HSD，报告组间均值差、95% CI 与校正后 p 值
- Welch ANOVA（方差不齐时）：`Welch's F(df1, df2) = x.xx, p = .xxx`；事后比较建议 Games-Howell
- ANCOVA：先报告协变量效应，再报告 `condition` 主效应：`F(df1, df2) = x.xx, p = .xxx, η²p = .xx`
- 卡方检验（操纵成功）：`χ²(df, N = n) = x.xx, p = .xxx, Cramer's V = .xx`
- 二项 Logistic（可选）：`OR = x.xx, 95% CI [LL, UL], p = .xxx`（以 control 为参照，比较 cloud/ai）
- t 检验：`t(df) = x.xx, p = .xxx, d = .xx`；单样本 t 检验需同时报告检验值（通常为 0）

**一句话结论写法示例：**
- “与 control 组相比，cloud/ai 组在 `listA_score` 上显著更低，支持认知卸载导致即时记忆下降。”
- “在 `listB_score` 上三组差异（显著/不显著），表明资源释放效应（存在/有限）。”
- “`manip_a_represent` 与 `manip_b_represent` 的组间差异显著，说明操纵成功建立了‘可再次呈现/不可再次呈现’预期。”
- “`manip_instruction_trust` 与主效应方向一致（或不一致），提示结果（稳健/可能受提示可信度调节）。”

**统计分析流程（推荐顺序）：**
- 第一步：数据清洗与描述统计（样本量、各组均值/标准差、缺失值、异常值规则）
- 第二步：操纵成功检验（`manip_a_represent`、`manip_b_represent`、`manip_instruction_trust`）
- 第三步：主效应检验（`listA_score`、`listB_score` 的 ANOVA/Welch）
- 第四步：稳健性模型（ANCOVA，纳入 `baseline_score`、`ai_freq`、`excluded`、`manip_instruction_trust`）
- 第五步：元认知分析（`metacog_error_a`、`metacog_error_b` 的组间/组内检验）
- 第六步：多重比较与效应量汇报（Tukey 或 Games-Howell；报告 η²p / d / OR / Cramer's V）

**方法与结果写作提示：**
- 在方法部分明确：随机分组方式、提示语操纵位置（List A 前、List B 前）、欺骗设计与事后知情流程。
- 在结果部分按“操纵成功 -> 主效应 -> 稳健性 -> 元认知”顺序报告，避免跳跃叙述。
- 若结果不显著，仍需报告效应量与置信区间，并讨论统计功效与理论含义。

## 注意事项

- 正式实验前务必完成预实验（n=5），核查操纵界面可信度
- 确保每台电脑使用独立浏览器窗口，不共享 session
- 数据收集完毕后立即备份 `data/participants.db`
- 论文方法部分需说明欺骗设计已通过伦理审查（或豁免）
- `excluded=1` 的被试数据正常保留，分析时作为协变量控制，不从样本中排除

## 联系方式

如有问题，请联系研究负责人。

# 认知卸载实验平台

> 《云端的记忆2.0：大语言模型作为认知卸载伙伴对大学生陈述性记忆与元认知校准的影响》

## 研究引言

### 研究背景
在数字环境中，个体会将“可被外部系统保存与检索的信息”从内部记忆转移到外部工具，这一现象常被称为认知卸载（cognitive offloading）。随着大语言模型（LLM）从“检索工具”转向“对话式伙伴”，其对学习阶段编码策略、延迟回忆表现与元认知判断的影响值得进一步检验。

### 研究目的
本实验旨在比较 `control`、`cloud`、`ai` 三种条件下被试在陈述性记忆任务中的表现差异，重点考察：
- 外部可得性预期是否降低 List A 的记忆成绩；
- 当 List B 明确“不可再次呈现”时，是否出现资源释放或策略回调；
- 被试的元认知预测是否与真实表现一致，以及不同条件下校准误差是否变化。

### 研究问题与假设
本研究围绕“外部可得性预期是否改变记忆编码与元认知判断”提出以下可检验假设：

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

**实验流程（约45分钟）：**
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

### 2. 启动服务

```bash
cd experiment
python3 -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

前端静态文件由 FastAPI 一并托管，直接访问：`http://localhost:8000`

### 3. 查看API文档

`http://localhost:8000/docs`

### 4. 调试指定组别

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
| GET | `/api/export` | 导出全部数据为 CSV |
| GET | `/api/status` | 查看三组当前人数 |

## 导出数据

```bash
curl http://localhost:8000/api/export -o data/results.csv
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

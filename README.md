# 认知卸载实验平台

> 《云端的记忆2.0：大语言模型作为认知卸载伙伴对大学生陈述性记忆与元认知校准的影响》

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
5. 实验操纵（按组别呈现不同界面）
6. 学习阶段2：List B（20题 × 5000ms）
7. 干扰任务（2分钟数学计算）
8. 突击测试：List A + List B 回忆
9. 使用体验反馈问卷（操纵核实）
10. 学习效果评估问卷（元认知）
11. 事后知情（Debriefing）

## 操纵说明

### 云储存组 (cloud)
- List A 学习后呈现进度条动画，提示内容已保存至云端
- 页面左上角出现「listA」按钮，**测试开始前**可点击查看 `listA_cloud.html`（展示全部20条陈述）
- **测试开始后**点击按钮提示「文件已损毁，无法查看」；已打开的查看页同步清空内容并显示损毁提示（通过 `localStorage` 跨标签页通信实现）

### AI卸载组 (ai)
- List A 学习后呈现伪AI对话确认界面
- 页面左上角出现「AI 助手」按钮，**测试开始前**可点击打开 `ai_chat.html`（本地伪AI，预设了对 listA 内容的关键词匹配回答）
- **测试开始后**点击按钮提示「AI 助手已断开连接」；已打开的对话页同步清空记录并禁用输入框
- 伪AI可正确回答「我学了什么」及各知识点相关提问，能抵御「你是真的AI吗」等戳穿型问题

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
| manip_check_bool | 是否相信内容已保存（1/0） |
| manip_trust | 保存过程信任度（1-7） |
| metacog_pred_a | 预测 List A 答对题数 |
| metacog_pred_b | 预测 List B 答对题数 |
| cognitive_dep | 对工具辅助功能满意度（1-7） |
| suspected_deception | 是否怀疑实验目的与说明不符（1/0） |

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

**元认知分析：**
- 独立样本 t 检验：`metacog_error_a`（预测值−实际值），控制组 vs. AI卸载组
- 单样本 t 检验：各组 `metacog_error` 是否显著大于 0（验证普遍高估）

## 注意事项

- 正式实验前务必完成预实验（n=5），核查操纵界面可信度
- 确保每台电脑使用独立浏览器窗口，不共享 session
- 数据收集完毕后立即备份 `data/participants.db`
- 论文方法部分需说明欺骗设计已通过伦理审查（或豁免）
- `excluded=1` 的被试数据正常保留，分析时作为协变量控制，不从样本中排除

## 联系方式

如有问题，请联系研究负责人。

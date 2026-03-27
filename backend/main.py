from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path
import sqlite3
import random

from .database import init_db, get_conn
from .models import ParticipantIn, AssignOut, SubmitData, QuestionnaireData
from .export import generate_csv

app = FastAPI(title="认知卸载实验 API")

# 允许前端跨域请求（本地开发用）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# 静态文件路径（API 路由之后挂载）
frontend_path = Path(__file__).parent.parent / "frontend"


@app.on_event("startup")
def startup():
    init_db()


# ── 工具函数 ────────────────────────────────────────────────────────────────

CONDITIONS = ["control", "cloud", "ai"]


def balanced_assign() -> str:
    """均衡随机分组：优先分配当前人数最少的组。"""
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("""
        SELECT condition, COUNT(*) as n
        FROM participants
        GROUP BY condition
    """)
    counts = {row["condition"]: row["n"] for row in cur.fetchall()}
    conn.close()

    # 找出人数最少的组（可能有并列）
    min_n = min((counts.get(c, 0) for c in CONDITIONS), default=0)
    candidates = [c for c in CONDITIONS if counts.get(c, 0) == min_n]
    return random.choice(candidates)


# ── 路由 ────────────────────────────────────────────────────────────────────

@app.post("/api/register", response_model=AssignOut)
def register(data: ParticipantIn):
    """注册被试并分配实验条件。"""
    if data.forced_condition and data.forced_condition in CONDITIONS:
        condition = data.forced_condition
    else:
        condition = balanced_assign()
    excluded = 1 if data.knows_google_effect else 0  # 仅作协变量标记，不排除出实验

    conn = get_conn()
    try:
        conn.execute(
            "INSERT INTO participants (id, condition, age, ai_freq, mem_self, excluded) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (data.participant_id, condition, data.age,
             data.ai_freq, data.mem_self, excluded)
        )
        conn.commit()
    except sqlite3.IntegrityError:
        conn.close()
        raise HTTPException(status_code=400, detail="participant_id 已存在")
    conn.close()

    return AssignOut(participant_id=data.participant_id, condition=condition)


@app.post("/api/submit")
def submit_responses(data: SubmitData):
    """提交被试的作答数据。"""
    conn = get_conn()
    cur = conn.cursor()

    # 确认被试存在
    cur.execute("SELECT id FROM participants WHERE id=?", (data.participant_id,))
    if not cur.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="participant_id 不存在")

    cur.executemany(
        "INSERT OR IGNORE INTO responses "
        "(participant_id, list_type, item_index, question, correct_answer, "
        " participant_ans, is_correct, rt_ms) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [
            (data.participant_id, r.list_type, r.item_index,
             r.question, r.correct_answer, r.participant_ans,
             r.is_correct, r.rt_ms)
            for r in data.responses
        ]
    )
    conn.commit()
    conn.close()
    return {"status": "ok", "saved": len(data.responses)}


@app.post("/api/questionnaire")
def submit_questionnaire(data: QuestionnaireData):
    """提交问卷数据。"""
    conn = get_conn()
    try:
        conn.execute(
            "INSERT OR REPLACE INTO questionnaires "
            "(participant_id, manip_check_bool, manip_trust, "
            " metacog_pred_a, metacog_pred_b, cognitive_dep, suspected_deception) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (data.participant_id, data.manip_check_bool, data.manip_trust,
             data.metacog_pred_a, data.metacog_pred_b,
             data.cognitive_dep, data.suspected_deception)
        )
        conn.commit()
    finally:
        conn.close()
    return {"status": "ok"}


@app.get("/api/export", response_class=PlainTextResponse)
def export():
    """导出全部被试数据为CSV（研究者使用）。"""
    csv_text = generate_csv()
    if not csv_text:
        return PlainTextResponse("暂无数据", status_code=204)
    return PlainTextResponse(
        content=csv_text,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=experiment_data.csv"}
    )


@app.get("/api/status")
def status():
    """查看当前各组人数（研究者监控用）。"""
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("""
        SELECT condition, COUNT(*) as n
        FROM participants
        GROUP BY condition
    """)
    counts = {row["condition"]: row["n"] for row in cur.fetchall()}
    conn.close()
    return {
        "control": counts.get("control", 0),
        "cloud":   counts.get("cloud", 0),
        "ai":      counts.get("ai", 0),
        "total":   sum(counts.values())
    }


# 挂载前端静态文件（必须在所有 API 路由之后）
if frontend_path.exists():
    app.mount("/", StaticFiles(directory=str(frontend_path), html=True), name="static")

import csv
import io
from .database import get_conn


def generate_csv() -> str:
    """生成可被SPSS/R直接读取的CSV，每行一个被试。"""
    conn = get_conn()
    cur = conn.cursor()

    # 每个被试的汇总得分
    cur.execute("""
        SELECT
            p.id            AS participant_id,
            p.condition,
            p.age,
            p.ai_freq,
            p.mem_self,
            p.excluded,
            -- 基线得分
            SUM(CASE WHEN r.list_type='baseline' AND r.is_correct=1 THEN 1 ELSE 0 END)
                AS baseline_score,
            -- List A 得分
            SUM(CASE WHEN r.list_type='A' AND r.is_correct=1 THEN 1 ELSE 0 END)
                AS listA_score,
            -- List B 得分
            SUM(CASE WHEN r.list_type='B' AND r.is_correct=1 THEN 1 ELSE 0 END)
                AS listB_score,
            -- 问卷
            q.manip_check_bool,
            q.manip_trust,
            q.metacog_pred_a,
            q.metacog_pred_b,
            q.cognitive_dep,
            q.suspected_deception,
            -- 元认知校准误差
            (q.metacog_pred_a - SUM(CASE WHEN r.list_type='A' AND r.is_correct=1 THEN 1 ELSE 0 END))
                AS metacog_error_a,
            (q.metacog_pred_b - SUM(CASE WHEN r.list_type='B' AND r.is_correct=1 THEN 1 ELSE 0 END))
                AS metacog_error_b
        FROM participants p
        LEFT JOIN responses r ON r.participant_id = p.id
        LEFT JOIN questionnaires q ON q.participant_id = p.id
        GROUP BY p.id
        ORDER BY p.created_at
    """)

    rows = cur.fetchall()
    conn.close()

    if not rows:
        return ""

    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=rows[0].keys())
    writer.writeheader()
    writer.writerows([dict(r) for r in rows])
    return output.getvalue()

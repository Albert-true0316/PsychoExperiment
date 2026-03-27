import sqlite3
import os
from pathlib import Path

DB_PATH = Path(os.environ.get('DB_PATH', str(Path(__file__).parent.parent / 'data' / 'participants.db')))


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_conn()
    cur = conn.cursor()

    cur.executescript("""
    CREATE TABLE IF NOT EXISTS participants (
        id          TEXT PRIMARY KEY,
        condition   TEXT NOT NULL,       -- 'control' | 'cloud' | 'ai'
        age         INTEGER,
        ai_freq     INTEGER,             -- 每日AI使用频率 1-7
        mem_self    INTEGER,             -- 自评记忆能力 1-7
        excluded    INTEGER DEFAULT 0,   -- 1=排除（知道谷歌效应）
        created_at  TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS responses (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        participant_id  TEXT NOT NULL REFERENCES participants(id),
        list_type       TEXT NOT NULL,   -- 'A' | 'B' | 'baseline'
        item_index      INTEGER NOT NULL,
        question        TEXT,
        correct_answer  TEXT,
        participant_ans TEXT,
        is_correct      INTEGER,         -- 1 | 0
        rt_ms           INTEGER          -- 反应时（毫秒）
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_response_unique
        ON responses(participant_id, list_type, item_index);

    CREATE TABLE IF NOT EXISTS questionnaires (
        participant_id      TEXT PRIMARY KEY REFERENCES participants(id),
        manip_check_bool    INTEGER,     -- 是否相信内容被保存 1/0
        manip_trust         INTEGER,     -- 信任度 1-7
        metacog_pred_a      INTEGER,     -- 预测List A答对几题
        metacog_pred_b      INTEGER,     -- 预测List B答对几题
        cognitive_dep       INTEGER,     -- 认知依赖程度 1-7
        suspected_deception INTEGER      -- 事后是否怀疑过欺骗 1/0
    );
    """)

    conn.commit()
    conn.close()
    print(f"Database initialized at {DB_PATH}")

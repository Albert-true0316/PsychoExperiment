from pydantic import BaseModel
from typing import Optional, List


class ParticipantIn(BaseModel):
    participant_id: str
    age: int
    ai_freq: int       # 1-7
    mem_self: int      # 1-7
    knows_google_effect: bool  # True -> excluded
    forced_condition: Optional[str] = None  # 'control' | 'cloud' | 'ai' | None


class AssignOut(BaseModel):
    participant_id: str
    condition: str     # 'control' | 'cloud' | 'ai'


class ResponseItem(BaseModel):
    list_type: str     # 'A' | 'B' | 'baseline'
    item_index: int
    question: str
    correct_answer: str
    participant_ans: str
    is_correct: int    # 1 | 0
    rt_ms: Optional[int] = None


class SubmitData(BaseModel):
    participant_id: str
    responses: List[ResponseItem]


class QuestionnaireData(BaseModel):
    participant_id: str
    manip_check_bool: int      # 1/0
    manip_trust: int           # 1-7
    metacog_pred_a: int        # 0-20
    metacog_pred_b: int        # 0-20
    cognitive_dep: int         # 1-7
    suspected_deception: int   # 1/0

from pydantic import BaseModel, ConfigDict


class QuestionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    category: str
    text: str


class AnswerCount(BaseModel):
    value: str
    count: int


#answer counts for one group of respondents, e.g. everyone whose gender is "Female"
class GroupResults(BaseModel):
    group: str | None
    total: int
    counts: list[AnswerCount]


#how respondents answered a question, overall and optionally broken down by a demographic field or another question's answers
class QuestionResults(BaseModel):
    question: QuestionOut
    total: int
    counts: list[AnswerCount]
    group_by: str | None = None
    group_by_question: int | None = None
    groups: list[GroupResults] | None = None

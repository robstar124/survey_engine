from typing import Annotated, Literal, get_args

from fastapi import Depends, Query
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import Select, select
from sqlalchemy.orm import Session

from backend.core.database import get_db
from backend.models import Answer, Respondent

DbSession = Annotated[Session, Depends(get_db)]

#respondent columns that can be filtered on and used to break down results
DemographicField = Literal["gender", "age_band", "working_status", "region", "household_income", "work_organisation", "work_sector"]
DEMOGRAPHIC_FIELDS: tuple[str, ...] = get_args(DemographicField)


#query parameters for narrowing results down to a set of respondents; repeat a parameter to match any of several values
class RespondentFilters(BaseModel):
    model_config = ConfigDict(extra="forbid")

    gender: list[str] = []
    age_band: list[str] = []
    working_status: list[str] = []
    region: list[str] = []
    household_income: list[str] = []
    work_organisation: list[str] = []
    work_sector: list[str] = []
    min_age: int | None = Field(default=None, ge=0)
    max_age: int | None = Field(default=None, ge=0)
    #answers to other questions as "<question id>:<value>"; values for one question match any, separate questions must all match
    answer: list[str] = []

    #reject anything that isn't "<question id>:<value>", splitting on the first colon since values can contain one
    @field_validator("answer")
    @classmethod
    def check_answers(cls, answers : list[str]) -> list[str]:
        for answer in answers:
            question_id, _, value = answer.partition(":")
            if not question_id.isdigit() or not value:
                raise ValueError(f"answer filters look like <question id>:<value>, got {answer!r}")
        return answers

    #the answer filters as {question id: [values]}
    def answers_by_question(self) -> dict[int, list[str]]:
        grouped: dict[int, list[str]] = {}
        for answer in self.answer:
            question_id, _, value = answer.partition(":")
            grouped.setdefault(int(question_id), []).append(value)
        return grouped

    #add a where clause for every filter that was set; the query must select from or join Respondent
    def apply(self, statement : Select) -> Select:
        for field in DEMOGRAPHIC_FIELDS:
            values = getattr(self, field)
            if values:
                statement = statement.where(getattr(Respondent, field).in_(values))
        if self.min_age is not None:
            statement = statement.where(Respondent.actual_age >= self.min_age)
        if self.max_age is not None:
            statement = statement.where(Respondent.actual_age <= self.max_age)
        #a subquery per question, so this works whether or not the statement already joins Answer
        for question_id, values in self.answers_by_question().items():
            matching = select(Answer.respondent_id).where(Answer.question_id == question_id, Answer.value.in_(values))
            statement = statement.where(Respondent.serial_number.in_(matching))
        return statement


#fastapi hands every query parameter to the model, so an endpoint's own parameters live on a subclass rather than as
#separate arguments; otherwise extra="forbid" would reject them

#the filters plus how to break down a question's results
class ResultsQuery(RespondentFilters):
    group_by: DemographicField | None = None
    group_by_question: int | None = None


#the filters plus which page of respondents to return
class RespondentPageQuery(RespondentFilters):
    limit: int = Field(default=50, ge=1, le=500)
    offset: int = Field(default=0, ge=0)


Filters = Annotated[RespondentFilters, Query()]
ResultsParams = Annotated[ResultsQuery, Query()]
RespondentPageParams = Annotated[RespondentPageQuery, Query()]

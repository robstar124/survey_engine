from fastapi import APIRouter, HTTPException
from sqlalchemy import Select, func, select
from sqlalchemy.orm import aliased

from backend.dependencies import DbSession, ResultsParams
from backend.models import Answer, Question, Respondent
from backend.schemas import AnswerCount, GroupResults, QuestionOut, QuestionResults

router = APIRouter(prefix="/questions", tags=["questions"])


#fetch a question or 404
def get_question_or_404(db : DbSession, question_id : int) -> Question:
    question = db.get(Question, question_id)
    if question is None:
        raise HTTPException(status_code=404, detail=f"question {question_id} not found")
    return question

#start a query over the answers to one question, joined to the respondents who gave them
def select_answers(question_id : int, *columns) -> Select:
    """SELECT * FROM answer JOIN respondent WHERE answer.question_id = :question_id"""
    return select(*columns).select_from(Answer).join(Answer.respondent).where(Answer.question_id == question_id)

#turn (value, count) rows into counts sorted most common first
def to_counts(rows) -> list[AnswerCount]:
    counts = [AnswerCount(value=value, count=count) for value, count in rows]
    return sorted(counts, key=lambda answer_count: (-answer_count.count, answer_count.value))


@router.get("", response_model=list[QuestionOut])
def list_questions(db : DbSession, category : str | None = None):
    statement = select(Question).order_by(Question.id)
    if category is not None:
        statement = statement.where(Question.category == category)
    return db.scalars(statement).all()

@router.get("/categories", response_model=list[str])
def list_categories(db : DbSession):
    return db.scalars(select(Question.category).distinct().order_by(Question.category)).all()

@router.get("/{question_id}", response_model=QuestionOut)
def get_question(db : DbSession, question_id : int):
    return get_question_or_404(db, question_id)

#count each answer to a question among the filtered respondents, optionally split by a demographic field or by the answers to another question
@router.get("/{question_id}/results", response_model=QuestionResults)
def get_question_results(
    db : DbSession,
    question_id : int,
    filters : ResultsParams,
):
    group_by, group_by_question = filters.group_by, filters.group_by_question
    if group_by is not None and group_by_question is not None:
        raise HTTPException(status_code=422, detail="pass group_by or group_by_question, not both")
    question = get_question_or_404(db, question_id)

    overall = filters.apply(select_answers(question_id, Answer.value, func.count()).group_by(Answer.value))
    counts = to_counts(db.execute(overall).all())
    results = QuestionResults(question=QuestionOut.model_validate(question), total=sum(c.count for c in counts), counts=counts)

    if group_by is not None:
        group_column = getattr(Respondent, group_by)
        grouped = select_answers(question_id, group_column, Answer.value, func.count())
    elif group_by_question is not None:
        get_question_or_404(db, group_by_question)
        #outer join so respondents who skipped the other question still count, as a None group
        other = aliased(Answer)
        group_column = other.value
        grouped = select_answers(question_id, group_column, Answer.value, func.count()).outerjoin(
            other, (other.respondent_id == Answer.respondent_id) & (other.question_id == group_by_question)
        )
    else:
        return results

    rows_by_group: dict[str | None, list] = {}
    for group, value, count in db.execute(filters.apply(grouped.group_by(group_column, Answer.value))).all():
        rows_by_group.setdefault(group, []).append((value, count))
    groups = [GroupResults(group=group, total=sum(count for _, count in rows), counts=to_counts(rows)) for group, rows in rows_by_group.items()]
    results.group_by = group_by
    results.group_by_question = group_by_question
    results.groups = sorted(groups, key=lambda group: (group.group is None, group.group or ""))
    return results

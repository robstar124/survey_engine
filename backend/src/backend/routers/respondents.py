from fastapi import APIRouter
from sqlalchemy import func, select

from backend.dependencies import DEMOGRAPHIC_FIELDS, DbSession, RespondentPageParams
from backend.models import Respondent
from backend.schemas import RespondentPage

router = APIRouter(prefix="/respondents", tags=["respondents"])


@router.get("", response_model=RespondentPage)
def list_respondents(db : DbSession, filters : RespondentPageParams):
    matching = filters.apply(select(Respondent))
    total = db.scalar(select(func.count()).select_from(matching.subquery()))
    items = db.scalars(matching.order_by(Respondent.serial_number).limit(filters.limit).offset(filters.offset)).all()
    return RespondentPage(total=total, limit=filters.limit, offset=filters.offset, items=items)

#every distinct value of each demographic field, for building filter options
@router.get("/demographics", response_model=dict[str, list[str]])
def list_demographics(db : DbSession):
    return {
        field: db.scalars(select(column).where(column.is_not(None)).distinct().order_by(column)).all()
        for field in DEMOGRAPHIC_FIELDS
        for column in [getattr(Respondent, field)]
    }

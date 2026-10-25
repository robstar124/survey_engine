from pydantic import BaseModel, ConfigDict


class RespondentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    serial_number: int
    gender: str
    age_band: str
    actual_age: int
    working_status: str
    region: str
    household_income: str
    work_organisation: str
    work_sector: str | None


#one page of respondents plus how many match in total, for paging through results
class RespondentPage(BaseModel):
    total: int
    limit: int
    offset: int
    items: list[RespondentOut]

import pandas as pd
import pytest
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session

from backend.pipeline.load import (
    build_answer_rows,
    build_question_rows,
    build_respondent_rows,
    get_question_category,
    get_question_columns,
    get_question_text,
    load,
)
from backend.models import Answer, Question, Respondent

STATEMENT = "which_of_the_following_statements_apply_to_you_i_own_more_than_one_property"
ATTITUDE = "general_attitudes_i_consider_myself_working_class"

#a minimal cleaned survey with two respondents and two questions
@pytest.fixture
def survey() -> pd.DataFrame:
    return pd.DataFrame({
        "serial_number": [13, 14],
        "gender": ["Male", "Female"],
        "age": ["65+", "55-64"],
        "actual_age": [77, 63],
        "which_of_the_following_best_describes_your_current_working_status": ["Retired", "Retired"],
        "which_one_of_these_regions_do_you_live_in": ["East of England", "West Midlands"],
        "what_is_the_combined_annual_income_of_your_household_prior_to_tax_being_deducted": ["£7,000", "£14,000"],
        "work_organisation_please_tell_us_which_type_of_organisation_you_do_or_did_work_for": ["Self-employed", "Other"],
        "do_you_work_in": [None, "Other"],
        STATEMENT: ["No", None],
        ATTITUDE: ["Agree strongly", "Don't know"],
    })

@pytest.fixture
def memory_engine():
    return create_engine("sqlite://")


#question helpers
#every column that isn't a demographic is treated as a question
def test_get_question_columns_excludes_respondent_columns(survey):
    assert get_question_columns(survey) == [STATEMENT, ATTITUDE]

#a question's category comes from its column name prefix
def test_get_question_category_uses_prefix():
    assert get_question_category(STATEMENT) == "statements"
    assert get_question_category(ATTITUDE) == "general_attitudes"

#a column with no known prefix fails loudly rather than being loaded under a wrong category
def test_get_question_category_rejects_unknown_columns():
    with pytest.raises(ValueError):
        get_question_category("favourite_colour")

#question text drops the category prefix, swaps underscores for spaces and capitalises the first letter
def test_get_question_text_strips_prefix_and_underscores():
    assert get_question_text(ATTITUDE) == "I consider myself working class"


#row builders
#csv columns are renamed to model attributes and blanks become None so they are stored as NULL
def test_build_respondent_rows_renames_columns_and_uses_none_for_missing(survey):
    rows = build_respondent_rows(survey)
    assert rows[0]["serial_number"] == 13
    assert rows[0]["age_band"] == "65+"
    assert rows[0]["work_sector"] is None
    assert rows[1]["work_sector"] == "Other"

#each question column becomes one question row with its category
def test_build_question_rows_has_one_row_per_question(survey):
    rows = build_question_rows(survey)
    assert [row["code"] for row in rows] == [STATEMENT, ATTITUDE]
    assert rows[0]["category"] == "statements"

#the wide csv is unpivoted to one row per respondent per answered question, with no rows for blanks
def test_build_answer_rows_skips_unanswered_questions(survey):
    rows = build_answer_rows(survey, {STATEMENT: 1, ATTITUDE: 2})
    assert sorted((row["respondent_id"], row["question_id"], row["value"]) for row in rows) == [
        (13, 1, "No"),
        (13, 2, "Agree strongly"),
        (14, 2, "Don't know"),
    ]


#load
#a load fills all three tables and the foreign keys link each answer to the right question and respondent
def test_load_populates_every_table(memory_engine, survey):
    load(memory_engine, survey)
    with Session(memory_engine) as session:
        assert session.scalar(select(func.count()).select_from(Respondent)) == 2
        assert session.scalar(select(func.count()).select_from(Question)) == 2
        assert session.scalar(select(func.count()).select_from(Answer)) == 3
        answer = session.scalars(select(Answer).where(Answer.value == "Agree strongly")).one()
        assert answer.question.code == ATTITUDE
        assert answer.respondent.serial_number == 13

#loading twice replaces the data instead of adding to it
def test_load_can_be_rerun_without_duplicating(memory_engine, survey):
    load(memory_engine, survey)
    load(memory_engine, survey)
    with Session(memory_engine) as session:
        assert session.scalar(select(func.count()).select_from(Answer)) == 3

#a load that fails partway (here on a duplicate serial number) leaves the previous data in place
def test_load_rolls_back_on_failure(memory_engine, survey):
    load(memory_engine, survey)
    bad_survey = survey.assign(serial_number=[13, 13])
    with pytest.raises(Exception):
        load(memory_engine, bad_survey)
    with Session(memory_engine) as session:
        assert session.scalar(select(func.count()).select_from(Respondent)) == 2

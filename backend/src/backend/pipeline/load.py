import pandas as pd
from sqlalchemy import Engine, delete, insert
from sqlalchemy.orm import Session

from backend.core.config import settings
from backend.core.database import Base, engine
from backend.models import Answer, Question, Respondent
from backend.pipeline.cleaning import clean_data

#csv columns that describe the respondent, mapped to their Respondent attribute
RESPONDENT_COLUMNS = {
    "serial_number": "serial_number",
    "gender": "gender",
    "age": "age_band",
    "actual_age": "actual_age",
    "which_of_the_following_best_describes_your_current_working_status": "working_status",
    "which_one_of_these_regions_do_you_live_in": "region",
    "what_is_the_combined_annual_income_of_your_household_prior_to_tax_being_deducted": "household_income",
    "work_organisation_please_tell_us_which_type_of_organisation_you_do_or_did_work_for": "work_organisation",
    "do_you_work_in": "work_sector",
}

#csv column prefixes that group the remaining columns into question categories
QUESTION_CATEGORIES = {
    "which_of_the_following_statements_apply_to_you_": "statements",
    "general_attitudes_": "general_attitudes",
    "political_interest_": "political_interest",
    "eu_referendum_": "eu_referendum",
    "goal_importance_": "goal_importance",
    "voting_intention_": "voting_intention",
}

#replace pandas missing values with None so they're stored as NULL
def nan_to_none(df : pd.DataFrame) -> pd.DataFrame:
    return df.astype(object).where(df.notna(), None)

#every column that isn't a respondent attribute is a question
def get_question_columns(df : pd.DataFrame) -> list[str]:
    return [column for column in df.columns if column not in RESPONDENT_COLUMNS]

#find the category for a question column from its prefix
def get_question_category(code : str) -> str:
    for prefix, category in QUESTION_CATEGORIES.items():
        if code.startswith(prefix):
            return category
    raise ValueError(f"no category for question column {code}")

#turn a question column into readable text, e.g. "general_attitudes_i_consider_myself_working_class" -> "I consider myself working class"
def get_question_text(code : str) -> str:
    prefix = next(prefix for prefix in QUESTION_CATEGORIES if code.startswith(prefix))
    words = code.removeprefix(prefix).replace("_", " ")
    return words[0].upper() + words[1:]

#build one Respondent row per survey response
def build_respondent_rows(df : pd.DataFrame) -> list[dict]:
    respondents = df[list(RESPONDENT_COLUMNS)].rename(columns=RESPONDENT_COLUMNS)
    return nan_to_none(respondents).to_dict("records")

#build one Question row per question column
def build_question_rows(df : pd.DataFrame) -> list[dict]:
    return [
        {"code": code, "category": get_question_category(code), "text": get_question_text(code)}
        for code in get_question_columns(df)
    ]

#build one Answer row per respondent per answered question, skipping unanswered ones
def build_answer_rows(df : pd.DataFrame, question_ids : dict[str, int]) -> list[dict]:
    answers = df.melt(id_vars="serial_number", value_vars=get_question_columns(df), var_name="code", value_name="value")
    answers = answers.dropna(subset="value")
    answers["question_id"] = answers["code"].map(question_ids)
    answers = answers.rename(columns={"serial_number": "respondent_id"})
    return answers[["respondent_id", "question_id", "value"]].to_dict("records")

#delete existing data so the load can be re-run, answers first because they reference the others
def clear_tables(session : Session) -> None:
    session.execute(delete(Answer))
    session.execute(delete(Question))
    session.execute(delete(Respondent))

def insert_respondents(session : Session, rows : list[dict]) -> None:
    session.execute(insert(Respondent), rows)

#insert questions and return their database ids keyed by code
def insert_questions(session : Session, rows : list[dict]) -> dict[str, int]:
    inserted = session.execute(insert(Question).returning(Question.code, Question.id), rows)
    return {code: question_id for code, question_id in inserted}

def insert_answers(session : Session, rows : list[dict]) -> None:
    session.execute(insert(Answer), rows)

#replace everything in the database with the cleaned survey data
def populate(session : Session, df : pd.DataFrame) -> None:
    clear_tables(session)
    insert_respondents(session, build_respondent_rows(df))
    question_ids = insert_questions(session, build_question_rows(df))
    insert_answers(session, build_answer_rows(df, question_ids))

#create the tables if needed and load the data in one transaction, so a failure leaves the database unchanged
def load(engine : Engine, df : pd.DataFrame) -> None:
    Base.metadata.create_all(engine)
    with Session(engine) as session, session.begin():
        populate(session, df)

if __name__ == "__main__":
    df = pd.read_csv(settings.source_data_path)
    df_clean, df_removed = clean_data(df)
    load(engine, df_clean)
    print(f"loaded {len(df_clean)} respondents, removed {len(df_removed)} rows")

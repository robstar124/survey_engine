#shared fixtures for the api tests
import pandas as pd
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from backend.core.database import get_db
from backend.main import app
from backend.pipeline.load import load
from tests.api.helpers import ATTITUDE, STATEMENT

#a minimal cleaned survey with three respondents and two questions
@pytest.fixture
def survey() -> pd.DataFrame:
    return pd.DataFrame({
        "serial_number": [13, 14, 15],
        "gender": ["Male", "Female", "Female"],
        "age": ["65+", "55-64", "25-34"],
        "actual_age": [77, 63, 30],
        "which_of_the_following_best_describes_your_current_working_status": ["Retired", "Retired", "Working full time"],
        "which_one_of_these_regions_do_you_live_in": ["East of England", "West Midlands", "London"],
        "what_is_the_combined_annual_income_of_your_household_prior_to_tax_being_deducted": ["£7,000", "£14,000", "£7,000"],
        "work_organisation_please_tell_us_which_type_of_organisation_you_do_or_did_work_for": ["Self-employed", "Other", "Other"],
        "do_you_work_in": [None, "Other", None],
        STATEMENT: ["No", None, "Yes"],
        ATTITUDE: ["Agree strongly", "Don't know", "Agree strongly"],
    })

#sqllite database with the survey loaded, and a TestClient that uses it;
@pytest.fixture
def client(survey):
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    load(engine, survey)

    def get_test_db():
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_db] = get_test_db
    yield TestClient(app)
    app.dependency_overrides.clear()

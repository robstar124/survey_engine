from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[3]
ENV_FILE = BACKEND_DIR / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ENV_FILE, extra="ignore", env_ignore_empty=True)

    database_url: str
    source_data_path: Path = BACKEND_DIR / "data" / "tech_test_survey_data.csv"
    #origins allowed to call the api from a browser, defaults to the react dev server
    cors_origins: list[str] = ["http://localhost:3000"]


settings = Settings()

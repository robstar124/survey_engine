from backend.core.database import Base
from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship

#one row per person who took the survey, holding their demographic profile
class Respondent(Base):
    __tablename__ = "respondent"

    serial_number = Column(Integer, primary_key=True, autoincrement=False)
    gender = Column(String, nullable=False)
    age_band = Column(String, nullable=False)
    actual_age = Column(Integer, nullable=False)
    working_status = Column(String, nullable=False)
    region = Column(String, nullable=False)
    household_income = Column(String, nullable=False)
    work_organisation = Column(String, nullable=False)
    #only asked of public sector workers, so null for everyone else
    work_sector = Column(String, nullable=True)

    answers = relationship("Answer", back_populates="respondent", cascade="all, delete-orphan")

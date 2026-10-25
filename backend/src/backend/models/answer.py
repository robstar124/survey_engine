from backend.core.database import Base
from sqlalchemy import Column, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

#one row per respondent per question they answered; unanswered questions have no row
class Answer(Base):
    __tablename__ = "answer"

    respondent_id = Column(Integer, ForeignKey("respondent.serial_number", ondelete="CASCADE"), primary_key=True)
    question_id = Column(Integer, ForeignKey("question.id", ondelete="CASCADE"), primary_key=True, index=True)
    value = Column(String, nullable=False)

    respondent = relationship("Respondent", back_populates="answers")
    question = relationship("Question", back_populates="answers")

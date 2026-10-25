from backend.core.database import Base
from sqlalchemy import Column, Integer, String, Text
from sqlalchemy.orm import relationship

#one row per survey question, e.g. a single statement or attitude
class Question(Base):
    __tablename__ = "question"

    id = Column(Integer, primary_key=True)
    #original csv column name, kept as text since many are over postgres's 63 char identifier limit
    code = Column(Text, nullable=False, unique=True)
    #the group the question belongs to, e.g. "general_attitudes"
    category = Column(String, nullable=False)
    text = Column(Text, nullable=False)

    answers = relationship("Answer", back_populates="question", cascade="all, delete-orphan")

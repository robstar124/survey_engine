#import every model so Base.metadata knows about all tables
from backend.models.answer import Answer
from backend.models.question import Question
from backend.models.respondent import Respondent

__all__ = ["Answer", "Question", "Respondent"]

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.core.config import settings
from backend.routers import questions, respondents

app = FastAPI(title="Survey Engine")

#let the frontend dev server call the api from the browser
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_methods=["GET"], allow_headers=["*"])

app.include_router(questions.router)
app.include_router(respondents.router)

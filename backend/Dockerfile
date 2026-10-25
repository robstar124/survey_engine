FROM python:3.14-slim

COPY --from=ghcr.io/astral-sh/uv:0.12.13 /uv /bin/uv

WORKDIR /app
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_NO_DEV=1

#install dependencies first so code changes don't reinstall them
COPY pyproject.toml uv.lock README.md ./
RUN uv sync --locked --no-install-project

COPY src ./src
RUN uv sync --locked

ENV PATH="/app/.venv/bin:$PATH"
EXPOSE 8000

#reload the cleaned csv into the database, then start the api
CMD ["sh", "-c", "python -m backend.pipeline.load && fastapi run src/backend/main.py --host 0.0.0.0 --port 8000"]

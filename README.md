# Survey Engine

A survey results viewer. The data pipeline cleans the raw survey CSV and loads it into Postgres. A FastAPI backend serves questions, respondents and crosstab results, and a React frontend lets you explore them, filtering and grouping by demographics.

```
data/                     raw survey CSV
backend/                  FastAPI api, data pipeline, tests (Python 3.14, uv)
frontend/survey_viewer/   React app (Create React App)
docker-compose.yml        runs the whole project
```

## Running with Docker (recommended)

You need Docker with the Compose plugin.

```bash
docker compose up --build
```

- App: http://localhost:3000
- API docs: http://localhost:8000/docs

This starts three containers:

| Service    | What it does |
|------------|--------------|
| `db`       | Postgres 17, with its data stored in the `pgdata` volume |
| `backend`  | Loads the cleaned CSV into the database, then serves the API on port 8000 |
| `frontend` | The built React app, served by nginx on port 3000. Requests under `/api` are forwarded to the backend |

The data is reloaded every time the backend starts, so restarting picks up changes to the CSV. To stop everything and wipe the database:

```bash
docker compose down -v
```

## Running locally without Docker

You need [uv](https://docs.astral.sh/uv/), Node 20+ and a running Postgres database.

Once `backend/.env` is set up (see below), one command does everything: it installs dependencies, loads the data, and starts the backend and frontend. Ctrl+C stops both.

```bash
make run
```

| Command         | What it does |
|-----------------|--------------|
| `make install`  | Installs backend and frontend dependencies |
| `make load`     | Cleans the CSV and loads it into the database |
| `make backend`  | Starts the API on http://localhost:8000 |
| `make frontend` | Starts the React app on http://localhost:3000 |
| `make run`      | Runs install and load, then starts the backend and frontend together |
| `make test`     | Runs the backend and frontend tests |
| `make docker`   | Runs the whole project in Docker |

To run the steps without `make`, follow the sections below.

### Backend

Create `backend/.env`:

```
DATABASE_URL=postgresql+psycopg://<user>:<password>@localhost:5432/<database>
SOURCE_DATA_PATH=../data/tech_test_survey_data.csv
```

Then, from `backend/`:

```bash
uv sync                                  # install dependencies
uv run python -m backend.pipeline.load   # clean the CSV and load it into the database
uv run fastapi dev src/backend/main.py   # start the API on http://localhost:8000
```

### Frontend

From `frontend/survey_viewer/`:

```bash
npm install
npm start      # http://localhost:3000
```

The dev server forwards API requests to `http://localhost:8000` (the `proxy` setting in `package.json`), so start the backend first.

## Tests

```bash
cd backend && uv run pytest
cd frontend/survey_viewer && CI=true npm test
```

# run the project locally, needs postgres running and backend/.env set up
.PHONY: install load backend frontend run test docker

install:
	cd backend && uv sync
	cd frontend/survey_viewer && npm install

# clean the csv and load it into the database
load:
	cd backend && uv run python -m backend.pipeline.load

backend:
	cd backend && uv run fastapi dev src/backend/main.py

frontend:
	cd frontend/survey_viewer && npm start

# load the data, then run the api and the react app side by side, ctrl+c stops both
run: install load
	$(MAKE) -j2 backend frontend

test:
	cd backend && uv run pytest
	cd frontend/survey_viewer && CI=true npm test

docker:
	docker compose up --build

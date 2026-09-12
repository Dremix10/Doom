# Doom — dev shortcuts. Requires: python3.12, node.
.PHONY: install seed backend demo app export clean

install:  ## install backend + app deps
	cd backend && python3 -m venv .venv && .venv/bin/pip install -U pip && .venv/bin/pip install -r requirements.lock.txt
	cd app && npm install

seed:  ## wipe + seed 21 days of history for 4 users
	cd backend && .venv/bin/python -m simulator.seed --reset --days 21

backend:  ## run the API (reads backend/.env)
	cd backend && .venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

demo:  ## run the API in demo mode (fast agent, time compression)
	cd backend && DEMO_MODE=1 AGENT_INTERVAL_S=3 DEMO_TIME_SCALE=25 .venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000

scroll:  ## simulate a doomscroll: make scroll USER=Demetris SVC=tiktok MIN=2
	cd backend && DEMO_MODE=1 DEMO_TIME_SCALE=25 .venv/bin/python -m simulator.live --user $(USER) --service $(SVC) --minutes $(MIN)

app:  ## run the Expo app (web + phone via Expo Go)
	cd app && npx expo start

export:  ## build the web PWA into app/dist
	cd app && npx expo export --platform web && python3 scripts/pwa-inject.py

clean:
	rm -f backend/data/app.db backend/data/app.db-*

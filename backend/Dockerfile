FROM python:3.11-slim

WORKDIR /app

# System deps for psycopg2, prophet, pystan
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ libpq-dev curl \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Create tables and seed on startup
CMD ["sh", "-c", "python -m backend.db.init_db && uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload"]

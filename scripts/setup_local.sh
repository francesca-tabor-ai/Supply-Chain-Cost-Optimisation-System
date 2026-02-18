#!/usr/bin/env bash
# ─────────────────────────────────────────────
# Local development setup (no Docker)
# Usage: bash scripts/setup_local.sh
# ─────────────────────────────────────────────
set -e

echo "🔧 Setting up Supply Chain Cost Optimisation System..."

# 1. Python virtualenv
if [ ! -d ".venv" ]; then
  echo "  → Creating Python virtualenv..."
  python3 -m venv .venv
fi

source .venv/bin/activate
echo "  → Installing Python dependencies..."
pip install --quiet --upgrade pip
pip install --quiet -r backend/requirements.txt

# 2. Copy .env if missing
if [ ! -f ".env" ]; then
  cp .env.example .env
  echo "  → Created .env from .env.example — edit DATABASE_URL if needed"
fi

# 3. Node deps
echo "  → Installing frontend dependencies..."
cd frontend && npm install --silent && cd ..

# 4. DB
echo ""
echo "📦 To initialise the database:"
echo "   1. Ensure PostgreSQL is running (or: docker compose up db -d)"
echo "   2. Run: python -m backend.db.init_db"
echo ""
echo "🚀 To start:"
echo "   API:      uvicorn backend.main:app --reload --port 8000"
echo "   Frontend: cd frontend && npm run dev"
echo "   Both:     docker compose up"
echo ""
echo "✅ Setup complete."

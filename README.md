# GoldenCare AI Automation & Backoffice

This system automatically ingests incoming emails containing Hebrew reconciliation forms, extracts structured data via AI, maintains an Excel source of truth, and provides a Backoffice UI for finance personnel to manage prompts and test extractions.

## Quick Start (One-Liner Execution)

Ensure you have Docker and Docker Compose installed.

1. Clone this repository.
2. (Optional) Copy `.env.example` to `.env` and configure your API keys. If no key is provided, the API uses a local mock extraction mode.
3. Run the following command from the root directory:

```bash
docker compose up --build
```

### Accessing the Services
- **Frontend (Backoffice UI):** [http://localhost:5173](http://localhost:5173)
- **Backend API (Swagger Docs):** [http://localhost:8000/docs](http://localhost:8000/docs)
- **Database:** `localhost:5432` (User: `postgres`, Password: `postgres`, DB: `goldencare`)

## Project Structure
- `/backend`: FastAPI Python server (LLM integration, Excel generation, API routes).
- `/frontend`: React + Vite + Tailwind CSS (RTL layout for Hebrew).
- `/data`: Mounted volume for storing generated files.
  - `/data/samples`: Drop sample files (PDF, images) here for sandbox testing.
  - `/data/regression_suite`: Ground truth JSONs and test files for regression testing.

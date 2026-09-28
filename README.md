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

This repository is divided into specialized directories. **For deep dives, please read their respective READMEs:**

- **[`/backend`](./backend/README.md):** FastAPI Python server. Handles the LLM integration, Excel generation, deterministic math validation, and Regression Testing methods. *(See the Backend README for a detailed explanation of the Regression methods).*
- **[`/frontend`](./frontend/README.md):** React + Vite + Tailwind CSS SPA. The RTL Backoffice UI for the finance team.
- **`/data`:** Mounted volume for storing generated files.
  - `/data/samples`: Drop sample files (PDF, images) here for sandbox testing.
  - `/data/regression_suite`: Ground truth JSONs and test files for regression testing.

## High-Level Architecture

```
Inbound email (webhook)  ─┐
Sandbox upload            ─┴─► store file ─► AI extraction ─► business validation ─► DB audit row ─► Excel
                                             (envelope +        (math, VAT, missing
                                              provider chain)    fields – deterministic)
```

The system relies on an AI model (Gemini, with OpenAI fallback) to blindly transcribe printed data. That data is then checked mathematically by the backend to prevent the AI from masking supplier arithmetic errors. Every document is recorded into the PostgreSQL database, which is immediately projected into a synchronized `GoldenCare_Master.xlsx` Excel file for the finance team.

## Access & Deployment

All ports in `docker-compose.yml` are bound to `127.0.0.1`, so the stack is reachable only from the machine running it. 
The Backoffice has no per-user accounts; before exposing it to a network, set `BACKOFFICE_API_KEY` in your `.env`. Every Backoffice route then requires `X-API-Key`. Compose passes the same value to the UI as `VITE_API_KEY`. A key that ships inside a browser bundle keeps strangers out; it is not per-user authentication. The email webhook accepts either `INBOUND_EMAIL_TOKEN` or the Backoffice key once either is set.

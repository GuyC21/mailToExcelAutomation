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

## Ingestion Pipeline (Sprint 2)

```
Inbound email (webhook)  ─┐
Sandbox upload            ─┴─► store file ─► AI extraction ─► business validation ─► DB audit row ─► Excel
                                             (envelope +        (math, VAT, missing
                                              provider chain)    fields – deterministic)
```

### Inbound email endpoints
No real mailbox is monitored. Instead, any mail provider (or the Backoffice simulator) POSTs the email:

| Endpoint | Format |
|---|---|
| `POST /api/email/inbound` | `multipart/form-data` – `from`, `to`, `subject`, `text`, `headers`, `attachments[]` (SendGrid Inbound Parse style) |
| `POST /api/email/inbound/json` | JSON with base64 attachments (Postmark / Mailgun style) |
| `POST /api/email/inbound/eml` | A raw `.eml` file – the exact message as stored by a mail server |

Every PDF / image attachment is processed; other attachments are reported as `SKIPPED`.
Set `INBOUND_EMAIL_TOKEN` to require an `X-Inbound-Token` header from webhook callers.

### Design decisions
- **System envelope vs. business prompt** – the finance team edits only business instructions in the Backoffice. The JSON contract, faithful-transcription rules and prompt-injection guard live in a hardcoded envelope (`services/extraction/system_envelope.py`). The "technical view" in the UI is built by the same function, so it shows exactly what the model receives.
- **The LLM transcribes, code judges** – the model is instructed to copy amounts *as printed* and never fix them. Arithmetic (quantity × price, lines vs. subtotal, VAT, total) and required fields are checked deterministically in `services/validation/business_rules.py`, so a model can never "helpfully" hide a supplier's error.
- **Failures are visible, never swallowed** – every document gets a row in the main Excel sheet, colour-coded `תקין` / `דורש בדיקה` / `חילוץ נכשל`, with the reasons in Hebrew. The DB keeps the full audit trail (raw model answer, every provider attempt, prompt version).
- **Fallback chain** – Gemini models in order (`GEMINI_MODELS`, next model on quota/unavailable errors) → OpenAI if a key is set → recorded as `EXTRACTION_FAILED`. With no API key at all, a clearly labelled `mock` engine is used.
- **Excel safety** – writes are locked and atomic. If the workbook is open in Excel, rows stay pending in the DB and are flushed on the next ingestion, on startup, or via `POST /api/excel/sync`.

### Excel source of truth (`data/GoldenCare_Master.xlsx`, RTL)
- **מסמכים** – one row per document: status, issues, email sender/subject, supplier, document number/date, billing period, subtotal, VAT, total, extraction engine, prompt version.
- **שורות חיוב** – one row per charge line with a per-line calculation check.

A workbook with an older layout is archived automatically (`*.legacy-<timestamp>.xlsx`).

### Tests
```bash
cd backend && pip install -r requirements-dev.txt && pytest
```
Offline (mock provider + SQLite): validation rules against hand-labelled transcriptions of the 5 sample forms, email parsing, provider fallback, and the full email → Excel flow.

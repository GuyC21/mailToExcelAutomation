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

- **Idempotent** – mail providers retry webhooks. Each (delivery, attachment) pair creates at most one
  record: the delivery is identified by its `Message-ID` (or, without one, by a digest of the sender's
  content), and a UNIQUE key in `processed_attachments` makes this hold even for concurrent retries.
  A replay returns the original result with `duplicate: true`.
- **Bounded** – requests are capped while streaming (`MAX_REQUEST_MB`, default 60 → HTTP 413), each
  document at `MAX_UPLOAD_MB` (default 15; an oversized email attachment is reported as `SKIPPED`),
  and at most `MAX_EMAIL_ATTACHMENTS` (20) files per email.

### Design decisions
- **System envelope vs. business prompt** – the finance team edits only business instructions in the Backoffice. The JSON contract, faithful-transcription rules and prompt-injection guard live in a hardcoded envelope (`services/extraction/system_envelope.py`). The "technical view" in the UI is built by the same function, so it shows exactly what the model receives.
- **The LLM transcribes, code judges** – the model is instructed to copy amounts *as printed* and never fix them. Arithmetic (quantity × price, lines vs. subtotal, VAT, total) and required fields are checked deterministically in `services/validation/business_rules.py`, so a model can never "helpfully" hide a supplier's error.
- **Failures are visible, never swallowed** – every document gets a row in the main Excel sheet, colour-coded `תקין` / `דורש בדיקה` / `חילוץ נכשל`, with the reasons in Hebrew. The DB keeps the full audit trail (raw model answer, every provider attempt, prompt version).
- **Fallback chain** – Gemini models in order (`GEMINI_MODELS`, next model on quota/unavailable errors) → OpenAI if a key is set → recorded as `EXTRACTION_FAILED`. With no API key at all, a clearly labelled `mock` engine is used.
- **Excel safety** – writes are locked and atomic. If the workbook is open in Excel, rows stay pending in the DB and are flushed on the next ingestion, on startup, or via `POST /api/excel/sync`.

### Excel source of truth (`data/GoldenCare_Master.xlsx`, RTL)
- **מסמכים** – one row per document: status, issues, email sender/subject, supplier, document number/date, billing period, subtotal, VAT, total, extraction engine, prompt version.
- **שורות חיוב** – one row per charge line with a per-line calculation check.

The workbook is a projection of the database, and the database is authoritative (Review-page edits go
through it). Each workbook is stamped with the database's identity; before every sync the stamp is
checked, and a missing workbook, one with an older layout (archived as `*.legacy-<timestamp>.xlsx`) or
one that belongs to a different database (archived as `*.orphan-<timestamp>.xlsx` – e.g. a fresh clone
next to an old workbook) is replaced by a new one into which **every** record is replayed. Archived
files are never deleted. Text from emails / the model is always written as literal text, never as a
formula.

### Tests
```bash
cd backend && pip install -r requirements-dev.txt && pytest
```
Offline (mock provider + SQLite): validation rules against hand-labelled transcriptions of the 5 sample forms, email parsing, provider fallback, the full email → Excel flow, the regression scoring algorithm, the regression runner, and the ground-truth labeling service/API.

## Regression Testing & Ground-Truth Labeling (Sprint 3)

A prompt or model change can silently make extraction *worse* on documents it used to handle
correctly. The regression suite catches that: a fixed set of (document, hand-verified ground
truth) pairs is replayed through the real pipeline on demand, and every result is scored
0–100% against its ground truth.

```
data/regression_suite/
    shl_valid.pdf
    shl_valid_expected.json   ← ground truth, shaped like schemas.extraction.DocumentExtraction
    ...
```

### Two sides of one suite
| Concern | Module | Responsibility |
|---|---|---|
| **Run** | `backend/services/regression/runner.py` | Pairs every document with its `*_expected.json`, runs it with the **prompt under evaluation** (the active one, or any stored version – so a candidate is checked *before* activation) through one pinned provider (Gemini; OpenAI only if Gemini is not configured) via the same `DocumentExtractor` production ingestion uses, and scores each result. The report records the prompt, provider and model used. |
| **Score** | `backend/services/regression/scorer.py` | Compares one expected/actual pair field-by-field and returns a 0–100% report. |
| **Author ("תיוג")** | `backend/services/regression/labeling.py` | Writes a manually transcribed ground truth into the suite – the only way `data/regression_suite/` grows without a developer hand-writing JSON. |

### Scoring algorithm (`scorer.py`)
Every field is compared with a strategy matched to its type, not hardcoded per field name:

- **Text** (`supplier_name`, `description`, …) – Levenshtein similarity ratio (no third-party
  dependency), so a typo lowers the score instead of failing it outright.
- **Identifiers & currency** (`supplier_tax_id`, `document_number`, `currency`) – exact match after
  normalising case/whitespace (and ₪/NIS → ILS): a one-digit difference is a different entity.
- **Money** (`subtotal`, `total_amount`, `line_total`, …) – absolute tolerance only (default ±1, rounding
  noise); the relative band exists in `ScoringConfig` but is 0 by default, so 6,250 never passes for 6,300.
- **Percentages** (`vat_rate`) – a percentage-point tolerance.
- **Dates** – exact match (already ISO-normalised upstream by `schemas.extraction`).
- **`line_items`** – an unordered, possibly miscounted list. Every expected/actual pair is scored,
  then matched greedily best-first (an approximation of the Hungarian algorithm, without the
  dependency). Unmatched items become "missing" or "extra" and score 0 – the denominator, not
  just the numerator, is what penalises a wrong item count, so a perfect match on the wrong
  number of lines can never reach 100%.

The overall score is a configurable weighted blend of the header fields and `line_items`
(`ScoringConfig`); nothing here is a magic number buried in the algorithm. It is diagnostic, not a
correctness proof: a case **passes only if** it reaches the threshold (80) **and** no *critical* field
(`total_amount`, `supplier_tax_id`, `document_number`, `currency`) is wrong.

The run's headline accuracy counts a failed extraction as 0 and is shown next to **coverage** (share of
cases that produced an extraction) and the accuracy over extracted cases only, so a prompt that stops
answering hard documents can't look like an improvement.

### Run History & A/B Comparison – `/regression`
Every `POST /run` is persisted as one `RegressionRun` row (`backend/models/regression.py`) – a plain
snapshot of the report above, written once and never recomputed, so refreshing the page (or coming
back tomorrow) doesn't lose it and doesn't require calling the LLM again. The Regression page has two
tabs:

- **הרצה נוכחית (Current run)** – unchanged: pick a prompt, run the suite, see the live report.
- **היסטוריה והשוואת A/B (History & A/B Comparison)** – every past run, newest first; pick any two
  (e.g. the active prompt vs. a candidate) to compare them case-by-case. Each suite case is classified
  as *improved*, *regressed*, *unchanged*, or present in only one of the two runs (`only_a`/`only_b`
  – the suite itself can change between runs), with the score delta shown per case and for the
  headline metrics. This is pure read-side diffing over two already-scored runs
  (`api/routes/regression.py:_diff_cases`) – it never re-scores anything, so it cannot affect
  `services/regression/scorer.py`.

### Ground-truth labeling ("תיוג") – `/labeling`
Before this page existed, growing the suite meant a developer hand-writing an `expected.json`.
The **תיוג** page in the Backoffice lets anyone do the same thing through a form:

1. Upload the source PDF/image (or open an existing case to correct it).
2. Transcribe the document's fields exactly as printed – the same fields, in the same shape,
   the AI extraction pipeline itself produces.
3. Save. The case name becomes the suite file stem (`<name>.pdf` / `<name>_expected.json`);
   non-alphanumeric characters are stripped before it ever touches the filesystem
   (`services.regression.labeling.sanitise_case_name`), guarding against path traversal.

Saving a case runs the same deterministic business-rule checks used elsewhere
(`services/validation/business_rules.py`) against the transcription and returns any findings as
**non-blocking warnings** – a ground truth may faithfully preserve a supplier's own arithmetic
mistake, and catching the AI failing to preserve that same mistake is exactly what regression
testing is for, so a warning is surfaced, never a rejection.

This also doubles as the natural place to fix a `NEEDS_REVIEW` document from the Sandbox: correct
its fields once, save it as a labeled case, and that correction becomes a permanent regression
guard against the same mistake recurring.

### API
| Endpoint | Purpose |
|---|---|
| `POST /api/regression/run?prompt_id=<id>` | Replays the suite with that prompt version (default: the active one), scores it, **persists it as a Run History row**, and returns the report (now including `id`/`created_at`). 409 if no real AI provider is configured. |
| `GET /api/regression/runs?prompt_id=<id>` | Lists past runs (newest first, optionally filtered by prompt), for the History tab. |
| `GET /api/regression/runs/{id}` | One past run in full, including its per-case results. |
| `DELETE /api/regression/runs/{id}` | Removes a run from history. |
| `GET /api/regression/runs/compare?run_a=<id>&run_b=<id>` | Case-by-case diff of two past runs, plus headline metric deltas – powers the A/B Comparison view. |
| `GET /api/regression/cases` | Lists every labeled case. |
| `GET /api/regression/cases/{name}` | Returns one case's ground truth (for editing). |
| `GET /api/regression/cases/{name}/document` | Streams a case's source file (for the preview pane). |
| `POST /api/regression/cases` | Creates or updates a case (`multipart/form-data`: `case_name`, `expected_json`, optional `file`). |
| `DELETE /api/regression/cases/{name}` | Removes a case. |

### Running the suite from the CLI
```bash
cd backend && python -m services.regression.runner --suite-dir ../data/regression_suite
```
Requires a real `GEMINI_API_KEY` (or `OPENAI_API_KEY`) in `.env` – like production ingestion, this calls
the live model. The CLI uses a neutral built-in prompt; use the Backoffice / API to evaluate a stored
prompt version.

## Access & deployment
All ports in `docker-compose.yml` are bound to `127.0.0.1`, so the stack is reachable only from the
machine running it. The Backoffice has no per-user accounts; before exposing it to a network set
`BACKOFFICE_API_KEY` – every Backoffice route then requires `X-API-Key` (plain links such as the Excel
download use `?api_key=`), and compose passes the same value to the UI as `VITE_API_KEY`. A key that
ships inside a browser bundle keeps strangers out; it is not per-user authentication. The email
webhook accepts either `INBOUND_EMAIL_TOKEN` or the Backoffice key once either is set.

The financial dashboard shows **operational** data by default – emailed documents read by a real AI
provider. Sandbox uploads and `mock` extractions are test activity and appear only when "include tests"
is selected. Totals are reported per currency and never added across currencies.

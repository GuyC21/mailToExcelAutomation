# GoldenCare Backend API

The backend of the GoldenCare system is a FastAPI Python application responsible for email ingestion, AI-driven data extraction, deterministic validation, and Excel synchronization.

## Architecture & Services

The backend is organized into several key services:

- **Ingestion Pipeline (`services/ingestion_pipeline.py`)**: The orchestrator. It receives inbound emails, extracts attachments (PDFs/Images), and routes them through the AI extraction and validation steps.
- **AI Extraction (`services/extraction/`)**: Uses Gemini (and falls back to OpenAI) to transcribe document contents into structured JSON.
  - **System Envelope**: The AI prompt is split in two. The "System Envelope" contains hardcoded instructions about the JSON contract and anti-hallucination rules. The "Business Prompt" is what the finance team edits in the UI.
- **Business Validation (`services/validation/`)**: The AI is instructed to blindly transcribe what it sees. The validation layer then deterministically checks the math (e.g., does `Quantity * Unit Price == Line Total`? Does `Subtotal + VAT == Total`?). This prevents the AI from "fixing" a supplier's math error.
- **Excel Sync (`services/excel_sync.py`)**: The database is the ultimate source of truth. This service projects the database records into the `GoldenCare_Master.xlsx` file. It ensures atomic writes and handles conflicts if the Excel file is open.
- **Email Parser (`services/email_parser.py`)**: Processes standard multi-part form data, JSON payloads, or raw `.eml` files from various webhook providers.

## API Structure

- `POST /api/email/inbound`: Endpoint for incoming mail webhooks.
- `GET /api/documents`: Fetch processed documents.
- `GET /api/prompts`: Manage the business prompt versions.
- `GET /api/dashboard`: Aggregated metrics for the frontend.
- `POST /api/excel/sync`: Force a synchronization of the DB to the Excel file.
- `api/routes/regression.py`: Endpoints for managing and running regression tests.

---

## Deep Dive: Regression Methods

### 1. What is the Regression Suite?
When you change the AI prompt, you want to improve extraction on documents that were failing. However, you risk breaking documents that the AI used to read perfectly. 
**Regression testing prevents this.** It is an automated test suite that takes a fixed set of historical documents, runs them through the AI with your *new* prompt, and scores the result against human-verified "Ground Truth" answers.

### 2. How the Suite is Structured
In the `data/regression_suite/` directory, files are paired by their name:
- `form1.pdf`: The original document.
- `form1_expected.json`: The "Ground Truth" — the perfect, human-verified JSON output we expect the AI to produce.

### 3. The Runner (`services/regression/runner.py`)
When a regression run is triggered, the **Runner**:
1. Iterates through all PDFs in the suite directory.
2. Sends each PDF to the AI using the **Prompt under evaluation** (not necessarily the active one). It uses a pinned provider (usually Gemini) to ensure consistency.
3. Takes the AI's output and passes it to the **Scorer**, alongside the `_expected.json` file.

### 4. The Scorer (`services/regression/scorer.py`)
This is the heart of the regression system. How do you programmatically compare two complex JSONs fairly? If the AI misreads one letter in a supplier name, the whole extraction shouldn't score 0%. The Scorer uses different strategies based on the *data type*:

- **Text Fields (e.g., Supplier Name, Description)**: 
  Uses a **Fuzzy Match (Levenshtein distance)**. If the expected name is "Golden Care" and the AI outputs "Golden Car", it gets a partial score (e.g., 90%) instead of a failure.
- **Dates**: 
  Requires an **Exact Match**, as dates are already standardized to ISO format upstream.
- **Identifiers (e.g., Supplier Tax ID, Document Number)**: 
  Requires an **Exact Match**. If a Tax ID is off by one digit, it's a completely different company.
- **Financial Amounts (e.g., Subtotal, Line Total)**: 
  Uses an **Absolute Tolerance**. It allows a tiny absolute difference (like ±1.0) to account for minor rounding noise, but it strictly penalizes larger differences. 
- **Percentages (e.g., VAT rate)**: 
  Allows a small percentage-point tolerance (e.g., ±0.5%).
- **Line Items List**: 
  The hardest part is matching the expected lines to the AI's lines. The scorer uses a **Greedy Best-First matching algorithm**. It scores every possible pair of (Expected Line, AI Line) and matches the highest scoring ones first. If the AI misses a line, or hallucinates an extra one, that unmatched line scores a `0`. This heavily penalizes incorrect line counts while fairly scoring the lines that do match.
- **Critical Failures Gate**: 
  Certain fields are marked as critical (`total_amount`, `supplier_tax_id`, `document_number`, `currency`). **If any of these fields mismatch, the entire document fails the test, regardless of its overall percentage score.**

### 5. Ground-Truth Labeling (`services/regression/labeling.py`)
How do we add new files to the regression suite? 
Instead of forcing developers to hand-write complex `_expected.json` files, the system has a **"Labeling" (תיוג)** feature. 
Users can upload a PDF via the Backoffice UI, fill out a form with the correct values exactly as printed on the document, and click Save. The labeling service securely sanitizes the input and writes the new PDF and `_expected.json` directly into the `data/regression_suite/` directory, permanently adding it to the test suite.

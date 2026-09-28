# Regression suite

Ground-truth pairs for `services/regression/runner.py`. Naming convention:

    <name>.<pdf|png|jpg|...>       # the source document
    <name>_expected.json           # hand-labelled ground truth, in the shape of
                                    # schemas.extraction.DocumentExtraction

## Adding a case

Preferred: use the **תיוג (Labeling)** page in the Backoffice UI (`/labeling`). It lets you
upload a document, transcribe its fields through a form, and saves the paired files here for
you — see the root `README.md`'s "Regression Testing & Ground-Truth Labeling" section for the
full workflow and the API behind it (`services/regression/labeling.py`).

Hand-writing the JSON directly (as below) still works and is useful for scripting/bulk seeding,
as long as the file names follow the convention above.

## Running the suite

Needs a real `GEMINI_API_KEY` in `.env` — it calls the live model:

    cd backend && python -m services.regression.runner --suite-dir ../data/regression_suite

`shl_valid.pdf` / `shl_valid_expected.json` is a worked example seeded from the same
hand-labelled transcription used in `tests/fixtures/sample_documents.py`.

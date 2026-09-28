# Regression suite

Ground-truth pairs for `services/regression/runner.py`. Naming convention:

    <name>.<pdf|png|jpg|...>       # the source document
    <name>_expected.json           # hand-labelled ground truth, in the shape of
                                    # schemas.extraction.DocumentExtraction

Run the suite (needs a real `GEMINI_API_KEY` in `.env` — it calls the live model):

    cd backend && python -m services.regression.runner --suite-dir ../data/regression_suite

`shl_valid.pdf` / `shl_valid_expected.json` is a worked example seeded from the
same hand-labelled transcription used in `tests/fixtures/sample_documents.py`.

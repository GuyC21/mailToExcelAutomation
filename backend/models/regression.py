from sqlalchemy import Column, Integer, String, DateTime, JSON, Float, Boolean, ForeignKey
from sqlalchemy.sql import func
from database import Base

class RegressionTestCase(Base):
    __tablename__ = "regression_test_cases"

    id = Column(Integer, primary_key=True, index=True)
    file_path = Column(String, unique=True, index=True)
    expected_data = Column(JSON, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class RegressionRun(Base):
    """One persisted execution of the regression suite ("Run History").

    Written exactly once, right after ``RegressionRunner.run()`` finishes
    successfully (see ``api/routes/regression.py``) - a plain snapshot of the
    resulting ``RegressionReport`` (``services/regression/runner.py``). This
    table never recomputes or re-derives a score; it only remembers past
    results, so reloading the Regression page - or comparing two runs -
    doesn't require re-running the suite against the LLM.

    Prompt identity (``prompt_name``/``prompt_is_active``) is duplicated
    alongside the FK on purpose: a prompt version can be edited or deleted
    later (see ``api/routes/prompts.py``), and a run should stay meaningful
    in History/Compare even then.
    """
    __tablename__ = "regression_runs"

    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    prompt_version_id = Column(Integer, ForeignKey("prompt_versions.id"), nullable=True, index=True)
    prompt_name = Column(String, nullable=True)
    prompt_is_active = Column(Boolean, nullable=True)

    suite_dir = Column(String, nullable=False)
    generated_at = Column(String, nullable=False)  # ISO timestamp, as produced by the report itself
    pass_threshold = Column(Float, nullable=False)
    providers = Column(JSON, nullable=False, default=list)  # ["gemini/gemini-1.5-pro", ...]
    warnings = Column(JSON, nullable=False, default=list)  # suite-discovery warnings (orphan files, etc.)

    total = Column(Integer, nullable=False, default=0)
    passed = Column(Integer, nullable=False, default=0)
    failed = Column(Integer, nullable=False, default=0)
    scored = Column(Integer, nullable=False, default=0)
    coverage = Column(Float, nullable=False, default=0.0)
    average_score = Column(Float, nullable=False, default=0.0)
    scored_average_score = Column(Float, nullable=False, default=0.0)

    # Full per-case breakdown: [TestCaseResult.to_dict(), ...] - identical to
    # what the (non-persisted) live run already returns to the frontend.
    results = Column(JSON, nullable=False, default=list)

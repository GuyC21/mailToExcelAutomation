from sqlalchemy import Column, Integer, String, DateTime, JSON, Float, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from database import Base

class RegressionTestCase(Base):
    __tablename__ = "regression_test_cases"

    id = Column(Integer, primary_key=True, index=True)
    file_path = Column(String, unique=True, index=True)
    expected_data = Column(JSON, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class RegressionRun(Base):
    __tablename__ = "regression_runs"

    id = Column(Integer, primary_key=True, index=True)
    prompt_version_id = Column(Integer, ForeignKey("prompt_versions.id"))
    overall_accuracy = Column(Float, nullable=True)
    results = Column(JSON, nullable=True) # Detailed field-by-field diff
    created_at = Column(DateTime(timezone=True), server_default=func.now())

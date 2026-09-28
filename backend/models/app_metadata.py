"""Small key/value table for installation-level facts (e.g. the DB identity).

A new table rather than a new column on an existing one: ``create_all`` adds
missing tables to an existing database but never alters existing ones, so
this needs no migration on deployments that already have data.
"""
from sqlalchemy import Column, String

from database import Base


class AppMetadata(Base):
    """One installation-level setting."""

    __tablename__ = "app_metadata"

    key = Column(String(100), primary_key=True)
    value = Column(String(500), nullable=False)

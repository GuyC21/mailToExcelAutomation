"""Pydantic schemas for Excel workbook synchronization responses."""
from typing import List, Optional

from pydantic import BaseModel


class SyncResult(BaseModel):
    """Outcome of a manual Excel sync (mirrors ``services.excel_sync.sync_pending``)."""

    synced: List[int]
    pending: int
    error: Optional[str] = None

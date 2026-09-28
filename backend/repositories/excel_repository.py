"""The Excel workbook that serves as GoldenCare's source of truth.

Writes are serialised with a lock and saved atomically (temp file + replace)
so a crash mid-write can never corrupt the accumulated workbook. If the file
is locked (typically: open in Excel on Windows) ``ExcelLockedError`` is raised
and the caller keeps the rows pending in the DB for the next sync.

Workbook identity: rows are keyed by the DB's ingestion id, so a workbook is
only meaningful next to the database that produced it. Each workbook is
stamped (document property ``identifier``) with the database's identity token;
``services.excel_sync`` compares the two and, on a mismatch or a missing file,
archives the foreign workbook and rebuilds from the database instead of
merging unrelated rows that happen to share ids. The database is authoritative
(edits made in the Review page go through it); an archived workbook is never
deleted.

Every value that came from outside (email metadata, model output) is written
as a literal string, never a formula.
"""
import logging
import os
import threading
import zipfile
from datetime import datetime
from typing import Iterable, List, Optional

from openpyxl import Workbook, load_workbook
from openpyxl.utils.exceptions import InvalidFileException
from openpyxl.styles import Alignment, Font, PatternFill

from repositories.excel_layout import (
    DOCUMENT_COLUMNS, DOCUMENTS_SHEET, LINE_COLUMNS, LINES_SHEET, STATUS_FILLS, STATUS_LABELS, Column,
)

logger = logging.getLogger(__name__)
_HEADER_FILL = PatternFill("solid", fgColor="1F3864")
_STATUS_COL = [c.header for c in DOCUMENT_COLUMNS].index("סטטוס") + 1


class ExcelLockedError(RuntimeError):
    """The workbook cannot be written right now (e.g. open in Excel)."""


def _set_literal(cell, value) -> None:
    """Writes ``value``; text is always stored as a string, never a formula.

    openpyxl turns any string starting with ``=`` into a formula cell, so an
    email subject like ``=HYPERLINK(...)`` would change meaning when opened
    in Excel. The application never writes formulas on purpose.
    """
    cell.value = value
    if isinstance(value, str):
        cell.data_type = "s"


class ExcelRepository:
    """Access to the master workbook (upsert by ingestion id)."""

    def __init__(self, file_path: str):
        self.file_path = file_path
        self._lock = threading.Lock()

    # ---- structure -------------------------------------------------------
    def ensure_workbook(self, identity: Optional[str] = None) -> bool:
        """Creates the workbook, archiving any file with an outdated layout.

        Args:
            identity: Database identity token to stamp on a newly created workbook.

        Returns:
            True if a new (empty) workbook was created, i.e. the caller must
            repopulate it from the database.
        """
        os.makedirs(os.path.dirname(self.file_path) or ".", exist_ok=True)
        with self._lock:
            if os.path.exists(self.file_path) and not self._has_current_layout():
                self._archive("legacy")
            if not os.path.exists(self.file_path):
                self._save(self._new_workbook(identity))
                return True
            return False

    def read_identity(self) -> Optional[str]:
        """The identity token stamped on the workbook (None if absent/unstamped)."""
        if not os.path.exists(self.file_path):
            return None
        workbook = load_workbook(self.file_path, read_only=True)
        try:
            return workbook.properties.identifier or None
        finally:
            workbook.close()

    def replace_with_new(self, identity: str, reason: str) -> Optional[str]:
        """Archives the current workbook (if any) and creates an empty one.

        Returns:
            The archive path, or None if there was no workbook to archive.

        Raises:
            ExcelLockedError: The current workbook is open/locked and cannot be moved.
        """
        with self._lock:
            archived = self._archive(reason) if os.path.exists(self.file_path) else None
            self._save(self._new_workbook(identity))
            return archived

    def _archive(self, reason: str) -> str:
        """Moves the current file aside (never deletes it). Caller holds the lock."""
        base, extension = os.path.splitext(self.file_path)
        archived = f"{base}.{reason}-{datetime.now():%Y%m%d-%H%M%S-%f}{extension or '.xlsx'}"
        try:
            os.replace(self.file_path, archived)
        except OSError as error:
            raise ExcelLockedError("קובץ האקסל נעול (כנראה פתוח באקסל). הנתונים נשמרו ויסונכרנו בהמשך.") from error
        logger.warning("Workbook archived (%s) to %s", reason, archived)
        return archived

    def _has_current_layout(self) -> bool:
        try:
            workbook = load_workbook(self.file_path, read_only=True)
        except (zipfile.BadZipFile, InvalidFileException, KeyError):
            return False  # unreadable file: archived and replaced, never overwritten in place
        try:
            if DOCUMENTS_SHEET not in workbook.sheetnames or LINES_SHEET not in workbook.sheetnames:
                return False
            header = next(workbook[DOCUMENTS_SHEET].iter_rows(max_row=1, values_only=True), None)
            return header is not None and list(header) == [c.header for c in DOCUMENT_COLUMNS]
        finally:
            workbook.close()

    @staticmethod
    def _new_workbook(identity: Optional[str] = None) -> Workbook:
        workbook = Workbook()
        workbook.properties.identifier = identity
        workbook.active.title = DOCUMENTS_SHEET
        workbook.create_sheet(LINES_SHEET)
        for title, columns in ((DOCUMENTS_SHEET, DOCUMENT_COLUMNS), (LINES_SHEET, LINE_COLUMNS)):
            sheet = workbook[title]
            sheet.sheet_view.rightToLeft = True
            sheet.freeze_panes = "A2"
            sheet.append([c.header for c in columns])
            for index, column in enumerate(columns, start=1):
                cell = sheet.cell(row=1, column=index)
                cell.font, cell.fill = Font(bold=True, color="FFFFFF"), _HEADER_FILL
                cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
                sheet.column_dimensions[cell.column_letter].width = column.width
            sheet.auto_filter.ref = sheet.dimensions
        return workbook

    # ---- writes ----------------------------------------------------------
    def upsert_records(self, records: List[dict]) -> List[int]:
        """Inserts or updates documents (+ their lines).

        Returns:
            The ingestion ids now present in the workbook.
        """
        with self._lock:
            workbook = load_workbook(self.file_path)
            documents, lines = workbook[DOCUMENTS_SHEET], workbook[LINES_SHEET]
            
            # Map existing document rows: {ingestion_id: row_index (1-based)}
            doc_rows = {row[0]: idx for idx, row in enumerate(documents.iter_rows(min_row=2, max_col=1, values_only=True), start=2)}
            
            for record in records:
                ingestion_id = record["ingestion_id"]
                if ingestion_id in doc_rows:
                    # Update existing document row
                    doc_row_idx = doc_rows[ingestion_id]
                    for col_idx, column in enumerate(DOCUMENT_COLUMNS, start=1):
                        _set_literal(documents.cell(row=doc_row_idx, column=col_idx), column.value(record))
                        
                    status_cell = documents.cell(row=doc_row_idx, column=_STATUS_COL)
                    status_cell.fill = PatternFill("solid", fgColor=STATUS_FILLS.get(record["status"], "FFFFFF"))
                    
                    # Delete existing line items for this record
                    # Collect from bottom to top to avoid shifting indices
                    lines_to_delete = []
                    for idx, row in enumerate(lines.iter_rows(min_row=2, max_col=1, values_only=True), start=2):
                        if row[0] == ingestion_id:
                            lines_to_delete.append(idx)
                    
                    for idx in reversed(lines_to_delete):
                        lines.delete_rows(idx)
                        
                    # Re-append line items
                    for line in (record.get("data") or {}).get("line_items") or []:
                        self._append_row(lines, LINE_COLUMNS, {"record": record, "line": line})
                else:
                    self._append_row(documents, DOCUMENT_COLUMNS, record)
                    status_cell = documents.cell(row=documents.max_row, column=_STATUS_COL)
                    status_cell.fill = PatternFill("solid", fgColor=STATUS_FILLS.get(record["status"], "FFFFFF"))
                    for line in (record.get("data") or {}).get("line_items") or []:
                        self._append_row(lines, LINE_COLUMNS, {"record": record, "line": line})
            for sheet in (documents, lines):
                sheet.auto_filter.ref = sheet.dimensions
            self._save(workbook)
            return [r["ingestion_id"] for r in records]

    def delete_record(self, ingestion_id: int) -> bool:
        """Deletes a document and its lines from the workbook.

        Returns:
            True if deleted, False if not found.
        """
        with self._lock:
            workbook = load_workbook(self.file_path)
            documents, lines = workbook[DOCUMENTS_SHEET], workbook[LINES_SHEET]
            
            # Find document row
            doc_row_idx = None
            for idx, row in enumerate(documents.iter_rows(min_row=2, max_col=1, values_only=True), start=2):
                if row[0] == ingestion_id:
                    doc_row_idx = idx
                    break
                    
            if doc_row_idx is not None:
                documents.delete_rows(doc_row_idx)
                
                lines_to_delete = []
                for idx, row in enumerate(lines.iter_rows(min_row=2, max_col=1, values_only=True), start=2):
                    if row[0] == ingestion_id:
                        lines_to_delete.append(idx)
                
                for idx in reversed(lines_to_delete):
                    lines.delete_rows(idx)
                    
                self._save(workbook)
                return True
                
            return False

    @staticmethod
    def _append_row(sheet, columns: Iterable[Column], source: dict) -> None:
        row = sheet.max_row + 1
        for index, column in enumerate(columns, start=1):
            cell = sheet.cell(row=row, column=index)
            _set_literal(cell, column.value(source))
            cell.alignment = Alignment(vertical="top", wrap_text=True)
            if column.number_format:
                cell.number_format = column.number_format

    def _save(self, workbook: Workbook) -> None:
        temp_path = f"{self.file_path}.tmp"
        try:
            workbook.save(temp_path)
            os.replace(temp_path, self.file_path)
        except OSError as error:  # PermissionError / EBUSY when Excel holds the file
            raise ExcelLockedError("קובץ האקסל נעול (כנראה פתוח באקסל). הנתונים נשמרו ויסונכרנו בהמשך.") from error
        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)

    # ---- reads -----------------------------------------------------------
    def preview(self, limit: int = 10) -> dict:
        """Latest document rows (newest first) and per-status counts."""
        if not os.path.exists(self.file_path):
            return {"headers": [], "rows": [], "counts": {}, "total": 0, "updated_at": None}
        workbook = load_workbook(self.file_path, read_only=True)
        try:
            sheet = workbook[DOCUMENTS_SHEET]
            rows = list(sheet.iter_rows(values_only=True))
        finally:
            workbook.close()
        headers, body = list(rows[0]), rows[1:]
        status_index = _STATUS_COL - 1
        counts = {code: sum(1 for r in body if r[status_index] == label) for code, label in STATUS_LABELS.items()}
        latest = [[self._jsonable(v) for v in row] for row in reversed(body[-limit:])]
        updated = datetime.fromtimestamp(os.path.getmtime(self.file_path)).isoformat(timespec="seconds")
        return {"headers": headers, "rows": latest, "counts": counts, "total": len(body), "updated_at": updated}

    @staticmethod
    def _jsonable(value):
        return value.isoformat() if hasattr(value, "isoformat") else value

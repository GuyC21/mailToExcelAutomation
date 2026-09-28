"""Column layout of the GoldenCare master workbook (Hebrew, RTL).

Two sheets, by design:
    * "מסמכים"      – one row per ingested document, INCLUDING failures, with a
                      colour-coded status and the list of issues found. Keeping
                      failures in the main sheet (instead of a side sheet) means
                      nothing can be silently missing from the source of truth.
    * "שורות חיוב"  – one row per charge line, linked by ingestion id.
"""
from datetime import date
from typing import Any, Callable, List, NamedTuple, Optional

DOCUMENTS_SHEET = "מסמכים"
LINES_SHEET = "שורות חיוב"
MONEY = "#,##0.00"
DATE = "DD/MM/YYYY"
DATETIME = "DD/MM/YYYY HH:MM"

STATUS_LABELS = {"VALID": "תקין", "NEEDS_REVIEW": "דורש בדיקה", "EXTRACTION_FAILED": "חילוץ נכשל"}
STATUS_FILLS = {"VALID": "C6EFCE", "NEEDS_REVIEW": "FFEB9C", "EXTRACTION_FAILED": "FFC7CE"}
CHANNEL_LABELS = {"email": "מייל נכנס", "sandbox": "העלאה ידנית"}


class Column(NamedTuple):
    header: str
    width: int
    value: Callable[[dict], Any]
    number_format: Optional[str] = None


def _data(record: dict, key: str) -> Any:
    return (record.get("data") or {}).get(key)


def _as_date(value: Optional[str]) -> Any:
    try:
        return date.fromisoformat(value) if value else None
    except ValueError:
        return value


def _issues_text(record: dict) -> str:
    if record.get("error"):
        return record["error"]
    return "\n".join(f"• {i['message']}" for i in record.get("issues") or [] if i.get("severity") == "error")


DOCUMENT_COLUMNS: List[Column] = [
    Column("מזהה קליטה", 11, lambda r: r["ingestion_id"]),
    Column("תאריך קליטה", 17, lambda r: r["ingested_at"], DATETIME),
    Column("סטטוס", 13, lambda r: STATUS_LABELS.get(r["status"], r["status"])),
    Column("בעיות שזוהו", 55, _issues_text),
    Column("ערוץ", 12, lambda r: CHANNEL_LABELS.get(r["channel"], r["channel"])),
    Column("שולח", 28, lambda r: r.get("sender")),
    Column("נושא המייל", 30, lambda r: r.get("subject")),
    Column("קובץ מקור", 35, lambda r: r.get("filename")),
    Column("ספק", 34, lambda r: _data(r, "supplier_name")),
    Column("ח.פ ספק", 12, lambda r: _data(r, "supplier_tax_id")),
    Column("סוג מסמך", 18, lambda r: _data(r, "document_type")),
    Column("מספר מסמך", 15, lambda r: _data(r, "document_number")),
    Column("תאריך מסמך", 12, lambda r: _as_date(_data(r, "document_date")), DATE),
    Column("תקופה - מ", 12, lambda r: _as_date(_data(r, "billing_period_start")), DATE),
    Column("תקופה - עד", 12, lambda r: _as_date(_data(r, "billing_period_end")), DATE),
    Column("מטבע", 7, lambda r: _data(r, "currency")),
    Column("סה\"כ לפני מע\"מ", 14, lambda r: _data(r, "subtotal"), MONEY),
    Column("שיעור מע\"מ %", 10, lambda r: _data(r, "vat_rate")),
    Column("מע\"מ", 12, lambda r: _data(r, "vat_amount"), MONEY),
    Column("סה\"כ לתשלום", 14, lambda r: _data(r, "total_amount"), MONEY),
    Column("מס' שורות", 9, lambda r: len(_data(r, "line_items") or [])),
    Column("מנוע חילוץ", 22, lambda r: "/".join(x for x in (r.get("provider"), r.get("model")) if x) or None),
    Column("גרסת פרומפט", 26, lambda r: r.get("prompt_name")),
]


def _line_check(record: dict, line: dict) -> str:
    codes = {i["code"] for i in record.get("issues") or [] if i.get("line_number") == line.get("line_number")}
    if "LINE_MISSING_AMOUNT" in codes:
        return "חסר סכום"
    return "שגיאת חישוב" if "LINE_MATH_MISMATCH" in codes else "תקין"


LINE_COLUMNS: List[Column] = [
    Column("מזהה קליטה", 11, lambda r: r["record"]["ingestion_id"]),
    Column("ספק", 34, lambda r: _data(r["record"], "supplier_name")),
    Column("מספר מסמך", 15, lambda r: _data(r["record"], "document_number")),
    Column("מס' שורה", 8, lambda r: r["line"].get("line_number")),
    Column("תאריך שירות", 12, lambda r: _as_date(r["line"].get("service_date")), DATE),
    Column("תיאור", 60, lambda r: r["line"].get("description")),
    Column("כמות", 9, lambda r: r["line"].get("quantity")),
    Column("מחיר יחידה", 12, lambda r: r["line"].get("unit_price"), MONEY),
    Column("סה\"כ שורה", 13, lambda r: r["line"].get("line_total"), MONEY),
    Column("בדיקת חישוב", 12, lambda r: _line_check(r["record"], r["line"])),
]

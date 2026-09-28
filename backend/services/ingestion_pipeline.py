"""End-to-end pipeline: document -> AI extraction -> validation -> DB -> Excel.

Both entry points (inbound email webhook and Sandbox upload) go through
``ingest_document`` so the demo exercises exactly the production path.
"""
import logging
from functools import lru_cache
from typing import List, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from config import get_settings
from models.ingestion import DocumentIngestion, InboundEmail
from repositories.prompt_repository import get_active_prompt
from schemas.email_payload import InboundEmailPayload
from schemas.ingestion import ExcelWriteResult, IngestionResult
from services.excel_sync import sync_pending
from services.extraction.extractor import DocumentExtractor
from services.file_storage import UnsupportedDocumentError, detect_document_type, safe_filename, store_document
from services.validation.business_rules import STATUS_FAILED, derive_status, validate_document

logger = logging.getLogger(__name__)
STATUS_SKIPPED = "SKIPPED"


class NoActivePromptError(RuntimeError):
    """The Backoffice has no active prompt, so nothing can be extracted."""


@lru_cache
def get_extractor() -> DocumentExtractor:
    return DocumentExtractor.from_settings()


async def ingest_document(db: AsyncSession, *, filename: str, content: bytes, channel: str,
                          email: Optional[InboundEmail] = None) -> IngestionResult:
    """Processes one document and records the outcome, whatever it is.

    This function represents the core ingestion flow. It extracts data from the document
    using the currently active LLM prompt, applies business validations to the extracted
    data, stores the record in the database, and attempts to sync it to Excel. It is 
    designed to ensure that even failed extractions are recorded for audit purposes.

    Args:
        db (AsyncSession): The database session.
        filename (str): The name of the uploaded or emailed file.
        content (bytes): The raw file bytes.
        channel (str): The ingestion source channel (e.g., "webhook", "email").
        email (Optional[InboundEmail]): The associated email record, if ingested via email.

    Returns:
        IngestionResult: The result of the ingestion process, including extraction data,
            validation issues, and Excel sync status.

    Raises:
        UnsupportedDocumentError: The file is not a valid PDF or image.
        NoActivePromptError: No prompt is active in the Backoffice.
    """
    prompt = await get_active_prompt(db)
    if not prompt:
        raise NoActivePromptError("אין פרומפט פעיל. יש להפעיל פרומפט במסך ניהול הפרומפטים.")
    stored = store_document(filename, content)
    outcome = await get_extractor().extract(prompt.content, stored.stored_path, stored.mime_type)

    settings = get_settings()
    if outcome.succeeded:
        findings = validate_document(outcome.data, settings.default_vat_rate, settings.amount_tolerance)
        status, issues = derive_status(findings), [f.to_dict() for f in findings]
        data = outcome.data.model_dump()
    else:
        issues, status, data = [], STATUS_FAILED, None

    record = DocumentIngestion(
        email_id=email.id if email else None, channel=channel,
        original_filename=stored.original_filename, stored_path=stored.stored_path,
        content_type=stored.mime_type, size_bytes=stored.size_bytes,
        prompt_version_id=prompt.id, prompt_name=prompt.name,
        provider=outcome.provider, model=outcome.model, status=status, issues=issues,
        extracted_data=data, attempts=outcome.attempts, raw_response=outcome.raw_response,
        error=outcome.error or None, excel_synced=False,
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)
    logger.info("Ingestion %s (%s) -> %s via %s", record.id, channel, status, outcome.provider)

    sync = await sync_pending(db)
    written = record.id in sync["synced"]
    return IngestionResult(
        ingestion_id=record.id, filename=record.original_filename, channel=channel, status=status,
        provider=outcome.provider, model=outcome.model, prompt_version_id=prompt.id,
        prompt_name=prompt.name, data=data, issues=issues, error=record.error,
        attempts=outcome.attempts, excel=ExcelWriteResult(written=written, message=sync["error"]),
    )


async def ingest_email(db: AsyncSession, payload: InboundEmailPayload) -> tuple[InboundEmail, List[IngestionResult]]:
    """Persists the email, then ingests every supported attachment.

    This ensures every inbound email is logged before processing its attachments,
    providing full traceability from the original email to the extracted documents.
    Unsupported attachments (like signatures or Word documents) are reported as SKIPPED
    rather than ignored, so the sender-side view stays complete and reflects reality.

    Args:
        db (AsyncSession): The database session.
        payload (InboundEmailPayload): The parsed email payload.

    Returns:
        tuple[InboundEmail, List[IngestionResult]]: The persisted email record and
            the results for each processed attachment.
    """
    email = InboundEmail(
        source_format=payload.source_format, message_id=payload.message_id, sender=payload.sender,
        recipients=payload.recipients, subject=payload.subject, sent_at=payload.sent_at,
        body_text=payload.body_text, headers=payload.headers,
    )
    db.add(email)
    await db.commit()
    await db.refresh(email)

    results: List[IngestionResult] = []
    for attachment in payload.attachments:
        name = safe_filename(attachment.filename)
        if not detect_document_type(name, attachment.content):
            results.append(IngestionResult(filename=name, channel="email", status=STATUS_SKIPPED,
                                           error="הקובץ אינו PDF או תמונה – לא עובד כטופס התחשבנות"))
            continue
        try:
            results.append(await ingest_document(db, filename=name, content=attachment.content,
                                                 channel="email", email=email))
        except UnsupportedDocumentError as error:
            results.append(IngestionResult(filename=name, channel="email", status=STATUS_SKIPPED, error=str(error)))
    return email, results

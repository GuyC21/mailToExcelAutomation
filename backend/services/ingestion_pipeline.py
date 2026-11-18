"""End-to-end pipeline: document -> AI extraction -> validation -> DB -> Excel.

Both entry points (inbound email webhook and Sandbox upload) go through
``ingest_document`` so the demo exercises exactly the production path.
"""
import hashlib
import logging
from datetime import datetime, timedelta, timezone
from functools import lru_cache
from typing import List, Optional, Tuple

from sqlalchemy import delete, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from config import get_settings
from database import async_session
from models.ingestion import DocumentIngestion, InboundEmail, STATUS_PROCESSING
from models.processed_attachment import ProcessedAttachment
from repositories.prompt_repository import get_active_prompt
from schemas.email_payload import InboundEmailPayload
from schemas.ingestion import ExcelWriteResult, IngestionResult
from services.excel_sync import sync_pending
from services.extraction.extractor import DocumentExtractor
from services.file_storage import UnsupportedDocumentError, detect_document_type, safe_filename, store_document
from services.validation.business_rules import STATUS_FAILED, derive_status, validate_document

logger = logging.getLogger(__name__)
STATUS_SKIPPED = "SKIPPED"
# A claim still unfinished after this long belongs to a worker that died
# mid-extraction; a retry may take it over.
_STALE_CLAIM = timedelta(minutes=15)


class NoActivePromptError(RuntimeError):
    """The Backoffice has no active prompt, so nothing can be extracted."""


@lru_cache
def get_extractor() -> DocumentExtractor:
    return DocumentExtractor.from_settings()


async def ingest_document(db: AsyncSession, *, filename: str, content: bytes, channel: str,
                          email: Optional[InboundEmail] = None,
                          claim_key: Optional[str] = None,
                          extractor: Optional[DocumentExtractor] = None,
                          user_id: Optional[str] = None) -> IngestionResult:
    """Processes one document and records the outcome, whatever it is.

    Uses a **two-stage persistence** strategy so that the Sandbox UI can track
    in-flight jobs across browser refreshes:

    * **Stage 1 (Pre-LLM):** A ``PROCESSING`` record is committed before the
      (potentially slow) extraction call, giving the frontend a persistent
      anchor to poll.
    * **Stage 2 (Post-LLM):** The same record is updated with extraction
      results, validation status, and the final status.

    If the extraction crashes, a **crash guard** ensures the record is updated
    to ``EXTRACTION_FAILED`` with the error message rather than being left
    in ``PROCESSING`` indefinitely.

    Args:
        db: The database session.
        filename: The name of the uploaded or emailed file.
        content: The raw file bytes.
        channel: The ingestion source channel (e.g., "webhook", "email", "sandbox").
        email: The associated email record, if ingested via email.
        claim_key: Idempotency claim to complete in the same commit as the record
            (email channel), so the record and its claim can never disagree.
        extractor: Optional request-scoped extractor honoring BYOK credentials.
            If omitted, falls back to the default extractor.
        user_id: UUID of the authenticated user who initiated the ingestion.
            Set for Sandbox operations; None for production webhooks.

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
    active_extractor = extractor or get_extractor()

    # ── Stage 1: Pre-LLM — persist a PROCESSING placeholder ────────────
    record = DocumentIngestion(
        email_id=email.id if email else None, channel=channel,
        original_filename=stored.original_filename, stored_path=stored.stored_path,
        content_type=stored.mime_type, size_bytes=stored.size_bytes,
        prompt_version_id=prompt.id, prompt_name=prompt.name,
        status=STATUS_PROCESSING, excel_synced=False,
        created_by_id=user_id,
    )
    db.add(record)
    if claim_key:
        await db.flush()  # assigns record.id
        await db.execute(update(ProcessedAttachment)
                         .where(ProcessedAttachment.dedupe_key == claim_key)
                         .values(ingestion_id=record.id))
    await db.commit()
    await db.refresh(record)
    logger.info("Stage-1: ingestion %s (%s) → PROCESSING for user %s", record.id, channel, user_id or "system")

    # ── Stage 2: Post-LLM — extract, validate, finalize ────────────────
    try:
        outcome = await active_extractor.extract(prompt.content, stored.stored_path, stored.mime_type)
    except Exception as exc:
        # Crash guard: mark the record as failed so it doesn't stay PROCESSING forever
        record.status = STATUS_FAILED
        record.error = str(exc)
        await db.commit()
        logger.error("Extraction crashed for ingestion %s: %s", record.id, exc)
        raise

    settings = get_settings()
    if outcome.succeeded:
        findings = validate_document(outcome.data, settings.default_vat_rate, settings.amount_tolerance)
        status, issues = derive_status(findings), [f.to_dict() for f in findings]
        data = outcome.data.model_dump()
    else:
        issues, status, data = [], STATUS_FAILED, None

    record.provider = outcome.provider
    record.model = outcome.model
    record.status = status
    record.issues = issues
    record.extracted_data = data
    record.attempts = outcome.attempts
    record.raw_response = outcome.raw_response
    record.error = outcome.error or None
    await db.commit()
    await db.refresh(record)
    logger.info("Stage-2: ingestion %s (%s) → %s via %s", record.id, channel, status, outcome.provider)

    sync = await sync_pending(db)
    written = record.id in sync["synced"]
    return IngestionResult(
        ingestion_id=record.id, filename=record.original_filename, channel=channel, status=status,
        provider=outcome.provider, model=outcome.model, prompt_version_id=prompt.id,
        prompt_name=prompt.name, data=data, issues=issues, error=record.error,
        attempts=outcome.attempts, excel=ExcelWriteResult(written=written, message=sync["error"]),
    )


async def ingest_email(
    db: AsyncSession,
    payload: InboundEmailPayload,
    extractor: Optional[DocumentExtractor] = None,
    user_id: Optional[str] = None,
) -> tuple[InboundEmail, List[IngestionResult]]:
    """Persists the email, then ingests every supported attachment.

    This ensures every inbound email is logged before processing its attachments,
    providing full traceability from the original email to the extracted documents.
    Unsupported attachments (like signatures or Word documents) are reported as SKIPPED
    rather than ignored, so the sender-side view stays complete and reflects reality.

    Args:
        db: The active asynchronous database session.
        payload: The parsed email payload.
        extractor: Optional scoped extractor. When provided (e.g. from Sandbox
            simulations), it strictly enforces user BYOK credentials. When None
            (production webhook), falls back to the system-wide Server API Key.
        user_id: UUID of the authenticated user who initiated the ingestion.
            Set for Sandbox simulation; None for production webhooks.

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
    max_mb = get_settings().max_upload_mb
    for attachment in payload.attachments:
        name = safe_filename(attachment.filename)
        if attachment.oversized:
            results.append(IngestionResult(filename=name, channel="email", status=STATUS_SKIPPED,
                                           error=f"הקובץ גדול מ-{max_mb}MB ולכן לא עובד"))
            continue
        if not detect_document_type(name, attachment.content):
            results.append(IngestionResult(filename=name, channel="email", status=STATUS_SKIPPED,
                                           error="הקובץ אינו PDF או תמונה – לא עובד כטופס התחשבנות"))
            continue

        key = _attachment_key(payload, attachment.content)
        claimed, prior_ingestion_id = await _claim_attachment(key)
        if not claimed:
            results.append(await _duplicate_result(db, name, prior_ingestion_id))
            continue
        try:
            result = await ingest_document(
                db,
                filename=name,
                content=attachment.content,
                channel="email",
                email=email,
                claim_key=key,
                extractor=extractor,
                user_id=user_id,
            )
        except UnsupportedDocumentError as error:
            await _release_claim(key)
            results.append(IngestionResult(filename=name, channel="email", status=STATUS_SKIPPED, error=str(error)))
            continue
        except BaseException:
            # Only releases a claim that never got a record (see _release_claim),
            # so the provider's retry can process the attachment.
            await _release_claim(key)
            raise
        results.append(result)
    return email, results


# ---------------------------------------------------------------------------
# Idempotency: at most one financial record per (delivery, attachment content).
# Claims use their own short sessions so an IntegrityError rollback can never
# expire objects held by the request's session.
# ---------------------------------------------------------------------------

def _attachment_key(payload: InboundEmailPayload, content: bytes) -> str:
    """Digest of the delivery identity and the attachment's bytes."""
    delivery = payload.delivery_key or f"mid:{payload.message_id}"
    return hashlib.sha256(delivery.encode("utf-8") + b"\x00" + hashlib.sha256(content).digest()).hexdigest()


async def _claim_attachment(key: str) -> Tuple[bool, Optional[int]]:
    """Tries to reserve ``key`` for processing.

    Returns:
        ``(True, None)`` if this call owns the attachment now, otherwise
        ``(False, prior_ingestion_id)`` – the id is None while another
        delivery is still processing it.
    """
    async with async_session() as session:
        session.add(ProcessedAttachment(dedupe_key=key))
        try:
            await session.commit()
            return True, None
        except IntegrityError:
            await session.rollback()

        existing = (await session.execute(
            select(ProcessedAttachment).where(ProcessedAttachment.dedupe_key == key))).scalars().first()
        if existing is None:  # released between our insert and this read – try once more
            session.add(ProcessedAttachment(dedupe_key=key))
            try:
                await session.commit()
                return True, None
            except IntegrityError:
                await session.rollback()
                return False, None
        if existing.ingestion_id is not None:
            return False, existing.ingestion_id

        # Take over a stale claim atomically: the condition is re-checked by
        # the UPDATE itself, so of two concurrent retries only one matches.
        stale_before = datetime.now(timezone.utc) - _STALE_CLAIM
        taken = await session.execute(
            update(ProcessedAttachment)
            .where(ProcessedAttachment.id == existing.id,
                   ProcessedAttachment.ingestion_id.is_(None),
                   ProcessedAttachment.claimed_at < stale_before)
            .values(claimed_at=datetime.now(timezone.utc))
            # Decided by the database alone; no in-memory evaluation (SQLite
            # returns naive datetimes, which can't be compared to aware ones).
            .execution_options(synchronize_session=False))
        await session.commit()
        if taken.rowcount == 1:
            logger.warning("Took over a stale ingestion claim %s", key[:12])
            return True, None
        return False, None


async def _release_claim(key: str) -> None:
    """Drops an unfinished claim so a later delivery can process the attachment."""
    async with async_session() as session:
        await session.execute(delete(ProcessedAttachment).where(
            ProcessedAttachment.dedupe_key == key, ProcessedAttachment.ingestion_id.is_(None)))
        await session.commit()


async def _duplicate_result(db: AsyncSession, filename: str, ingestion_id: Optional[int]) -> IngestionResult:
    """Reports a replayed attachment using the record created the first time."""
    if ingestion_id is None:
        return IngestionResult(filename=filename, channel="email", status=STATUS_SKIPPED, duplicate=True,
                               error="הקובץ כבר נמצא בעיבוד ממשלוח קודם של אותו מייל – לא נוצרה רשומה כפולה")
    record = (await db.execute(select(DocumentIngestion).where(DocumentIngestion.id == ingestion_id))).scalars().first()
    if record is None:
        return IngestionResult(filename=filename, channel="email", status=STATUS_SKIPPED, duplicate=True,
                               error="הקובץ כבר נקלט בעבר – לא נוצרה רשומה כפולה")
    return IngestionResult(
        ingestion_id=record.id, filename=record.original_filename, channel=record.channel, status=record.status,
        provider=record.provider, model=record.model, prompt_version_id=record.prompt_version_id,
        prompt_name=record.prompt_name, data=record.extracted_data, issues=record.issues or [],
        error=record.error, attempts=record.attempts or [], duplicate=True,
        excel=ExcelWriteResult(written=bool(record.excel_synced),
                               message="כפילות: המסמך נקלט כבר ממשלוח קודם של אותו מייל – לא נוצרה רשומה חדשה"),
    )

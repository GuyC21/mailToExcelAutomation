"""Sandbox Inbound Email Simulation Router (SIMULATION ENVIRONMENT).

This module contains dedicated simulation endpoints called by the Backoffice Sandbox
UI to simulate incoming supplier emails.

Separation of Concerns:
- Reality vs. Simulation: Production mail webhooks reside strictly in ``api.routes.email``.
- Security Boundary: These endpoints are gated by authenticated Backoffice user sessions
  (``require_approved_user``) and inject user BYOK credentials (``get_byok_credentials``).
- Quota Isolation: Extractions run exclusively through ``byok.get_extractor()``:
  - User BYOK key -> Uses user's personal API quota.
  - No key provided -> Uses ``MockProvider`` (deterministic mock, zero cost).
  - The production Server API Key (``GEMINI_API_KEY``) is physically inaccessible here.
"""
import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from api.dependencies.auth import require_approved_user
from api.dependencies.byok import BYOKCredentials, get_byok_credentials
from api.uploads import MB, UploadTooLargeError, read_upload_limited
from config import get_settings
from database import get_db
from models.user import UserProfile
from schemas.email_payload import EmailAttachment, InboundEmailPayload
from schemas.ingestion import EmailAttachmentInfo, EmailInfo, EmailIngestionResponse
from services.email_parser import EmailParseError, parse_eml, parse_multipart
from services.ingestion_pipeline import NoActivePromptError, ingest_email

logger = logging.getLogger("billingstream.simulation")
router = APIRouter()

_MAX_EML_BYTES = 25 * 1024 * 1024


async def _process_simulation(
    db: AsyncSession,
    payload: InboundEmailPayload,
    byok: BYOKCredentials,
    user_id: str,
) -> EmailIngestionResponse:
    """Internal helper to process a simulated email payload with strict BYOK credentials.

    Args:
        db: Active asynchronous database session.
        payload: Parsed email payload containing headers and attachments.
        byok: Ephemeral user BYOK credentials extracted from request headers.
        user_id: UUID of the authenticated user initiating the simulation.

    Returns:
        EmailIngestionResponse with email metadata and extraction results.

    Raises:
        HTTPException: 409 if no active prompt is configured.
    """
    try:
        # Strictly bound to byok.get_extractor(): Never falls back to server API key
        scoped_extractor = byok.get_extractor()
        email, results = await ingest_email(db, payload, extractor=scoped_extractor, user_id=user_id)
    except NoActivePromptError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error

    return EmailIngestionResponse(
        email=EmailInfo(
            id=email.id,
            source_format=email.source_format,
            message_id=email.message_id,
            sender=email.sender or "",
            recipients=email.recipients or "",
            subject=email.subject or "",
            sent_at=email.sent_at,
            body_text=email.body_text or "",
            headers=email.headers or {},
            attachments=[
                EmailAttachmentInfo(
                    filename=a.filename,
                    content_type=a.content_type,
                    size_bytes=a.size,
                )
                for a in payload.attachments
            ],
        ),
        results=results,
    )


@router.post(
    "/simulate",
    response_model=EmailIngestionResponse,
    summary="Simulate incoming supplier email (Sandbox Multipart)",
)
async def simulate_inbound_multipart(
    sender: str = Form(..., alias="from", max_length=500),
    to: str = Form("", max_length=1000),
    subject: str = Form("", max_length=1000),
    text: str = Form("", max_length=100_000),
    headers: str = Form("", max_length=50_000, description="Raw header block, one 'Name: value' per line"),
    attachments: List[UploadFile] = File(default=[]),
    byok: BYOKCredentials = Depends(get_byok_credentials),
    _user: UserProfile = Depends(require_approved_user),
    db: AsyncSession = Depends(get_db),
) -> EmailIngestionResponse:
    """Simulates an inbound email delivered as multipart form-data.

    Executes in the Sandbox environment using strictly BYOK or Mock extraction.

    Args:
        sender: Sender email address ('From' field).
        to: Recipient email address ('To' field).
        subject: Email subject line.
        text: Email body text.
        headers: Optional raw email headers string.
        attachments: Attached files (PDFs, images).
        byok: Scoped BYOK credentials extracted from request headers.
        _user: Verified approved Backoffice user.
        db: Active asynchronous database session.

    Returns:
        Structured EmailIngestionResponse.

    Raises:
        HTTPException: 400 for malformed content, 413 for oversized files.
    """
    settings = get_settings()
    if len(attachments) > settings.max_email_attachments:
        raise HTTPException(
            status_code=413,
            detail=f"יותר מ-{settings.max_email_attachments} קבצים מצורפים במייל אחד",
        )
    per_file = settings.max_upload_mb * MB
    files = []
    for upload in attachments:
        name, content_type = upload.filename or "attachment", upload.content_type or ""
        try:
            content = await read_upload_limited(upload, per_file)
        except UploadTooLargeError as error:
            # Reported per attachment (SKIPPED) so the email's other forms still process.
            files.append(EmailAttachment(
                filename=name, content_type=content_type, content=b"",
                oversized=True, original_size=error.args[0],
            ))
            continue
        files.append(EmailAttachment(filename=name, content_type=content_type, content=content))

    try:
        payload = parse_multipart(sender, to, subject, text, headers, files)
    except EmailParseError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    return await _process_simulation(db, payload, byok, user_id=str(_user.id))


@router.post(
    "/simulate/eml",
    response_model=EmailIngestionResponse,
    summary="Simulate incoming raw .eml file (Sandbox EML)",
)
async def simulate_inbound_eml(
    file: UploadFile = File(...),
    byok: BYOKCredentials = Depends(get_byok_credentials),
    _user: UserProfile = Depends(require_approved_user),
    db: AsyncSession = Depends(get_db),
) -> EmailIngestionResponse:
    """Simulates an inbound email by uploading a raw RFC 822 .eml file.

    Executes in the Sandbox environment using strictly BYOK or Mock extraction.

    Args:
        file: Uploaded .eml file.
        byok: Scoped BYOK credentials extracted from request headers.
        _user: Verified approved Backoffice user.
        db: Active asynchronous database session.

    Returns:
        Structured EmailIngestionResponse.

    Raises:
        HTTPException: 400 for malformed EML, 413 for files exceeding 25MB.
    """
    try:
        content = await read_upload_limited(file, _MAX_EML_BYTES)
        payload = parse_eml(content)
    except UploadTooLargeError as error:
        raise HTTPException(status_code=413, detail=str(error)) from error
    except EmailParseError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    return await _process_simulation(db, payload, byok, user_id=str(_user.id))

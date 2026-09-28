"""Inbound email webhook – the system's "mailbox".

No real mailbox is monitored (per the assignment); instead any mail provider
(SendGrid / Mailgun / Postmark) or the ``simulate`` tooling POSTs the email here.
Three wire formats are accepted, all normalised by ``services.email_parser``.
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from api.security import require_inbound_access
from api.uploads import MB, UploadTooLargeError, read_upload_limited, read_upload_or_413
from config import get_settings
from database import get_db
from schemas.email_payload import EmailAttachment, InboundEmailPayload, JsonEmailRequest
from schemas.ingestion import EmailAttachmentInfo, EmailInfo, EmailIngestionResponse
from services.email_parser import EmailParseError, parse_eml, parse_json, parse_multipart
from services.ingestion_pipeline import NoActivePromptError, ingest_email

_MAX_EML_BYTES = 25 * 1024 * 1024


# Shared-secret check for webhook callers (see ``api.security``): a valid
# ``X-Inbound-Token`` (mail provider) or Backoffice ``X-API-Key`` (Sandbox UI)
# is required as soon as either secret is configured.
router = APIRouter(dependencies=[Depends(require_inbound_access)])


async def _process(db: AsyncSession, payload: InboundEmailPayload) -> EmailIngestionResponse:
    """Internal helper to ingest an email payload and map to a standard response.

    Args:
        db (AsyncSession): The database session.
        payload (InboundEmailPayload): The parsed email payload containing metadata and attachments.

    Returns:
        EmailIngestionResponse: The ingestion result including email metadata and attachment processing statuses.

    Raises:
        HTTPException: If there is no active prompt configured (409).
    """
    try:
        email, results = await ingest_email(db, payload)
    except NoActivePromptError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    return EmailIngestionResponse(
        email=EmailInfo(
            id=email.id, source_format=email.source_format, message_id=email.message_id,
            sender=email.sender or "", recipients=email.recipients or "", subject=email.subject or "",
            sent_at=email.sent_at, body_text=email.body_text or "", headers=email.headers or {},
            attachments=[EmailAttachmentInfo(filename=a.filename, content_type=a.content_type, size_bytes=a.size)
                         for a in payload.attachments],
        ),
        results=results,
    )


@router.post("/inbound", response_model=EmailIngestionResponse)
async def inbound_multipart(
    sender: str = Form(..., alias="from", max_length=500),
    to: str = Form("", max_length=1000),
    subject: str = Form("", max_length=1000),
    text: str = Form("", max_length=100_000),
    headers: str = Form("", max_length=50_000, description="Raw header block, one 'Name: value' per line"),
    attachments: List[UploadFile] = File(default=[]),
    db: AsyncSession = Depends(get_db),
) -> EmailIngestionResponse:
    """Receives an email as multipart/form-data (SendGrid Inbound Parse style).

    Each PDF or image attachment is extracted, validated, and appended to the Excel source.
    This format is typically used by SendGrid when posting raw emails to webhooks.

    Args:
        sender (str): The sender's email address.
        to (str): The recipient's email address.
        subject (str): The email subject line.
        text (str): The plain text body of the email.
        headers (str): The raw email headers.
        attachments (List[UploadFile]): A list of attached files.
        db (AsyncSession): The database session dependency.

    Returns:
        EmailIngestionResponse: The parsed email info plus one extraction result per attachment.
    """
    settings = get_settings()
    if len(attachments) > settings.max_email_attachments:
        raise HTTPException(status_code=413,
                            detail=f"יותר מ-{settings.max_email_attachments} קבצים מצורפים במייל אחד")
    per_file = settings.max_upload_mb * MB
    files = []
    for upload in attachments:
        name, content_type = upload.filename or "attachment", upload.content_type or ""
        try:
            content = await read_upload_limited(upload, per_file)
        except UploadTooLargeError as error:
            # Reported per attachment (SKIPPED) so the email's other forms still process.
            files.append(EmailAttachment(filename=name, content_type=content_type, content=b"",
                                         oversized=True, original_size=error.args[0]))
            continue
        files.append(EmailAttachment(filename=name, content_type=content_type, content=content))
    return await _process(db, parse_multipart(sender, to, subject, text, headers, files))


@router.post("/inbound/json", response_model=EmailIngestionResponse)
async def inbound_json(request: JsonEmailRequest, db: AsyncSession = Depends(get_db)) -> EmailIngestionResponse:
    """Receives an email as JSON with base64-encoded attachments.

    This endpoint accommodates webhook providers that send structured JSON rather
    than multipart forms.

    Args:
        request (JsonEmailRequest): The JSON payload representing the email.
        db (AsyncSession): The database session dependency.

    Returns:
        EmailIngestionResponse: The parsed email info and extraction results.

    Raises:
        HTTPException: If the JSON payload cannot be parsed as a valid email (400).
    """
    try:
        payload = parse_json(request, max_attachment_bytes=get_settings().max_upload_mb * MB)
    except EmailParseError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    return await _process(db, payload)


@router.post("/inbound/eml", response_model=EmailIngestionResponse)
async def inbound_eml(file: UploadFile = File(..., description="A raw .eml (RFC 822) message"),
                      db: AsyncSession = Depends(get_db)) -> EmailIngestionResponse:
    """Receives a raw MIME email (.eml) – the most realistic payload for demos.

    This allows testing the system by uploading raw EML files exported from standard
    email clients (like Outlook or Gmail).

    Args:
        file (UploadFile): The raw .eml file.
        db (AsyncSession): The database session dependency.

    Returns:
        EmailIngestionResponse: The parsed email info and extraction results.

    Raises:
        HTTPException: If the file is too large (413) or cannot be parsed (400).
    """
    raw = await read_upload_or_413(file, _MAX_EML_BYTES, "קובץ המייל")
    try:
        payload = parse_eml(raw)
    except EmailParseError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    return await _process(db, payload)

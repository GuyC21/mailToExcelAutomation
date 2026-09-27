"""Inbound email webhook – the system's "mailbox".

No real mailbox is monitored (per the assignment); instead any mail provider
(SendGrid / Mailgun / Postmark) or the ``simulate`` tooling POSTs the email here.
Three wire formats are accepted, all normalised by ``services.email_parser``.
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from config import get_settings
from database import get_db
from schemas.email_payload import EmailAttachment, InboundEmailPayload, JsonEmailRequest
from schemas.ingestion import EmailAttachmentInfo, EmailInfo, EmailIngestionResponse
from services.email_parser import EmailParseError, parse_eml, parse_json, parse_multipart
from services.ingestion_pipeline import NoActivePromptError, ingest_email

_MAX_EML_BYTES = 25 * 1024 * 1024


def verify_inbound_token(x_inbound_token: Optional[str] = Header(None)) -> None:
    """Shared-secret check for webhook callers (enabled when configured)."""
    expected = get_settings().inbound_email_token
    if expected and x_inbound_token != expected:
        raise HTTPException(status_code=401, detail="Invalid inbound token")


router = APIRouter(dependencies=[Depends(verify_inbound_token)])


async def _process(db: AsyncSession, payload: InboundEmailPayload) -> EmailIngestionResponse:
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
):
    """Receives an email as multipart/form-data (SendGrid Inbound Parse style).

    Each PDF / image attachment is extracted, validated and appended to Excel.
    Returns the email as received plus one result per attachment.
    """
    files = [EmailAttachment(filename=f.filename or "attachment", content_type=f.content_type or "",
                             content=await f.read()) for f in attachments]
    return await _process(db, parse_multipart(sender, to, subject, text, headers, files))


@router.post("/inbound/json", response_model=EmailIngestionResponse)
async def inbound_json(request: JsonEmailRequest, db: AsyncSession = Depends(get_db)):
    """Receives an email as JSON with base64-encoded attachments."""
    try:
        payload = parse_json(request)
    except EmailParseError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    return await _process(db, payload)


@router.post("/inbound/eml", response_model=EmailIngestionResponse)
async def inbound_eml(file: UploadFile = File(..., description="A raw .eml (RFC 822) message"),
                      db: AsyncSession = Depends(get_db)):
    """Receives a raw MIME email (.eml) – the most realistic payload for demos."""
    raw = await file.read()
    if len(raw) > _MAX_EML_BYTES:
        raise HTTPException(status_code=413, detail="קובץ המייל גדול מדי")
    try:
        payload = parse_eml(raw)
    except EmailParseError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    return await _process(db, payload)

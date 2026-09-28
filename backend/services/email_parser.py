"""Turns the three supported inbound formats into ``InboundEmailPayload``.

Supported wire formats:
    * ``eml``       – a raw RFC 822 / MIME message (what a real mailbox stores).
    * ``multipart`` – form fields + files, like SendGrid's Inbound Parse webhook.
    * ``json``      – JSON with base64 attachments, like Postmark / Mailgun.
"""
import base64
import binascii
from datetime import datetime, timezone
from email import policy
from email.parser import BytesParser, HeaderParser
from email.utils import format_datetime, make_msgid
from typing import Dict, List

from schemas.email_payload import EmailAttachment, InboundEmailPayload, JsonEmailRequest


class EmailParseError(ValueError):
    """Raised for malformed email payloads (mapped to HTTP 400)."""


def _headers_dict(message) -> Dict[str, str]:
    """Flattens headers; repeated headers (e.g. Received) are joined."""
    result: Dict[str, str] = {}
    for key, value in message.items():
        result[key] = f"{result[key]}\n{value}" if key in result else str(value)
    return result


def _ensure_identity(payload: InboundEmailPayload) -> InboundEmailPayload:
    """Stamps Message-ID / Date when a webhook omits them, for traceability."""
    if not payload.message_id:
        payload.message_id = make_msgid(domain="inbound.goldencare.local")
        payload.headers.setdefault("Message-ID", payload.message_id)
    if not payload.sent_at:
        payload.sent_at = format_datetime(datetime.now(timezone.utc))
        payload.headers.setdefault("Date", payload.sent_at)
    return payload


def parse_eml(raw: bytes) -> InboundEmailPayload:
    """Parses a raw MIME message, decoding RFC 2047 Hebrew subjects/filenames.

    Handles native EML formats usually forwarded directly from mailboxes.
    Decodes potentially complex multi-part structures and properly extracts 
    base64/quoted-printable components.

    Args:
        raw (bytes): The raw bytes of the EML message.

    Returns:
        InboundEmailPayload: A standardized payload representation of the email.

    Raises:
        EmailParseError: If the message cannot be parsed or lacks MIME format.
    """
    try:
        message = BytesParser(policy=policy.default).parsebytes(raw)
    except Exception as error:
        raise EmailParseError(f"קובץ המייל אינו תקין: {error}") from error
    if not message.keys():
        raise EmailParseError("קובץ המייל ריק או אינו בפורמט MIME")
    body_part = message.get_body(preferencelist=("plain", "html"))
    attachments = [
        EmailAttachment(filename=part.get_filename() or "attachment.bin",
                        content_type=part.get_content_type(),
                        content=part.get_payload(decode=True) or b"")
        for part in message.iter_attachments()
    ]
    return _ensure_identity(InboundEmailPayload(
        source_format="eml",
        message_id=message.get("Message-ID"),
        sender=str(message.get("From", "")),
        recipients=str(message.get("To", "")),
        subject=str(message.get("Subject", "")),
        sent_at=message.get("Date"),
        body_text=body_part.get_content().strip() if body_part else "",
        headers=_headers_dict(message),
        attachments=attachments,
    ))


def parse_multipart(sender: str, to: str, subject: str, text: str, raw_headers: str,
                    attachments: List[EmailAttachment]) -> InboundEmailPayload:
    """Builds a payload from SendGrid-style form fields."""
    headers = _headers_dict(HeaderParser().parsestr(raw_headers)) if raw_headers else {}
    headers.setdefault("From", sender)
    headers.setdefault("To", to)
    headers.setdefault("Subject", subject)
    return _ensure_identity(InboundEmailPayload(
        source_format="multipart", message_id=headers.get("Message-ID"), sender=sender,
        recipients=to, subject=subject, sent_at=headers.get("Date"), body_text=text,
        headers=headers, attachments=attachments,
    ))


def parse_json(request: JsonEmailRequest) -> InboundEmailPayload:
    """Builds a payload from a JSON webhook body with base64 attachments."""
    attachments = []
    for item in request.attachments:
        try:
            content = base64.b64decode(item.content_base64, validate=True)
        except (binascii.Error, ValueError) as error:
            raise EmailParseError(f"הקובץ המצורף '{item.filename}' אינו base64 תקין") from error
        attachments.append(EmailAttachment(filename=item.filename, content_type=item.content_type, content=content))
    headers = dict(request.headers)
    for key, value in (("From", request.sender), ("To", request.to), ("Subject", request.subject)):
        headers.setdefault(key, value)
    return _ensure_identity(InboundEmailPayload(
        source_format="json", message_id=request.message_id or headers.get("Message-ID"),
        sender=request.sender, recipients=request.to, subject=request.subject,
        sent_at=request.date or headers.get("Date"), body_text=request.text,
        headers=headers, attachments=attachments,
    ))

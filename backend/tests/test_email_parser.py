"""Inbound email normalisation for the three supported wire formats."""
import base64
from email.message import EmailMessage

import pytest

from schemas.email_payload import JsonEmailRequest
from services.email_parser import EmailParseError, parse_eml, parse_json, parse_multipart

PDF_BYTES = b"%PDF-1.4\n% fake test pdf\n"


def _build_eml() -> bytes:
    message = EmailMessage()
    message["From"] = "מדי-פארם הנהלת חשבונות <billing@medipharm-care.co.il>"
    message["To"] = "invoices@goldencare.co.il"
    message["Subject"] = "טופס התחשבנות אוגוסט 2026"
    message["Message-ID"] = "<abc123@medipharm-care.co.il>"
    message["Date"] = "Tue, 15 Sep 2026 09:12:00 +0300"
    message.set_content("שלום רב,\nמצורף טופס ההתחשבנות לחודש אוגוסט.")
    message.add_attachment(PDF_BYTES, maintype="application", subtype="pdf", filename="טופס התחשבנות.pdf")
    return message.as_bytes()


def test_eml_decodes_hebrew_headers_body_and_attachment():
    payload = parse_eml(_build_eml())
    assert payload.subject == "טופס התחשבנות אוגוסט 2026"
    assert "billing@medipharm-care.co.il" in payload.sender
    assert payload.message_id == "<abc123@medipharm-care.co.il>"
    assert "מצורף טופס" in payload.body_text
    assert [(a.filename, a.content) for a in payload.attachments] == [("טופס התחשבנות.pdf", PDF_BYTES)]
    assert payload.headers["To"] == "invoices@goldencare.co.il"


def test_eml_rejects_garbage():
    with pytest.raises(EmailParseError):
        parse_eml(b"")


def test_json_payload_decodes_base64_and_stamps_identity():
    request = JsonEmailRequest.model_validate({
        "from": "a@b.co.il", "subject": "חשבונית", "text": "מצורף",
        "attachments": [{"filename": "x.pdf", "content_base64": base64.b64encode(PDF_BYTES).decode()}],
    })
    payload = parse_json(request)
    assert payload.attachments[0].content == PDF_BYTES
    assert payload.message_id and payload.sent_at  # generated for traceability
    assert payload.headers["From"] == "a@b.co.il"


def test_json_payload_rejects_invalid_base64():
    request = JsonEmailRequest.model_validate({
        "from": "a@b.co.il", "attachments": [{"filename": "x.pdf", "content_base64": "@@not-base64@@"}],
    })
    with pytest.raises(EmailParseError):
        parse_json(request)


def test_multipart_parses_raw_header_block():
    payload = parse_multipart("a@b.co.il", "c@d.co.il", "נושא", "גוף",
                              "Message-ID: <m1@x>\nX-Mailer: Outlook", [])
    assert payload.message_id == "<m1@x>"
    assert payload.headers["X-Mailer"] == "Outlook"

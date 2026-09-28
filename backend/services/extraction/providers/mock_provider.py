"""Deterministic offline provider for local development without API keys.

Only used when NO real provider is configured, and always recorded as engine
"mock" in the Excel file and the DB, so fake data can never pass for real data.
Files whose name contains "error" / "תקול" get a deliberate arithmetic error so
the validation layer can be demonstrated offline.
"""
import json
import os
import time

from services.extraction.providers.base import ExtractionProvider, ProviderResponse

_VALID_DOC = {
    "document_type": "טופס התחשבנות ספק (MOCK)",
    "document_number": "MOCK-0001",
    "document_date": "2026-09-15",
    "billing_period_start": "2026-08-01",
    "billing_period_end": "2026-08-31",
    "supplier_name": "ספק לדוגמה בע\"מ (MOCK)",
    "supplier_tax_id": "510000000",
    "customer_name": "גולדנקייר שירותי סיעוד ורפואה בע\"מ",
    "currency": "ILS",
    "payment_terms": "שוטף + 30",
    "line_items": [
        {"line_number": 1, "service_date": "2026-08-04", "description": "ערכות ציוד סיעודי מתכלה",
         "quantity": 25, "unit_price": 320.0, "line_total": 8000.0},
        {"line_number": 2, "service_date": "2026-08-12", "description": "תחזוקה וכיול מכשירי ניטור",
         "quantity": 12, "unit_price": 250.0, "line_total": 3000.0},
    ],
    "subtotal": 11000.0,
    "vat_rate": 18,
    "vat_amount": 1980.0,
    "total_amount": 12980.0,
    "extraction_notes": ["נתוני דמה – לא הוגדר מפתח API לספק AI"],
}


class MockProvider(ExtractionProvider):
    """Returns canned JSON after a short simulated latency.
    
    Useful for testing UI loading states and local environment setup without
    needing real AI provider credentials.
    """

    name: str = "mock"

    def is_configured(self) -> bool:
        """The mock provider is always considered configured.

        Returns:
            True, as no external credentials are required.
        """
        return True

    def extract(self, system_prompt: str, file_path: str, mime_type: str) -> ProviderResponse:
        """Simulates an extraction by returning a fixed JSON document.

        Args:
            system_prompt: The system instructions (ignored by mock).
            file_path: Path to the local file to process.
            mime_type: The MIME type of the file (ignored by mock).

        Returns:
            A ProviderResponse containing the canned JSON string and the 'mock' model identifier.
        """
        time.sleep(1.0)  # Lets the UI show its loading state realistically.
        document = json.loads(json.dumps(_VALID_DOC))
        name = os.path.basename(file_path).lower()
        if "error" in name or "תקול" in name:
            document["line_items"][1]["line_total"] = 3600.0  # 12 x 250 != 3600
        return ProviderResponse(raw_text=json.dumps(document, ensure_ascii=False), model="mock")

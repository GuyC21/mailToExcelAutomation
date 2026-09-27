"""Hand-labelled transcriptions of the five sample forms in ``data/samples``.

They double as offline fixtures for the validation rules: each sample was
designed with a specific defect (see the file names), and the tests assert that
exactly that defect is detected.
"""

SHL_VALID = {
    "document_number": "SLH-88421", "document_date": "2026-08-30",
    "supplier_name": "ש.ל.ה שירותי לוגיסטיקה והסעות רפואיות בע\"מ", "supplier_tax_id": "512998410",
    "line_items": [
        {"line_number": 1, "description": "הסעת מטופלים בכיסאות גלגלים", "quantity": 18, "unit_price": 350, "line_total": 6300},
        {"line_number": 2, "description": "שינוע דגימות מעבדה", "quantity": 22, "unit_price": 150, "line_total": 3300},
        {"line_number": 3, "description": "הזנקת חירום לילית", "quantity": 2, "unit_price": 700, "line_total": 1400},
    ],
    "subtotal": 11000, "vat_rate": 17, "vat_amount": 1870, "total_amount": 12870,
}

CLEANTECH_SUBTOTAL_MISMATCH = {
    "document_number": "CT-2026-409", "document_date": "2026-09-10",
    "supplier_name": "קלין-טק שירותי כביסה וסטריליזציה למוסדות בע\"מ",
    "line_items": [
        {"line_number": 1, "description": "כביסה וחיטוי תרמי", "quantity": 1200, "unit_price": 6.5, "line_total": 7800},
        {"line_number": 2, "description": "ניקוי יבש מדי צוות", "quantity": 150, "unit_price": 18, "line_total": 2700},
        {"line_number": 3, "description": "טיפול בכביסה מזוהמת", "quantity": 80, "unit_price": 25, "line_total": 2000},
        {"line_number": 4, "description": "דמי הובלה", "quantity": 4, "unit_price": 400, "line_total": 1600},
    ],
    "subtotal": 12500, "vat_rate": 17, "vat_amount": 2125, "total_amount": 15625,
}

AB_MISSING_FIELDS = {
    "document_number": None, "document_date": None,
    "supplier_name": "א.ב. הנדסת מיזוג אוויר ואחזקת מבנים", "supplier_tax_id": "039481221",
    "line_items": [
        {"line_number": 1, "description": "החלפת מדחס מרכזי", "quantity": 1, "unit_price": 6400, "line_total": 6400},
        {"line_number": 2, "description": "ניקוי סוללות", "quantity": 35, "unit_price": 90, "line_total": 3150},
        {"line_number": 3, "description": "איתור דליפת גז", "quantity": 1, "unit_price": "טרם תומחר", "line_total": "בבירור מול קבלן"},
    ],
    "subtotal": 9550, "vat_rate": 17, "vat_amount": "לא חושב", "total_amount": None,
}

SHEFA_LINE_AND_VAT_ERRORS = {
    "document_number": "SH-2026-9912", "document_date": "2026-09-02",
    "supplier_name": "שפע טעמים – הסעדה וקייטרינג למוסדות רפואיים בע\"מ",
    "line_items": [
        {"line_number": 1, "description": "מנות צהריים חמות", "quantity": 400, "unit_price": 28, "line_total": 11200},
        {"line_number": 2, "description": "מארזי ארוחות בוקר וערב", "quantity": 250, "unit_price": 16, "line_total": 4800},
        {"line_number": 3, "description": "פורמולות העשרה", "quantity": 60, "unit_price": 45, "line_total": 2700},
    ],
    "subtotal": 18700, "vat_rate": 17, "vat_amount": 3366, "total_amount": 22066,
}

MEDIPHARM_VALID = {
    "document_number": "MP-2026-0894", "document_date": "15/09/2026",
    "supplier_name": "מדי-פארם ציוד רפואי וסיעודי בע\"מ",
    "line_items": [
        {"line_number": 1, "description": "ערכות ציוד סיעודי מתכלה", "quantity": 25, "unit_price": "320.00 ₪", "line_total": "8,000.00 ₪"},
        {"line_number": 2, "description": "תחזוקה וכיול", "quantity": 12, "unit_price": 250, "line_total": 3000},
        {"line_number": 3, "description": "השכרת מיטות סיעודיות", "quantity": 8, "unit_price": 450, "line_total": 3600},
        {"line_number": 4, "description": "מילוי בלוני חמצן", "quantity": 5, "unit_price": 280, "line_total": 1400},
    ],
    "subtotal": 16000, "vat_rate": 17, "vat_amount": 2720, "total_amount": 18720,
}

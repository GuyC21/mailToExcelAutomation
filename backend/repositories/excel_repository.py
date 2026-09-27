import os
from openpyxl import Workbook, load_workbook
from datetime import datetime

class ExcelRepository:
    def __init__(self, file_path: str = "data/GoldenCare_Master.xlsx"):
        self.file_path = file_path
        self._ensure_workbook_exists()

    def _ensure_workbook_exists(self):
        """Creates the Excel file with the required sheets and headers if it doesn't exist."""
        # Ensure the directory exists
        os.makedirs(os.path.dirname(self.file_path), exist_ok=True)
        
        if not os.path.exists(self.file_path):
            wb = Workbook()
            
            # 1. Invoices Summary Sheet
            ws_summary = wb.active
            ws_summary.title = "Invoices_Summary"
            ws_summary.append(["Timestamp", "Source File", "Supplier Name", "Document Date", "Total Amount", "VAT Amount", "Status"])
            
            # 2. Line Items Sheet
            ws_lines = wb.create_sheet(title="Line_Items")
            ws_lines.append(["Source File", "Supplier Name", "Item Description", "Item Amount"])
            
            # 3. Requires Manual Review Sheet
            ws_review = wb.create_sheet(title="Requires_Manual_Review")
            ws_review.append(["Timestamp", "Source File", "Status", "Raw Data", "Error Notes"])
            
            wb.save(self.file_path)

    def write_extraction(self, source_file: str, data: dict, status: str, error_notes: str = ""):
        """Writes the extracted data to the appropriate sheets based on the status."""
        wb = load_workbook(self.file_path)
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        # If extraction failed or has math warnings, it goes to Manual Review
        if status in ["EXTRACTION_FAILED", "WARNING_MATH_MISMATCH"]:
            ws_review = wb["Requires_Manual_Review"]
            ws_review.append([
                timestamp,
                source_file,
                status,
                str(data),
                error_notes
            ])
            # Even if there's a math warning, we might still want to log it to summary, 
            # but per GoldenCare constraints, we isolate failures to ensure 100% visibility.
            wb.save(self.file_path)
            return

        # Status is VALID
        # 1. Write to Summary
        ws_summary = wb["Invoices_Summary"]
        ws_summary.append([
            timestamp,
            source_file,
            data.get("supplier_name", "N/A"),
            data.get("document_date", "N/A"),
            data.get("total_amount", 0.0),
            data.get("vat_amount", 0.0),
            status
        ])
        
        # 2. Write Line Items
        ws_lines = wb["Line_Items"]
        supplier_name = data.get("supplier_name", "N/A")
        for item in data.get("line_items", []):
            ws_lines.append([
                source_file,
                supplier_name,
                item.get("description", "N/A"),
                item.get("amount", 0.0)
            ])
            
        wb.save(self.file_path)

    def get_stats(self):
        """Returns basic statistics for the dashboard."""
        if not os.path.exists(self.file_path):
            return {"total_valid": 0, "total_review": 0}
            
        wb = load_workbook(self.file_path, read_only=True)
        # -1 for header row
        valid_count = max(0, wb["Invoices_Summary"].max_row - 1)
        review_count = max(0, wb["Requires_Manual_Review"].max_row - 1)
        
        return {
            "total_valid": valid_count,
            "total_review": review_count
        }

# Global instance
excel_repo = ExcelRepository()

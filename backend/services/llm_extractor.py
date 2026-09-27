import os
import json
import base64
from pydantic import BaseModel, Field, ValidationError
from typing import List, Optional
import google.generativeai as genai

# 1. Pydantic Models for Strict Validation
class LineItem(BaseModel):
    description: str = Field(..., description="Description of the item or service")
    amount: float = Field(..., description="Cost or amount of the item")

class InvoiceExtraction(BaseModel):
    supplier_name: str = Field(..., description="The name of the supplier or business")
    document_date: str = Field(..., description="The date of the document in YYYY-MM-DD format")
    total_amount: float = Field(..., description="The final total amount to pay, including VAT")
    vat_amount: float = Field(..., description="The VAT (Tax) amount. If not specified, calculate 17% of subtotal, or 0 if exempt.")
    line_items: List[LineItem] = Field(default_factory=list, description="List of individual items/services charged")

class LLMExtractor:
    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY")
        self.is_mock = not self.api_key or self.api_key.strip() == ""
        if not self.is_mock:
            genai.configure(api_key=self.api_key)

    def extract_from_file(self, prompt_text: str, file_path: str) -> dict:
        """
        Takes the user's business prompt, wraps it in the technical envelope,
        sends it to Gemini with the file, and validates the response.
        Returns a dict: {"status": str, "data": dict, "error": str}
        """
        if self.is_mock:
            return self._mock_extraction(prompt_text, file_path)

        # 1. Prepare the System Envelope
        system_envelope = f"""You are a highly precise financial data extraction AI.
Your task is to analyze the attached document and extract information based EXACTLY on the following user instructions:

<USER_INSTRUCTIONS>
{prompt_text}
</USER_INSTRUCTIONS>

You must return the extracted data EXCLUSIVELY as a valid JSON object matching this exact schema:
{{
  "supplier_name": "string",
  "document_date": "YYYY-MM-DD",
  "total_amount": float,
  "vat_amount": float,
  "line_items": [
    {{
      "description": "string",
      "amount": float
    }}
  ]
}}
Ensure the JSON is valid, contains no markdown formatting (e.g., no ```json blocks), and no extra text.
"""
        
        try:
            # 2. Upload file to Gemini
            uploaded_file = genai.upload_file(file_path)
            
            # 3. Initialize Model (Using gemini-1.5-flash for speed and multimodal support)
            model = genai.GenerativeModel('gemini-1.5-flash', system_instruction=system_envelope)
            
            # 4. Generate Content
            response = model.generate_content(
                ["Please extract the requested data from this document.", uploaded_file],
                generation_config=genai.types.GenerationConfig(
                    response_mime_type="application/json",
                ),
            )
            
            # Cleanup file from Gemini servers
            genai.delete_file(uploaded_file.name)
            
            # 5. Parse JSON
            raw_json = response.text
            extracted_dict = json.loads(raw_json)
            
            # 6. Validate via Pydantic & Math Checks
            return self._validate_and_flag(extracted_dict)
            
        except Exception as e:
            return {
                "status": "EXTRACTION_FAILED",
                "data": {},
                "error": f"LLM or Parsing Error: {str(e)}"
            }

    def _validate_and_flag(self, extracted_dict: dict) -> dict:
        """Validates the schema and performs business math checks."""
        try:
            # Pydantic Schema Validation
            validated_data = InvoiceExtraction(**extracted_dict)
            data_dict = validated_data.model_dump()
            
            # Math Validation Fallback: Does sum of line items roughly equal total amount?
            # Note: Sometimes total includes VAT, sometimes line items include VAT.
            # We'll do a loose check: if line items exist, their sum should be > 0.
            # If total_amount < sum(line_items), something might be mathematically wrong.
            sum_lines = sum(item["amount"] for item in data_dict["line_items"])
            
            # If there's a significant mismatch (> 5 difference to account for rounding/VAT)
            if sum_lines > 0 and abs(sum_lines - data_dict["total_amount"]) > abs(data_dict["vat_amount"]) + 5:
                 return {
                    "status": "WARNING_MATH_MISMATCH",
                    "data": data_dict,
                    "error": f"Math mismatch: Sum of lines ({sum_lines}) vs Total ({data_dict['total_amount']})"
                }
            
            return {
                "status": "VALID",
                "data": data_dict,
                "error": ""
            }
            
        except ValidationError as e:
            return {
                "status": "EXTRACTION_FAILED",
                "data": extracted_dict,
                "error": f"Schema Validation Error: {str(e)}"
            }

    def _mock_extraction(self, prompt_text: str, file_path: str) -> dict:
        """Fallback mock for local dev without API keys."""
        import time
        time.sleep(1.5) # Simulate network delay
        filename = os.path.basename(file_path)
        
        # Simulate math error if filename contains 'error'
        if "error" in filename.lower():
             return {
                "status": "WARNING_MATH_MISMATCH",
                "data": {
                    "supplier_name": "Mock Supplier Ltd (Error)",
                    "document_date": "2024-01-01",
                    "total_amount": 1000.0,
                    "vat_amount": 170.0,
                    "line_items": [{"description": "Item A", "amount": 500.0}] # 500 != 1000
                },
                "error": "Math mismatch: Sum of lines (500.0) vs Total (1000.0)"
            }
            
        # Return valid mock
        return {
            "status": "VALID",
            "data": {
                "supplier_name": "Mock Supplier Ltd",
                "document_date": "2024-01-01",
                "total_amount": 117.0,
                "vat_amount": 17.0,
                "line_items": [
                    {"description": "Consulting Services", "amount": 100.0}
                ]
            },
            "error": ""
        }

llm_extractor = LLMExtractor()

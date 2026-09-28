from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Dict, Any

from database import get_db
from models.ingestion import DocumentIngestion

router = APIRouter()

@router.get("/stats")
async def get_dashboard_stats(db: AsyncSession = Depends(get_db)) -> Dict[str, Any]:
    """Fetch aggregated statistics for the financial dashboard."""
    
    # Fetch all results to aggregate (in a real prod app, you'd do this via SQL aggregates, 
    # but for JSON columns in SQLite, fetching and aggregating in Python is easiest for this demo).
    result = await db.execute(select(DocumentIngestion))
    records = result.scalars().all()
    
    status_counts = {"VALID": 0, "NEEDS_REVIEW": 0, "EXTRACTION_FAILED": 0}
    total_amount_processed = 0.0
    supplier_totals = {}
    
    for r in records:
        status_counts[r.status] = status_counts.get(r.status, 0) + 1
        
        if r.status == "VALID" and r.extracted_data:
            amount = r.extracted_data.get("total_amount", 0.0)
            total_amount_processed += amount
            
            supplier = r.extracted_data.get("supplier_name", "Unknown")
            supplier_totals[supplier] = supplier_totals.get(supplier, 0.0) + amount

    # Sort suppliers by volume
    top_suppliers = [{"name": k, "value": v} for k, v in sorted(supplier_totals.items(), key=lambda item: item[1], reverse=True)[:5]]
    
    return {
        "total_amount_processed": total_amount_processed,
        "total_documents": len(records),
        "status_distribution": [
            {"name": "Valid", "value": status_counts.get("VALID", 0), "fill": "#10b981"},
            {"name": "Needs Review", "value": status_counts.get("NEEDS_REVIEW", 0) + status_counts.get("WARNING_MATH_MISMATCH", 0), "fill": "#f59e0b"},
            {"name": "Failed", "value": status_counts.get("EXTRACTION_FAILED", 0), "fill": "#ef4444"}
        ],
        "top_suppliers": top_suppliers
    }

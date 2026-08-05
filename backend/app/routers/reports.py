from fastapi import APIRouter, HTTPException

from app.schemas.reports import SavedReportDetail, SavedReportSummary
from app.services.report_writer import list_saved_reports, load_saved_report

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("", response_model=list[SavedReportSummary])
async def get_reports():
    """Return all reports saved under storage/reports."""
    return list_saved_reports()


@router.get("/{report_id}", response_model=SavedReportDetail)
async def get_report(report_id: str):
    """Return one full saved report by id."""
    report = load_saved_report(report_id)
    if report is None:
        raise HTTPException(status_code=404, detail="Report not found")
    return report

from typing import Any, Literal

from pydantic import BaseModel, Field


class SavedReportSummary(BaseModel):
    """Lightweight metadata for one on-disk report (list view)."""

    id: str
    name: str
    date: str
    summary: str
    file_path: str
    report_type: Literal["youtube", "meeting"] = "youtube"


class SavedReportDetail(BaseModel):
    """Full report payload loaded from disk."""

    id: str
    name: str
    date: str
    summary: str
    file_path: str
    report_type: Literal["youtube", "meeting"] = "youtube"
    content: dict[str, Any] = Field(default_factory=dict)

import json
from datetime import datetime, timezone
from pathlib import Path

from pydantic import BaseModel

from app.core.config import settings
from app.schemas.reports import SavedReportDetail, SavedReportSummary


def save_report(job_id: str, transcript: str, report: BaseModel) -> Path:
    """Persist the transcript and structured report for a completed job to disk."""

    job_dir = settings.reports_dir / job_id
    job_dir.mkdir(parents=True, exist_ok=True)

    (job_dir / "transcript.txt").write_text(transcript, encoding="utf-8")
    (job_dir / "report.json").write_text(report.model_dump_json(indent=2), encoding="utf-8")

    return job_dir


def _detect_type(data: dict) -> str:
    return "meeting" if "executive_summary" in data else "youtube"


def _summary_text(data: dict, report_type: str) -> str:
    raw = (
        data.get("executive_summary")
        if report_type == "meeting"
        else data.get("overview") or data.get("final_summary")
    )
    text = (raw or "").strip()
    if len(text) > 160:
        return text[:157].rstrip() + "..."
    return text or "No summary available"


def _format_mtime(path: Path) -> str:
    ts = path.stat().st_mtime
    return datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%b %d, %Y")


def _read_report_json(report_path: Path) -> dict | None:
    try:
        return json.loads(report_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None


def list_saved_reports() -> list[SavedReportSummary]:
    """Scan storage/reports and return summaries sorted newest-first."""

    root = settings.reports_dir
    if not root.exists():
        return []

    items: list[SavedReportSummary] = []
    for job_dir in root.iterdir():
        if not job_dir.is_dir():
            continue
        report_path = job_dir / "report.json"
        if not report_path.is_file():
            continue
        data = _read_report_json(report_path)
        if data is None:
            continue

        report_type = _detect_type(data)
        items.append(
            SavedReportSummary(
                id=job_dir.name,
                name=(data.get("title") or "Untitled report").strip() or "Untitled report",
                date=_format_mtime(report_path),
                summary=_summary_text(data, report_type),
                file_path=str(report_path.resolve()),
                report_type=report_type,  # type: ignore[arg-type]
            )
        )

    items.sort(key=lambda r: (settings.reports_dir / r.id / "report.json").stat().st_mtime, reverse=True)
    return items


def load_saved_report(report_id: str) -> SavedReportDetail | None:
    """Load a full saved report by job/folder id."""

    job_dir = settings.reports_dir / report_id
    report_path = job_dir / "report.json"
    if not report_path.is_file():
        return None

    data = _read_report_json(report_path)
    if data is None:
        return None

    report_type = _detect_type(data)
    return SavedReportDetail(
        id=report_id,
        name=(data.get("title") or "Untitled report").strip() or "Untitled report",
        date=_format_mtime(report_path),
        summary=_summary_text(data, report_type),
        file_path=str(report_path.resolve()),
        report_type=report_type,  # type: ignore[arg-type]
        content=data,
    )

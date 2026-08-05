from fastapi import APIRouter, HTTPException

from app.services.job_manager import job_manager
from app.schemas.job import JobStatusResponse
from app.routers.common import get_job_or_404, job_to_status_response, sse_stream

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.get("/{job_id}", response_model=JobStatusResponse)
async def get_job(job_id: str):
    job = get_job_or_404(job_id)
    return job_to_status_response(job)


@router.get("/{job_id}/events")
async def job_events(job_id: str):
    get_job_or_404(job_id)
    return sse_stream(job_id)


@router.get("/{job_id}/report")
async def get_job_report(job_id: str):
    job = get_job_or_404(job_id)
    if job.report is None:
        raise HTTPException(status_code=409, detail="Report not ready")
    return job.report


@router.delete("/{job_id}")
async def delete_job(job_id: str):
    get_job_or_404(job_id)
    job_manager.delete(job_id)
    return {"deleted": True}

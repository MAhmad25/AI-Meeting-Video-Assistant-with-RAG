import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from app.schemas.job import JobType, JobStatus


class Job:
    """In-memory record for a single report-generation job (YouTube or Meeting)."""

    def __init__(self, job_id: str, job_type: JobType, source_ref: str):
        self.id = job_id
        self.type = job_type
        self.source_ref = source_ref  # YouTube URL or recording file path
        self.status: JobStatus = JobStatus.PENDING
        self.stage: str = "queued"
        self.transcript: Optional[str] = None
        self.report: Optional[Any] = None  # MeetingReport | YoutubeReport
        self.source_id: str = job_id  # also used as the RAG filter key in Chroma
        self.error: Optional[str] = None
        self.created_at = datetime.now(timezone.utc)


class JobManager:
    """
    Simple in-memory job store.

    NOTE: This resets whenever the backend process restarts. That's fine for a
    single-user desktop app where the FastAPI process lives inside the Electron
    app's lifecycle, but if jobs ever need to survive a backend restart, swap
    this for a small SQLite-backed store without changing the public API below.
    """

    def __init__(self):
        self._jobs: dict[str, Job] = {}

    def create(self, job_type: JobType, source_ref: str) -> Job:
        job_id = str(uuid.uuid4())
        job = Job(job_id, job_type, source_ref)
        self._jobs[job_id] = job
        return job

    def get(self, job_id: str) -> Optional[Job]:
        return self._jobs.get(job_id)

    def delete(self, job_id: str) -> None:
        self._jobs.pop(job_id, None)


job_manager = JobManager()

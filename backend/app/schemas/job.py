from enum import Enum
from pydantic import BaseModel


class JobType(str, Enum):
    YOUTUBE = "youtube"
    MEETING = "meeting"


class JobStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class JobCreateResponse(BaseModel):
    job_id: str
    status: JobStatus


class JobStatusResponse(BaseModel):
    job_id: str
    type: JobType
    status: JobStatus
    stage: str
    error: str | None = None
    source_id: str | None = None
    has_report: bool = False

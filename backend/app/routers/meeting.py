import asyncio
from pathlib import Path
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.schemas.job import JobType, JobStatus, JobCreateResponse
from app.services.job_manager import job_manager
from app.services.events import event_bus
from app.pipelines.meeting_audio_pipeline import GenerateMeetingTranscript_service
from app.pipelines.meeting_pipeline import meeting_report_chain
from app.services.rag import rag_service
from app.services.report_writer import save_report

router = APIRouter(prefix="/meeting", tags=["meeting"])


class MeetingJobRequest(BaseModel):
    # Absolute path to the recording file already saved to disk by the
    # Electron main process (see desktop/src/main/recording.ts).
    recording_path: str
    title: str | None = None


def _run_meeting_job(
    job_id: str,
    recording_path: str,
    title: str | None,
    loop: asyncio.AbstractEventLoop,
) -> None:
    job = job_manager.get(job_id)
    if job is None:
        return

    def emit(stage: str, message: str = ""):
        job.stage = stage
        loop.call_soon_threadsafe(
            event_bus.publish, job_id, {"stage": stage, "message": message}
        )

    try:
        job.status = JobStatus.RUNNING
        emit("initializing", "Starting meeting report job")

        transcript = GenerateMeetingTranscript_service.generate_transcript(
            recording_path, emit=emit
        )
        job.transcript = transcript

        report = meeting_report_chain.generate(transcript, emit=emit)
        job.report = report

        emit("saving_report", "Saving report to disk")
        save_report(job_id, transcript, report)
        emit("saving_report_done", "Report saved")

        emit("indexing", "Indexing transcript for chat")
        rag_service.index_transcript(
            transcript=transcript,
            source_type="meeting",
            source_id=job_id,
            title=title or Path(recording_path).stem,
        )
        emit("indexing_done", "Chat is ready")

        job.status = JobStatus.COMPLETED
        emit("finished", "Report complete")
    except Exception as exc:  # noqa: BLE001
        job.status = JobStatus.FAILED
        job.error = str(exc)
        emit("error", str(exc))


@router.post("/jobs", response_model=JobCreateResponse)
async def create_meeting_job(payload: MeetingJobRequest):
    if not Path(payload.recording_path).exists():
        raise HTTPException(status_code=400, detail="Recording file not found")

    job = job_manager.create(JobType.MEETING, payload.recording_path)
    loop = asyncio.get_running_loop()
    loop.run_in_executor(
        None, _run_meeting_job, job.id, payload.recording_path, payload.title, loop
    )
    return JobCreateResponse(job_id=job.id, status=job.status)

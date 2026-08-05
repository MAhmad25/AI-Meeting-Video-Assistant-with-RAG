import asyncio
from fastapi import APIRouter
from pydantic import BaseModel

from app.schemas.job import JobType, JobStatus, JobCreateResponse
from app.services.job_manager import job_manager
from app.services.events import event_bus
from app.pipelines.audio_pipeline import GenerateTranscript_service
from app.pipelines.youtube_pipeline import youtube_report_chain
from app.services.rag import rag_service
from app.services.report_writer import save_report

router = APIRouter(prefix="/youtube", tags=["youtube"])


class YoutubeJobRequest(BaseModel):
    url: str
    title: str | None = None


def _run_youtube_job(
    job_id: str,
    url: str,
    title: str | None,
    loop: asyncio.AbstractEventLoop,
) -> None:
    """Runs on a worker thread. All LangChain/yt-dlp/ffmpeg calls here are blocking."""

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
        emit("initializing", "Starting YouTube report job")

        transcript = GenerateTranscript_service.generate_transcript(url, emit=emit)
        job.transcript = transcript

        report = youtube_report_chain.generate(transcript, emit=emit)
        job.report = report

        emit("saving_report", "Saving report to disk")
        save_report(job_id, transcript, report)
        emit("saving_report_done", "Report saved")

        emit("indexing", "Indexing transcript for chat")
        rag_service.index_transcript(
            transcript=transcript,
            source_type="youtube",
            source_id=job_id,
            title=title or url,
        )
        emit("indexing_done", "Chat is ready")

        job.status = JobStatus.COMPLETED
        emit("finished", "Report complete")
    except Exception as exc:  # noqa: BLE001 — surfaced to the client via the SSE stream
        job.status = JobStatus.FAILED
        job.error = str(exc)
        emit("error", str(exc))


@router.post("/jobs", response_model=JobCreateResponse)
async def create_youtube_job(payload: YoutubeJobRequest):
    job = job_manager.create(JobType.YOUTUBE, payload.url)
    loop = asyncio.get_running_loop()
    loop.run_in_executor(None, _run_youtube_job, job.id, payload.url, payload.title, loop)
    return JobCreateResponse(job_id=job.id, status=job.status)

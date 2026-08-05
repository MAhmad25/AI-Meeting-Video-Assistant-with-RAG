import asyncio
import json
from fastapi import HTTPException
from fastapi.responses import StreamingResponse

from app.schemas.job import JobStatus, JobStatusResponse
from app.services.job_manager import job_manager, Job
from app.services.events import event_bus


def get_job_or_404(job_id: str) -> Job:
    job = job_manager.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


def job_to_status_response(job: Job) -> JobStatusResponse:
    return JobStatusResponse(
        job_id=job.id,
        type=job.type,
        status=job.status,
        stage=job.stage,
        error=job.error,
        source_id=job.source_id if job.status == JobStatus.COMPLETED else None,
        has_report=job.report is not None,
    )


def sse_stream(job_id: str) -> StreamingResponse:
    """Server-Sent Events stream of progress events for a single job."""

    async def event_stream():
        queue = event_bus.subscribe(job_id)
        try:
            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=15.0)
                except asyncio.TimeoutError:
                    # SSE comment line (starts with ":") — per spec this is
                    # ignored by any compliant parser, unlike a bare
                    # "data: {}" frame, which was previously being forwarded
                    # to the renderer as if it were a real stage-less
                    # progress event and crashing the UI (see sse-consumer.ts
                    # / useJob.ts, which both only ever expected fully-formed
                    # {stage, message} events).
                    yield ": keepalive\n\n"
                    continue

                yield f"data: {json.dumps(event)}\n\n"
                if event.get("stage") in ("finished", "error"):
                    break
        finally:
            event_bus.unsubscribe(job_id, queue)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )

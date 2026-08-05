import asyncio
import json
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.services.retriever import retriever_service
from app.chains.chat_chain import ChatChain_service

router = APIRouter(prefix="/chat", tags=["chat"])


class ChatRequest(BaseModel):
    source_id: str
    question: str


def _stream_tokens_sync(
    queue: asyncio.Queue,
    loop: asyncio.AbstractEventLoop,
    context,
    question: str,
) -> None:
    """
    Runs on a worker thread. ChatChain.stream() is a blocking sync generator
    (LangChain's default), so it's driven here and bridged into the asyncio
    queue with call_soon_threadsafe rather than iterated directly inside an
    async endpoint, which would block the event loop for every other request.
    """
    try:
        for chunk in ChatChain_service.stream(context=context, question=question):
            content = getattr(chunk, "content", "") or ""
            if content:
                loop.call_soon_threadsafe(queue.put_nowait, {"token": content})
    except Exception as exc:  # noqa: BLE001
        loop.call_soon_threadsafe(queue.put_nowait, {"error": str(exc)})
    finally:
        loop.call_soon_threadsafe(queue.put_nowait, {"done": True})


@router.post("")
async def chat(payload: ChatRequest):
    context = retriever_service.retrieve(query=payload.question, source_id=payload.source_id)
    if not context:
        raise HTTPException(
            status_code=404,
            detail="No indexed content found for this source_id. Has the report finished generating?",
        )

    queue: asyncio.Queue = asyncio.Queue()
    loop = asyncio.get_running_loop()
    loop.run_in_executor(None, _stream_tokens_sync, queue, loop, context, payload.question)

    async def event_stream():
        while True:
            event = await queue.get()
            yield f"data: {json.dumps(event)}\n\n"
            if "done" in event or "error" in event:
                break

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )

import asyncio
import time
from typing import Any

# Cap per-job in case a client never subscribes (e.g. job created but the
# renderer never opened the SSE connection) — avoids unbounded growth.
MAX_BUFFERED_PER_JOB = 200


class JobEventBus:
    """
    Async pub/sub for job progress events, keyed by job_id.

    Pipelines run in a worker thread (via loop.run_in_executor), so events are
    published with loop.call_soon_threadsafe(...) from that thread rather than
    calling queue.put_nowait directly — asyncio.Queue is not thread-safe.

    Job creation and SSE subscription are two separate round-trips (create
    job -> get job_id -> open SSE stream), so the worker thread can start
    emitting events before any subscriber is registered. Events published
    with no subscribers are buffered per job_id and replayed to the first
    subscriber, instead of being silently dropped.
    """

    def __init__(self):
        self._queues: dict[str, list[asyncio.Queue]] = {}
        self._pending: dict[str, list[dict[str, Any]]] = {}

    def subscribe(self, job_id: str) -> asyncio.Queue:
        queue: asyncio.Queue = asyncio.Queue()
        for event in self._pending.pop(job_id, []):
            queue.put_nowait(event)
        self._queues.setdefault(job_id, []).append(queue)
        return queue

    def unsubscribe(self, job_id: str, queue: asyncio.Queue) -> None:
        subscribers = self._queues.get(job_id, [])
        if queue in subscribers:
            subscribers.remove(queue)
        if not subscribers and job_id in self._queues:
            del self._queues[job_id]

    def publish(self, job_id: str, event: dict[str, Any]) -> None:
        event = {**event, "ts": time.time()}
        subscribers = self._queues.get(job_id)
        if subscribers:
            for queue in subscribers:
                queue.put_nowait(event)
        else:
            buffered = self._pending.setdefault(job_id, [])
            buffered.append(event)
            del buffered[:-MAX_BUFFERED_PER_JOB]


event_bus = JobEventBus()

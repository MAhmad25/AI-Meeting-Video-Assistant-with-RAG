from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.routers import youtube, meeting, chat, jobs, reports


async def _ollama_reachable() -> bool:
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(f"{settings.ollama_base_url}/api/tags")
            return resp.status_code == 200
    except Exception:
        return False


@asynccontextmanager
async def lifespan(app: FastAPI):
    if not await _ollama_reachable():
        # Embeddings (and therefore RAG indexing/chat) require Ollama running
        # locally with the nomic-embed-text model pulled. We don't hard-fail
        # startup — YouTube/meeting report generation doesn't need embeddings
        # until the indexing stage — but we warn loudly up front.
        print(
            f"[WARN] Could not reach Ollama at {settings.ollama_base_url}. "
            "Run `ollama serve` and `ollama pull nomic-embed-text`, "
            "otherwise report indexing and chat will fail."
        )
    yield


app = FastAPI(title="AI Meeting & YouTube Assistant", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(youtube.router)
app.include_router(meeting.router)
app.include_router(chat.router)
app.include_router(jobs.router)
app.include_router(reports.router)


@app.get("/health")
async def health():
    return {"status": "ok"}

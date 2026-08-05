import os

# Must be set before `chromadb` is imported (langchain_chroma imports it
# transitively). chromadb defaults to anonymized telemetry enabled, which
# makes a network call to PostHog when the client is constructed below. On a
# machine where that call is slow, blocked, or silently dropped by a
# firewall/AV, construction hangs for 20-30+ seconds with no output and no
# exception — this is what was blocking uvicorn from ever reaching its own
# startup logging, since this module is imported (and Chroma constructed)
# before uvicorn finishes importing app.main:app.
os.environ.setdefault("ANONYMIZED_TELEMETRY", "False")

from pathlib import Path
from chromadb.config import Settings as ChromaSettings
from langchain_chroma import Chroma
from app.core.embedding import get_embeddings


PROJECT_ROOT = Path(__file__).resolve().parents[2]


VECTOR_DB_PATH = PROJECT_ROOT / "chroma_db"


vector_store = Chroma(
    collection_name="meeting_assistant",
    embedding_function=get_embeddings(),
    persist_directory=str(VECTOR_DB_PATH),
    client_settings=ChromaSettings(anonymized_telemetry=False),
)

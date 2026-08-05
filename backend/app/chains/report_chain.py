from typing import Callable, Optional
from app.services.transcript_chunking import chunk_transcript
from .map_chain import MapChain
from .reduce_chain import ReduceChain

# emit(stage: str, message: str) -> None
EventEmitter = Callable[[str, str], None]


class ReportChain:

    def __init__(
        self,
        map_chain: MapChain,
        reduce_chain: ReduceChain,
    ):
        self.map_chain = map_chain
        self.reduce_chain = reduce_chain

    def generate(self, transcript: str, emit: Optional[EventEmitter] = None):

        def _emit(stage: str, message: str = ""):
            if emit:
                emit(stage, message)

        _emit("chunking", "Splitting transcript into chunks")
        chunks = chunk_transcript(transcript)
        _emit("chunking_done", f"{len(chunks)} chunks created")

        # "Reader Agent" = map stage: per-chunk structured extraction
        analyses = self.map_chain.batch(
            chunks,
            emit=lambda index, total: _emit(
                "reader_agent", f"Analyzing {index}/{total} chunks"),
        )
        _emit("reader_agent_done", "Chunk analysis complete")

        # "Critic Agent" = reduce stage: synthesizes final report from analyses
        _emit("critic_agent", "Synthesizing final report")
        report = self.reduce_chain.invoke(analyses)
        _emit("critic_agent_done", "Report synthesized")

        return report

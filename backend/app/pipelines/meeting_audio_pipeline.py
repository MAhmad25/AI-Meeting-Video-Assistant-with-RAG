from pathlib import Path
from typing import Callable, Optional
from app.services.audio_processor import audio_preprocessor
from app.services.cloud_whisper import generate_transcript

EventEmitter = Callable[[str, str], None]


class GenerateMeetingTranscript:
    """
    Same transcript-generation logic as GenerateTranscript (audio_pipeline.py),
    but starts from a local recording file instead of a YouTube URL.
    """

    def __init__(self):
        self.audio_preprocessor = audio_preprocessor

    def generate_transcript(self, recording_path: str | Path, emit: Optional[EventEmitter] = None) -> str:

        def _emit(stage: str, message: str = ""):
            if emit:
                emit(stage, message)

        recording_path = Path(recording_path)
        if not recording_path.exists():
            _emit("error", f"Recording not found: {recording_path}")
            raise FileNotFoundError(f"Recording not found: {recording_path}")

        _emit("compressing_audio", "Compressing and normalizing recording")
        processed_audio_path = self.audio_preprocessor.preprocess(recording_path)
        _emit("compressing_audio_done", "Audio ready for transcription")

        _emit("generating_transcript", "Transcribing audio")
        transcript = generate_transcript(processed_audio_path)
        _emit("generating_transcript_done", "Transcript generated")

        return transcript


GenerateMeetingTranscript_service = GenerateMeetingTranscript()

from typing import Callable, Optional
from rich import print
from app.services.youtube import yt_download_audio
from app.services.audio_processor import audio_preprocessor
from app.services.cloud_whisper import generate_transcript
from dotenv import load_dotenv
load_dotenv()

EventEmitter = Callable[[str, str], None]


class GenerateTranscript:
    def __init__(self):
        self.yt_download_audio = yt_download_audio
        self.audio_preprocessor = audio_preprocessor

    def generate_transcript(self, youtube_url: str, emit: Optional[EventEmitter] = None) -> str:

        def _emit(stage: str, message: str = ""):
            if emit:
                emit(stage, message)

        _emit("downloading_video", "Downloading audio from YouTube")
        audio_path = self.yt_download_audio.download_audio(youtube_url)
        print(audio_path)
        if audio_path is None:
            _emit("error", "Audio download failed")
            raise ValueError("Audio download failed")
        _emit("downloading_video_done", "Audio downloaded")

        _emit("compressing_audio", "Compressing and normalizing audio")
        processed_audio_path = self.audio_preprocessor.preprocess(audio_path)
        _emit("compressing_audio_done", "Audio ready for transcription")

        _emit("generating_transcript", "Transcribing audio")
        transcript = generate_transcript(processed_audio_path)
        _emit("generating_transcript_done", "Transcript generated")

        return transcript


GenerateTranscript_service = GenerateTranscript()

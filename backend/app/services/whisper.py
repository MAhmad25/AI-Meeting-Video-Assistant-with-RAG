from pathlib import Path
from faster_whisper import WhisperModel
from rich import print


class WhisperService:
    def __init__(
        self,
        model_name: str = "small",
        device: str = "cpu",
        compute_type: str = "int8",
    ):
        print("[cyan]Loading Whisper model...[/cyan]")

        self.model = WhisperModel(
            model_name,
            device=device,
            compute_type=compute_type,
        )

        print("[green]Whisper model loaded.[/green]")

    def transcribe(self, audio_path: str | Path) -> str:
        """
        Transcribe any language and return an English transcript.
        """

        audio_path = Path(audio_path)

        if not audio_path.exists():
            raise FileNotFoundError(audio_path)

        segments, info = self.model.transcribe(
            str(audio_path),

            # Translate every language to English
            task="translate",

            # Automatically detect language
            language=None,

            # Ignore silence
            vad_filter=True,

            beam_size=5,

            word_timestamps=False,
        )

        transcript = []

        for segment in segments:
            transcript.append(segment.text.strip())

        final_transcript = " ".join(transcript)

        print(
            f"[green]Detected Language:[/green] {info.language}"
        )
        print(final_transcript)

        return final_transcript


Whisper_service = WhisperService()

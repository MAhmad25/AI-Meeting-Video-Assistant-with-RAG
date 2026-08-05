from pathlib import Path
import ffmpeg
from rich import print


class AudioPreprocessor:
    def __init__(self, output_dir: str = "processed_audio"):
        project_root = Path(__file__).resolve().parents[2]
        self.output_dir = project_root / output_dir
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def preprocess(self, input_file: str | Path) -> Path:
        input_path = Path(input_file)

        if not input_path.exists():
            raise FileNotFoundError(f"File not found: {input_path}")

        output_path = self.output_dir / f"{input_path.stem}.wav"

        (
            ffmpeg
            .input(str(input_path))
            .output(
                str(output_path),
                acodec="pcm_s16le",  # 16-bit PCM
                ar=16000,            # 16 kHz
                ac=1,                # Mono
            )
            .overwrite_output()
            .run(quiet=True)
        )

        print(f"[green]Processed:[/green] {output_path}")

        return output_path


audio_preprocessor = AudioPreprocessor()

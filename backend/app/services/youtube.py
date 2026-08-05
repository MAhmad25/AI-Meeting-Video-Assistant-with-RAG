from pathlib import Path
import yt_dlp
from rich import print


class YouTubeService:
    def __init__(self, download_dir: str = "downloads"):

        project_root = Path(__file__).resolve().parents[2]
        self.download_dir = project_root / download_dir
        print(f"[blue]Download directory:[/blue] {self.download_dir}")
        self.download_dir.mkdir(parents=True, exist_ok=True)

    def download_audio(self, url: str):
        try:
            output_template = str(self.download_dir / "%(id)s.%(ext)s")
            ydl_opts = {
                "format": "bestaudio/best",
                "outtmpl": output_template,
                'extractor_args': {
                    'youtube': {
                        'player_client': ['android'],
                    }
                },
                "postprocessors": [
                    {
                        "key": "FFmpegExtractAudio",
                        "preferredcodec": "wav",
                        "preferredquality": "192",
                    }
                ],
                "noplaylist": True,
                "quiet": True,
                "no_warnings": True,
                'socket_timeout': 30,
                'retries': 10,
                'fragment_retries': 10,
                'skip_unavailable_fragments': True,
                'keepvideo': False,

            }
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:  # type: ignore
                # STEP 1: get info only (NO download)
                info = ydl.extract_info(url, download=False)

                file_path = self.download_dir / f"{info['id']}.wav"

                if file_path.exists():
                    print(f"[yellow]Already exists:[/yellow] {file_path}")
                    return file_path

                ydl.download([url])

                print(f"[green]Downloaded:[/green] {file_path}")
                return file_path
        except Exception as e:
            print(f"[red]Error downloading audio:[/red] {e}")


yt_download_audio = YouTubeService()

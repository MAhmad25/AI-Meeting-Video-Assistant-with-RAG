import os
from pathlib import Path
from groq import Groq
from rich import print
from dotenv import load_dotenv
load_dotenv()


def generate_transcript(audio_path: Path | str) -> str:
    """
    Generate a transcript from an audio file using the Groq API.
    """
    groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))

    with open(audio_path, "rb") as audio:
        result = groq_client.audio.transcriptions.create(
            file=audio,
            model="whisper-large-v3-turbo",
        )

        transcript = result.text
        print(f"[green]Transcript generated successfully.[/green]")
        print(f"[blue]Transcript:[/blue] {transcript}")
        return transcript

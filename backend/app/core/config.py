from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

PROJECT_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    groq_api_key: str | None = None
    tokenrouter_api_key: str | None = None

    storage_dir: Path = PROJECT_ROOT / "storage"
    reports_dir: Path = PROJECT_ROOT / "storage" / "reports"
    recordings_dir: Path = PROJECT_ROOT / "storage" / "recordings"

    ollama_base_url: str = "http://localhost:11434"

    # Electron dev server + packaged app origin
    cors_origins: list[str] = ["http://localhost:5173", "app://."]

    def ensure_dirs(self) -> None:
        for directory in (self.storage_dir, self.reports_dir, self.recordings_dir):
            directory.mkdir(parents=True, exist_ok=True)


settings = Settings()
settings.ensure_dirs()

import json
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    DATABASE_URL: str = "sqlite:///./finance.db"
    PLAID_CLIENT_ID: str = ""
    PLAID_SECRET: str = ""
    PLAID_ENV: str = "sandbox"
    UPLOADS_DIR: str = "./uploads"
    TESSERACT_CMD: str = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]
    SECRET_KEY: str = "change-me-in-prod"
    MAX_UPLOAD_SIZE_MB: int = 10
    DEMO_MODE: bool = False

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors(cls, v):
        if isinstance(v, str):
            return json.loads(v)
        return v

    def ensure_uploads_dir(self):
        Path(self.UPLOADS_DIR).mkdir(parents=True, exist_ok=True)


settings = Settings()
settings.ensure_uploads_dir()

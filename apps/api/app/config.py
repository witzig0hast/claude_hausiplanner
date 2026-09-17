from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg://homework:homework@localhost:5432/homework"
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 14
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.1"
    expo_access_token: str | None = None
    digest_hour_local: int = 19  # daily digest push, 24h local time

    class Config:
        env_prefix = "HOMEWORK_"
        env_file = ".env"


settings = Settings()

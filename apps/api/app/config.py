from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg://homework:homework@localhost:5432/homework"
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 14

    # Deliberately separate secret/algorithm from normal user auth, so a leaked
    # user JWT secret can never be used to forge superadmin access (or vice versa).
    superadmin_jwt_secret: str = "change-me-too-in-production"
    superadmin_token_expire_minutes: int = 15
    superadmin_challenge_expire_seconds: int = 120
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.1"
    ollama_vision_model: str = "llava"
    # Structuring a voice transcript into a homework suggestion is a small, fast task -
    # defaults to ollama_model, but a smaller/quicker model can be set here instead.
    ollama_voice_model: str | None = None
    whisper_host: str = "localhost"
    whisper_port: int = 10300
    expo_access_token: str | None = None
    digest_hour_local: int = 19  # daily digest push, 24h local time
    web_base_url: str = "http://localhost:3000"

    # Global SMTP config for deadline-reminder emails - set once in .env, no per-class setup.
    # Sending stays off entirely unless smtp_host AND smtp_from_email are both set; the
    # per-user "email_reminders_enabled" flag only matters once SMTP itself is configured.
    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_username: str | None = None
    smtp_password: str | None = None
    smtp_from_email: str | None = None
    smtp_use_tls: bool = True

    # OwnAI Agent Bus - lets this project exchange messages/tasks peer-to-peer with the user's
    # other self-hosted projects via a central hub, without OwnAI mediating. Polling stays off
    # entirely unless ownai_agent_bus_key is set. ownai_agent_bus_user_email names which
    # Hausiplaner account task handlers (e.g. "list_open_homework") act on behalf of - the bus
    # itself has no concept of "which of this class's members", only one OwnAI account per key.
    ownai_agent_bus_base_url: str = "https://ownai.hastnetwork.de/api/v1"
    ownai_agent_bus_key: str | None = None
    ownai_agent_bus_user_email: str | None = None
    ownai_agent_bus_poll_seconds: int = 10

    class Config:
        env_prefix = "HOMEWORK_"
        env_file = ".env"


settings = Settings()

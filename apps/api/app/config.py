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

    # OwnAI Agent Bus - lets any user of this project exchange messages/tasks peer-to-peer with
    # their own other self-hosted projects via a central hub, without OwnAI mediating. Each user
    # connects their own OwnAI account from their own Settings page (api key + optional base_url
    # override, stored per-user, encrypted at rest) - this is only the shared default base_url
    # and poll interval, not a server-wide on/off switch.
    ownai_agent_bus_base_url: str = "https://ownai.hastnetwork.de/api/v1"
    ownai_agent_bus_poll_seconds: int = 10
    # Encrypts every user's stored Agent Bus API key at rest (Fernet, derived from this secret) -
    # deliberately separate from jwt_secret, same reasoning as superadmin_jwt_secret: a leaked
    # purpose-specific secret should never unlock an unrelated one.
    secret_encryption_key: str = "change-me-in-production"

    # Homework material uploads (PDFs, images, office docs, ...) - stored on disk, not in the
    # database. Must be a path on a persistent volume (see docker-compose.yml) or uploads are
    # lost whenever the api container is recreated.
    uploads_dir: str = "/app/uploads"
    max_attachment_bytes: int = 20 * 1024 * 1024

    # SSO login via any OpenID Connect provider (e.g. Authentik) - optional, the password
    # login/register flow keeps working unchanged either way. oidc_issuer is the provider's base
    # URL (its "/.well-known/openid-configuration" document is discovered from there), e.g.
    # https://authentik.example.de/application/o/hausiplanner/. oidc_redirect_uri should match
    # exactly what's registered as the client's redirect URI in the provider; left unset, it's
    # derived from the incoming request's own base URL - fine behind a reverse proxy that sets
    # X-Forwarded-* correctly, but safer to set explicitly if that's in doubt.
    oidc_issuer: str | None = None
    oidc_client_id: str | None = None
    oidc_client_secret: str | None = None
    oidc_redirect_uri: str | None = None

    class Config:
        env_prefix = "HOMEWORK_"
        env_file = ".env"


settings = Settings()

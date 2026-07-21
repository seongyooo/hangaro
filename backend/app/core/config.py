from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # KTO OpenAPI
    KTO_API_KEY: str = ""
    KTO_BASE_URL: str = "http://apis.data.go.kr/B551011/KorService1"
    TATS_BASE_URL: str = "https://apis.data.go.kr/B551011/TatsCnctrRateService"

    # Database
    DATABASE_URL: str = "postgresql://user:password@localhost:5432/hangaro"

    # Redis
    REDIS_URL: str = "redis://localhost:6379"
    CONGESTION_TTL: int = 300  # 5분

    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:5173"]

    class Config:
        env_file = ".env"


settings = Settings()

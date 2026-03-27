from pydantic_settings import BaseSettings
from functools import lru_cache
import os


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://plantation_user:plantation_pass@localhost:5432/plantation"
    REDIS_URL: str = "redis://localhost:6379/0"
    JWT_SECRET: str = "plantation-jwt-secret-change-in-prod"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_HOURS: int = 24
    UPLOAD_DIR: str = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
    TILES_DIR: str = os.path.join(os.path.dirname(os.path.dirname(__file__)), "tiles")

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()

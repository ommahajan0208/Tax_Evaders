import os

class Settings:
    PROJECT_NAME: str = "SEBI Agentic Compliance & Regulatory AI Assistant"
    API_V1_STR: str = "/api"
    
    # Auth Security
    SECRET_KEY: str = os.getenv("SECRET_KEY", "sebi_compliance_agentic_workflow_secret_key_2026")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 1 day
    
    # Base paths
    BASE_DIR: str = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    DATA_DIR: str = os.path.join(BASE_DIR, "data")
    
    # Upload & Vector DB paths
    UPLOAD_DIR: str = os.path.join(DATA_DIR, "uploads")
    VECTOR_STORE_DIR: str = os.path.join(DATA_DIR, "vector_store")
    
    # Database (Ensure absolute paths are formatted properly for SQLite)
    # We replace backslashes with forward slashes for SQLite database URL
    db_path = os.path.join(DATA_DIR, "sebi.db").replace("\\", "/")
    DATABASE_URL: str = os.getenv("DATABASE_URL", f"sqlite+aiosqlite:///{db_path}")
    
    # Gemini API
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")

settings = Settings()

# Ensure directories exist
os.makedirs(settings.DATA_DIR, exist_ok=True)
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
os.makedirs(settings.VECTOR_STORE_DIR, exist_ok=True)

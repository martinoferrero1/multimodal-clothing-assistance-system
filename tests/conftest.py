import os


# Ensure test imports never load runtime identity or provider credentials from .env.
os.environ["APP_ENV"] = "test"
os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["AUTH_TOKEN_SECRET"] = "test-auth-secret"
os.environ["GOOGLE_API_KEY"] = ""
os.environ["GROQ_API_KEY"] = ""
os.environ["GOOGLE_LLM_MODEL"] = ""
os.environ["GROQ_LLM_MODEL"] = ""
os.environ["GOOGLE_EMBEDDING_MODEL"] = ""
os.environ["GROQ_EMBEDDING_MODEL"] = ""
os.environ["GOOGLE_IMAGE_ANALYSIS_MODEL"] = ""

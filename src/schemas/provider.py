from enum import Enum

class Provider(str, Enum):
    google = "google"
    groq = "groq"
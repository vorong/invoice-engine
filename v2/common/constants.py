"""Global constants and configuration for the Invoice Engine V2."""

import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from .env file.
load_dotenv()

# Google Drive Folder IDs
FOLDER_ID_SOURCE_DOCS = os.getenv("FOLDER_ID_SOURCE_DOCS")

# Authentication
SERVICE_ACCOUNT_DRIVE_READER = os.getenv(
    "SERVICE_ACCOUNT_CREDENTIALS_DRIVE_READER")
DRIVE_READ_SCOPES = ["https://www.googleapis.com/auth/drive.readonly"]

# Local Cache/Storage
BASE_CACHE_DIR = Path("drive_cache")
ORIGINALS_DIR = BASE_CACHE_DIR / "originals"
BRACKETED_DIR = BASE_CACHE_DIR / "bracketed"

# Temporary/Diagnostic Storage
TMP_DIR = Path("tmp")
THUMBNAILS_DIR = TMP_DIR / "thumbnails"

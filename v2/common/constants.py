"""Global constants and configuration for the Invoice Engine V2."""

import os
from pathlib import Path
from datetime import date
from dotenv import load_dotenv

# Load environment variables from .env file.
load_dotenv()

# Google Drive Folder IDs
FOLDER_ID_SOURCE_DOCS = os.getenv("FOLDER_ID_SOURCE_DOCS")

# Authentication
SERVICE_ACCOUNT_DRIVE_READER = os.getenv(
    "SERVICE_ACCOUNT_CREDENTIALS_DRIVE_READER")
DRIVE_READ_SCOPES = ["https://www.googleapis.com/auth/drive.readonly"]

# Local Pipeline Stages (Past Tense)
BASE_OUTPUT_DIR = Path("pipeline_output")
DISCOVERED_DIR = BASE_OUTPUT_DIR / "discovered"
CONVERTED_DIR = BASE_OUTPUT_DIR / "converted"
SCOPED_DIR = BASE_OUTPUT_DIR / "scoped"

# Scoped Branch 1: Forensic Status
SCOPED_STATUS_DIR = SCOPED_DIR / "date_parse_status"
SCOPED_STATUS_FAILED_DIR = SCOPED_STATUS_DIR / "date_parse_failed"
SCOPED_STATUS_SUCCESSFUL_DIR = SCOPED_STATUS_DIR / "date_parse_successful"
SCOPED_STATUS_HEURISTIC_DIR = SCOPED_STATUS_DIR / "date_parse_heuristic"
SCOPED_STATUS_CONFLICT_DIR = SCOPED_STATUS_DIR / "date_parse_scope_conflict"

# Scoped Branch 2: Working Set
SCOPED_FULLY_SCOPED_DIR = SCOPED_DIR / "fully_scoped"

# Project-wide constraints
IN_SCOPE_START_DATE = date(2021, 1, 1)

# Temporary/Diagnostic Storage (Not for pipeline flow)
TMP_DIR = Path("tmp")
EXPLORATION_DIR = TMP_DIR / "doc_inspector"
EXPLORATION_DOCS_DIR = EXPLORATION_DIR / "docs"
EXPLORATION_THUMBNAILS_DIR = EXPLORATION_DIR / "thumbnails"

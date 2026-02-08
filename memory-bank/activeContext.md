# Active Context

## Current Focus
Initial project setup and implementation of the **Discovery Phase**.

## Current Task
Implementing `v2/drive_client.py` and `v2/engine.py` to:
1. Initialize the SQLite database.
2. Search for the Google Sheet "Control Center" or create it if missing.
3. Scan the source folder (`1acLF...`) and populate the initial manifest.

## Recent Decisions
- Use MD5 hashes from Google Drive metadata as the primary identity for binary files.
- Store the `control_sheet_id` in the SQLite `config` table to prevent duplicate sheet creation.
- Perform a "Fast Triage" using text-only exports to identify in-scope dates (>= 2021).
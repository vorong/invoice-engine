# Active Context

## Current Focus
Data exploration and categorization of multi-version invoices (e.g., suffixes like `-A`).

## Current Task
1. Create `memory-bank/dataInsights.md` to codify revenue streams and invoice versioning buckets.
2. Document the 10 hand-reviewed examples as a reference set.
3. Analyze converted Google Docs/HTML/PDF artifacts to identify more instances of multi-version invoices and validate the bucket categories.

## Recent Decisions
- **Shift in Priority:** Paused database/client implementation to deepen understanding of versioning patterns.
- **Durable Documentation:** Using the Memory Bank to store qualitative findings about invoice data "noise" to inform future LLM prompting strategies.
- **Version Buckets:** Defined 4 initial classes for related invoices (Simultaneous, Corrected, Additional Items, Down-payment).
- **Revenue Categories:** Identified 5 primary revenue streams (Sales, Service Contracts, Rentals, Repairs, Spare Parts).

## Prior Focus Before Switching Gears
Initial project setup and implementation of the **Discovery Phase**.

## Prior Task Before Switching Gears
Implementing `v2/drive_client.py` and `v2/engine.py` to:
1. Initialize the SQLite database.
2. Search for the Google Sheet "Control Center" or create it if missing.
3. Scan the source folder (`1acLF...`) and populate the initial manifest.

## Prior Recent Decisions Before Switching Gears
- Use MD5 hashes from Google Drive metadata as the primary identity for binary files.
- Store the `control_sheet_id` in the SQLite `config` table to prevent duplicate sheet creation.
- Perform a "Fast Triage" using text-only exports to identify in-scope dates (>= 2021).

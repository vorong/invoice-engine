# Tech Context

## Stack
- **Language:** Python 3.14+
- **Package Manager:** `uv` v0.10.0+
- **Build System:** `hatchling`
- **Linting/Formatting:** Ruff v0.15.0+
- **Database:** SQLite 3.x (Planned for Phase 4)
- **AI:** Google Gemini 3 Flash Preview
- **APIs:** Google Drive API v3
- **External Tools:** `antiword`

## Authentication & Security
- **Service Accounts:** Utilizing dedicated Google Cloud Service Accounts (`drive-reader-service-account.json`).
- **Secrets Management:** Environment variables via `.env`.
- **Git Security:** Strict `.gitignore` policy for credential files (`*-service-account.json`), environment files (`.env`), and local data caches (`pipeline_output/`, `tmp/`).

## Local Pipeline Output Structure
- `pipeline_output/discovered/`: Mirrored legacy `.doc` files.
- `pipeline_output/converted/`: Transcribed bracketed text with OLE2 metadata.
- `pipeline_output/scoped/`: Root for the working set definition.
  - `date_parse_status/`: Forensic branch categorizing every file by its date integrity.
    - `date_parse_failed/`: No date found (grouped by metadata date).
    - `date_parse_successful/`: Clean in-scope date found.
    - `date_parse_heuristic/`: Cleaned in-scope date (grouped by extracted date).
    - `date_parse_scope_conflict/`: Old invoice date vs. recent metadata.
  - `fully_scoped/`: Production branch containing the actual files for LLM extraction.
- `tmp/doc_inspector/`: Ad-hoc exploration artifacts.

## Constraints
- **READ-ONLY Source:** Original `.doc` files are never modified.
- **Idempotency:** Resumable stages using artifact-existence checks.
- **Atomic Writes:** Temp-buffer pattern for downloads to prevent corruption.
- **Stage-Gating:** Sequential execution to provide global context for future stages.

# Tech Context

## Stack
- **Language:** Python 3.14+
- **Package Manager:** `uv` v0.10.0+ (Using `uv lock` for reproducible environments)
- **Build System:** `hatchling` (configured in `pyproject.toml`)
- **Linting/Formatting:** Ruff v0.15.0+
- **Database:** SQLite 3.x (Planned for Phase 3)
- **AI:** Google Gemini 3 Flash Preview
- **APIs:** Google Drive API v3 (using `google-api-python-client`)
- **External Tools:** `antiword` (for .doc to XML conversion), `libwmf` (for thumbnail extraction)

## Authentication & Security
- **Service Accounts:** Utilizing dedicated Google Cloud Service Accounts for Drive access (`drive-reader-service-account.json`).
- **Secrets Management:** Environment variables via `.env` (gitignored).
- **Git Security:** Strict `.gitignore` policy for credential files and local data caches (`drive_cache/`).

## Local Cache Structure
- `drive_cache/originals/`: Mirrored legacy `.doc` files.
- `drive_cache/bracketed/`: Transcribed text versions with structural table markers.
- `tmp/thumbnails/`: Visual artifacts extracted from OLE2 streams.

## Constraints
- **READ-ONLY Source:** Original `.doc` files are never modified.
- **Idempotency:** All pipeline stages check for existing artifacts to allow resumption.
- **Atomic Writes:** Downloads use `.tmp` buffers to prevent file corruption on interruption.

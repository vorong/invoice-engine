# Invoice Engine

A robust AI-powered ETL pipeline designed to digitize and clean 25 years of legacy business invoices stored as binary `.doc` files.

## Getting Started

### Prerequisites
- **Python 3.14+**
- **uv** package manager
- **System Tools:** `antiword` (for document parsing), `libwmf` (for thumbnail extraction).

### Setup
1. Clone the repository.
2. Initialize the environment:
   ```bash
   uv sync
   ```
3. Configure your environment variables by creating a `.env` file:
   ```env
   FOLDER_ID_SOURCE_DOCS=...
   SERVICE_ACCOUNT_CREDENTIALS_DRIVE_READER=drive-reader-service-account.json
   ```

## Usage

The project utilizes `uv` project scripts for a streamlined CLI experience.

### Running the Pipeline
The pipeline is stage-gated, ensuring each step is completed for the entire archive before proceeding.
```bash
# Run the full pipeline (Discovery -> Conversion -> Scoping)
uv run run-pipeline

# Run specific stages
uv run run-pipeline --stages discovery
uv run run-pipeline --stages conversion
uv run run-pipeline --stages scoping
```

### Exploration & Diagnostics
Use the inspector to manually triage specific files or batches:
```bash
uv run explore-doc-inspector --output-format bracketed --batch 5
```

---

## Project Evolution

### V2: Python Pipeline (Current)
Migrating to a robust, modular Python architecture to handle high-volume processing (~2500 files) with stateful resumption and parallel execution.
- **Discovery:** High-speed parallel mirroring of remote Drive files with atomic write safety.
- **Conversion:** Structural parsing using `antiword` to produce "Bracketed Text" format with `<br>` table cell fidelity and OLE2 metadata headers.
- **Scoping:** Forensic date extraction and dual-branch bucketing to define the active working set.

### V1: Apps Script Prototype (Legacy)
A Google Apps Script-based prototype that proved the viability of Gemini-powered extraction.
- Limited by Google Script execution timeouts.
- Utilized Google Docs API for initial structural extraction.
- Stored in the `/v1` directory for historical reference.

---

## Documentation
- `/memory-bank`: Durable store of design thinking, project progress, and architectural patterns.
- `/v2`: Core Python implementation.

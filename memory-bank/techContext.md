# Tech Context

## Stack
- **Language:** Python 3.14+ (Stable release 3.14.3 as of Feb 2026)
- **Package Manager:** `uv` v0.10.0+ (Utilizing `uv lock` and `uv sync` for reproducible environments)
- **Linting/Formatting:** Ruff v0.15.0+ (Using the **2026 Style Guide** integrated via `uv format`)
- **IDE:** Project IDX (Beta) - Browser-based with native Gemini 3 "Build Mode" and "Vibe Coding" integration.
- **Database:** SQLite 3.x (Local `engine.db`)
- **AI:** Google Gemini 3 Flash Preview (`gemini-3-flash-preview`) 
  - Utilizing **Thinking Levels** (Minimal, Low, Medium, High)
  - Native **Structured Output** for JSON extraction
  - Upgraded spatial and visual reasoning for PDF/text-box anchors.
- **APIs:** Google Drive API v3, Google Sheets API v4
- **Data Validation & LLM Orchestration:** Pydantic AI (v1.55+)
    - Defines the "Data Contract" using standard Python type hints.
    - Interfaces with Gemini 3 **Structured Outputs** for guaranteed JSON schema compliance.
    - Utilizes `pydantic-core` (Rust-backed) for machine-speed validation of 2,500+ records.

## Constraints
- **Execution Environment:** Project IDX VM (Managed Linux Environment).
- **Authentication:** Application Default Credentials (ADC) via `google-auth`.
- **Code Style:** Google Python Style Guide (2026 Edition).
- **Version Control:** Public GitHub (strictly enforcing `.gitignore` for `*.db`, `.env`, and `.clasprc.json`).
- **Secrets Management:** Environment variables via `.env` or IDX Secret Manager.

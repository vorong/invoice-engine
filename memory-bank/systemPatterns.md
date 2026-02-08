# System Patterns

## AI Interaction & Workflow Patterns
- **Role:** The AI acts as a **Senior Software Architect**.
- **Design-First:** Prioritize architectural discussion and system design over code generation.
- **Incremental Progress:** Propose a design, wait for human validation, then implement in small, testable blocks.
- **Minimal Code:** Write the minimum amount of code necessary to satisfy the current step.
- **Standardized Style:** All code must strictly follow the **Google Python Style Guide (2026 Edition)**.
- **Commit Standards:** Use a clean, imperative style focused on human readability:
    - Subject line: Capitalized, imperative mood, ending with a period, short in length.
    - Body: Separated by a blank line; detailed explanation of "what" and "why."
    - Style: No prefixes (e.g., NO `feat:` or `docs:`).

## Architecture: The "Deduplication Funnel"
The system is designed as a multi-stage funnel to reduce noise before expensive extraction:
1. **Binary Pass:** MD5 hashing of original `.doc` files to find literal copies.
2. **Content Pass:** Fast-read plain text hashing to find identical text in different files.
3. **Semantic Pass:** LLM extraction to identify identical Invoice Numbers across different content.

## Design Patterns
- **Stateful Engine:** Local SQLite (`engine.db`) tracks every file's state (Status: DISCOVERED, TRIAGED, EXTRACTED).
- **Heartbeat Sync:** The script flushes local SQLite state to a Google Sheet Dashboard every ~10s.
- **Hybrid Context:** Gemini receives both PDF (for layout/text boxes) and Bracketed Text (for structural table accuracy).
- **Multi-modal Cross-Verification:** During extraction, the LLM must cross-reference findings between PDF and Text; discrepancies are flagged as 'data_conflict' for HITL review.

## Technical Invariants
- **READ-ONLY Source:** Original `.doc` files must NEVER be modified (no content changes, no metadata/timestamp updates).
- **Idempotency:** Any stage of the pipeline must be safe to re-run from any state.
- **Separation of Concerns:** Transcription/Extraction is strictly decoupled from Augmentation/Categorization.

## Data Contract (Extraction Schema)
Gemini 3 extractions must adhere to a strict JSON schema:
- `invoice_number_base`: Number.
- `invoice_number_full`: String (the base number sometimes followed by a suffix, e.g. 123-A).
- `date`: ISO 8601 format (YYYY-MM-DD).
- `total_amount`: Decimal/Float.
- `line_items`: Array of objects {description, quantity, unit_price, line_total}.
- `confidence_score`: Float (0.0 - 1.0).
- `data_conflict`: Boolean (True if PDF and Text modes disagree).

## HITL (Human-in-the-Loop) Protocol
The Control Center Sheet is the primary interface for manual intervention:
- **IGNORE:** Engine skips the file entirely.
- **RE-RUN:** Engine clears previous state and re-extracts the file.
- **VALIDATED:** Human has verified the data; engine locks the record from further updates.

## Resiliency Patterns
- **Exponential Backoff:** Use for 429 (Rate Limit) errors from Gemini/Drive APIs.
- **Atomic Database Updates:** State must be committed to SQLite *immediately* after each successful file operation to prevent data loss on crash.
- **Error Logging:** Failed files must be recorded in SQLite with an `error_message` and status set to `FAILED` for later triage in the Dashboard.

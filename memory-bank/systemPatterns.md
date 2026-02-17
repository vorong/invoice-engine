# System Patterns

## AI Interaction & Workflow Patterns
- **Role:** The AI acts as a **Senior Software Architect**.
- **Design-First:** Prioritize architectural discussion and system design over code generation.
- **Incremental Progress:** Propose a design, wait for human validation, then implement in small, testable blocks.
- **Minimal Code:** Write the minimum amount of code necessary to satisfy the current step.
- **Standardized Style:** All code must strictly follow the **Google Python Style Guide (2026 Edition)**.
- **Commit Standards:** Use a clean, imperative style focused on human readability:
    - Subject line: Capitalized, imperative mood, ending with a period (max 72 chars).
    - Body: Separated by a blank line; detailed explanation of "what" and "why" (wrapping at 72 chars).
    - Style: No prefixes (e.g., NO `feat:` or `docs:`).
- **Continuous Documentation:** Regularly update the app documentation, especially the /memory-bank, so that the emerging design thinking is stored in a durable manner outside of transient LLM chats.
- **README Maintenance:** Ensure the top-level README.md remains the source of truth for "Getting Started" and "Usage," keeping the most recent version information at the top.

## AI Communication & Control (CRITICAL)
- **Wait for Validation:** NEVER proceed to implementation, file creation, or command execution without explicit user confirmation of the proposed design.
- **Confirm Intent:** If a request is broad, break it into a "Plan" and ask for approval.
- **Integrity of Work:** Do not remove or modify unrelated sections of code or documentation. Even if a section could be improved, it must remain untouched unless specifically part of the current task.
- **No Laziness:** Do the full work. Never use placeholders like "preserving previous sections" or "rest of file." Provide complete, actionable files.

## Transcription Syntax (Bracketed Text)
To ensure structural fidelity while remaining LLM-friendly, the pipeline utilizes a standardized "Bracketed Text" format for tables:
- **Row Delineation:** Each logical table row is represented as a single physical line of text.
- **Cell Delineation:** Cell contents are wrapped in square brackets: `[ Cell Content ]`.
- **Newline Delineation:** Internal line breaks within a single cell (e.g., an address or long description) are represented by the `<br>` tag.
- **Empty Cells:** Represented as `[ EMPTY ]`.
- **Invariant:** The format must preserve the "One Logical Row = One Line" rule to allow for machine-speed triage and unambiguous column indexing.

**Example:**
`[ SOLD TO ] [ AstraZeneca <br> 200 Cardinal Way ] [ Date ] [ 01.22.26 ]`

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
- **Bracketed Representation:** Standardized text view for tables using `[ cell ]` notation, where multi-line content within cells is delineated using `<br>` tags to preserve the "One Logical Row = One Line" invariant.

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

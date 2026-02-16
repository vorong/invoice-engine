# Progress

## Milestones
- [X] Project Setup: Git, `uv`, IDX Workspace.
- [X] V1 Legacy Memorialization.
- [X] Core Infrastructure: Modular package hierarchy and centralized auth.
- [X] Phase 1: Discovery & Mirroring (Completed mirroring of ~2500 files).
- [X] Phase 2: Conversion (Completed batch transformation to Bracketed Text).
- [ ] Phase 3: Metadata Triage & Deduplication.
- [ ] Phase 4: Extraction & Verification.
- [ ] Phase 5: Final Data Export.

## Completed
- `v2/common/`: Auth and Constants.
- `v2/discovery/`: Parallel mirroring engine with atomic write safety.
- `v2/conversion/`: Batch parser with `<br>` multi-line cell support.
- `v2/exploration/doc_inspector.py`: Refactored to leverage core pipeline logic.
- `v2/main.py`: Master orchestrator with stage-gating.
- `pyproject.toml`: Project renamed, `hatchling` backend, and `uv run` scripts.

## Current Work
- Preparing for **Phase 3: Triage**, where we will identify in-scope invoices (>= 2021) and resolve duplicates.

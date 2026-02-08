# Project Brief: Invoice Engine

## Core Goal
Digitize and clean 25 years of legacy business invoices stored as binary `.doc` files. The project is migrating from an **Apps Script prototype with simple AI integration (V1)** to a **robust, AI-powered ETL pipeline in Python (V2)** designed for high reliability and sophisticated data reconciliation.

## Objectives
- Extract structured data (Invoice #, Date, Line Items, Totals) from high-noise legacy files.
- Resolve duplicates caused by user error and inconsistent versioning using a multi-stage, human-in-the-loop deduplication funnel.
- Categorize revenue streams for BI reporting.
- Maintain a stateful, resumable pipeline that can handle batch processing of ~2500 files without execution timeouts.

## In Scope
- Metadata discovery and binary/text deduplication of the entire 25-year archive.
- Full extraction for invoices from Jan 1, 2021, to present (~334 files).
- Multimodal extraction using Gemini 3 Flash Preview.

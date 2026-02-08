# Product Context

## The Problem
Small business invoice data is "noisy." Over 25 years, files have been duplicated, renamed incorrectly, or updated with inconsistent versioning (e.g., `123.doc` vs `123-A.doc`). Line items are occasionally lost between versions.

## User Experience
The "User" (business analyst) interacts with a Google Sheet "Control Center." 
- It acts as a Headless UI to monitor progress.
- It allows for Human-in-the-Loop (HITL) decisions (marking duplicates, overriding extraction errors).

## Success Criteria
- **Pristine "Gold" Dataset:** A structured database where every unique invoice from the input set is represented, featuring 100% accuracy on header data (Date, Invoice #, Total).
- **Line-Item Granularity:** Successful extraction of individual line items (Description, Quantity, Unit Price, Line Total) with no omissions or duplications for all in-scope invoices, enabling granular sales and product-line reporting.
- **Data Integrity:** Zero modification to the original source `.doc` files; all transformations are handled in the artifact cache or enrichment layers.
- **Auditability:** Every record in the final dataset can be traced back to its specific source hash and PDF artifact for human verification.

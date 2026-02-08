# Data Insights

## Revenue Streams & Business Logic
Understanding how the business generates revenue allows the engine to categorize line items accurately.

### Primary Streams (Priority Order)
1.  **Sales:** Direct sales of new equipment.
2.  **Service Contracts:** Recurring revenue for maintenance/support.
3.  **Repairs:** One-off labor and parts for fixing equipment.
4.  **Rentals:** Provided for a fee, often in tandem with repairs (equipment provided while the customer's unit is being serviced).
5.  **Spare Parts:** Sale of individual components.

## Invoice Versioning Patterns (The "Suffix" Logic)
When multiple files share a base invoice number (e.g., `12345` and `12345-A`), they fall into one of these buckets:

### Relationship Buckets
| Bucket | Name | Description | Logic for Pipeline |
| :--- | :--- | :--- | :--- |
| **B1** | **Simultaneous Service** | Same date, different locations. | Treat as two distinct, valid invoices. |
| **B2** | **Corrected/Superseded** | Second has all items from first + corrections. | Keep the latest version; mark earlier as "Superseded". |
| **B3** | **Incremental/Additional** | Second has only new items (e.g., shipping only). | Merge line items from both into a single record. |
| **B4** | **Down-payment & Final** | First is a deposit; second is the final balance. | Link records; final invoice usually represents the "Gold" state. |
| **B5** | **Parts List (-PL)** | No payment data; list of components only. | Use for product verification; do not count as revenue. |

### Suffix & Filename "Noise" Patterns
*   **Legacy Suffixes:** `-B` and `-C` exist in data older than 5 years (not seen recently).
*   **Incremental:** `-1`, `-2` (Unknown significance, needs investigation).
*   **Duplicate Noise:** `(1)` usually indicates a literal file duplicate due to human error.
*   **Temp/Recovery Files:** Files starting with `~`, `#`, or `$` are likely artifacts of Word crashing; these should probably be ignored/filtered, but it's also possible they are the only artifact remaining of an invoice, so it may also need to be used.

## Folder References
*Folder IDs are stored securely in environment variables and are not documented in the public memory bank.*

## Hand-Labeled Reference Set (Invoice Relationship Examples)
This set is used to validate the deduplication funnel logic.

| Base # | Suffix # | Date Relation | Findings | Bucket |
| :--- | :--- | :--- | :--- | :--- |
| 18309 | 18309-A | Different | Second has shipping added. | B2 |
| 18294 | 18294-A | Different | First: Down payment; Second: Balance + shipping. | B4 |
| 18034 | 18034-A | Same | Two service calls to two different buildings. | B1 |
| 17969 | 17969-A | Same | Two service calls to two different buildings. | B1 |
| 17964 | 17964-A | Near (+5d) | Minor adjustment to shipping charge. | B2 |
| 17909 | 17909-A | Different (+1m) | Second has shipping added. | B2 |
| 17869 | 17869-A | Same | Two service calls to two different buildings. | B1 |
| 17848 | 17848-A | Near (+5d) | Second has additional shipping penalty. | B2 |
| 17810 | 17810-A | Same | Two service calls to two different buildings. | B1 |
| 17795 | 17795-A | Same | First is repair; second is shipping only. | B3 |

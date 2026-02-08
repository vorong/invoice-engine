/**
 * Project: Invoice Data Extraction
 * File: InvoiceExport.gs
 * Description: Relational transformation and AI-augmented cleanup for extracted data.
 */

////////////////////////////////////////////////////////////////////////////////
// Export Constants & Configuration.                                         //
////////////////////////////////////////////////////////////////////////////////
const ENABLE_EXPORT_DRY_RUN = false;

// Stage Gating: Toggle which parts of the process run.
const EXPORT_STAGES_TO_RUN = [
  "SETUP",
  "MASTER_ORIGINS",
  "MASTER_CUSTOMERS",
  "MASTER_PRODUCTS",
  "INVOICE_BATCHES",
];

const SHEET_NAME_INVOICE_EXPORT_INVOICES = "INVOICE_LEVEL_DATA";
const SHEET_NAME_INVOICE_EXPORT_ITEMS = "LINE_ITEM_LEVEL_DATA";
const SHEET_NAME_INVOICE_EXPORT_FLAT = "ALL_INVOICE_DATA_FLAT";
const SHEET_NAME_INVOICE_EXPORT_MASTER_ORIGINS = "MASTER_ORIGINS";
const SHEET_NAME_INVOICE_EXPORT_MASTER_CUSTOMERS = "MASTER_CUSTOMERS";
const SHEET_NAME_INVOICE_EXPORT_MASTER_PRODUCTS = "MASTER_PRODUCTS_AND_PARTS";

/**
 * MASTER ORCHESTRATOR
 * Chained execution to regenerate and export all cleaned data.
 */
function runFullExportProcess() {
  const startTime = new Date().getTime();
  console.log("--- [START] FULL EXPORT & REGENERATION PROCESS ---");

  // Ingest Raw Data (Read-Only).
  let rawRows = ingestRawExtractionData();
  if (rawRows.length === 0) {
    console.error("No raw data found to process.");
    return;
  }

  // DRY RUN Logic: Slice dataset if flag is enabled.
  if (ENABLE_EXPORT_DRY_RUN) {
    console.log("--- [DRY RUN ACTIVE] Processing only first 10 rows ---");
    rawRows = rawRows.slice(0, 10);
  }

  // 1. Setup Environment.
  if (EXPORT_STAGES_TO_RUN.includes("SETUP")) {
    setupExportTabs();
  }

  // 2. Build Master Origin Glossary.
  if (EXPORT_STAGES_TO_RUN.includes("MASTER_ORIGINS")) {
    console.log("--- [PASS 1A] BUILDING ORIGIN MASTER ---");
    buildMasterOrigins(rawRows);
  }

  // 3. Build Master Customer Glossary.
  if (EXPORT_STAGES_TO_RUN.includes("MASTER_CUSTOMERS")) {
    console.log("--- [PASS 1B] BUILDING CUSTOMER MASTER ---");
    buildMasterCustomers(rawRows);
  }

  // 4. Build Master Product Glossary.
  if (EXPORT_STAGES_TO_RUN.includes("MASTER_PRODUCTS")) {
    console.log("--- [PASS 1C] BUILDING PRODUCT MASTER ---");
    buildMasterProducts(rawRows);
  }

  // 5. Reconstruct Invoices in Batches.
  if (EXPORT_STAGES_TO_RUN.includes("INVOICE_BATCHES")) {
    console.log("--- [PASS 2] BATCH RECONSTRUCTING INVOICES ---");
    runBatchInvoiceExport(rawRows);
  }

  console.log(
    `--- [COMPLETE] Process Duration: ${(new Date().getTime() - startTime) / 1000}s ---`,
  );
}

/**
 * PASS 1A: Standardizes the Origin (From) addresses to track business locations.
 */
function buildMasterOrigins(rawData) {
  const uniqueOrigins = [...new Set(rawData.map((r) => r.origin_address))];

  const systemPrompt = `Act as a Data Steward. Standardize the "From" (Origin) addresses found in the header logo areas.
ASSIGN SHORT IDs: Give every unique location an "origin_id" (O1, O2...).

CRITICAL: Return a deduplicated list. One row per logical origin. 
YOU ARE FORBIDDEN FROM SAMPLING. 

TASK:
1. Extract and standardize the physical address (e.g. 4051 E. La Palma Ave).
2. Note the date range this location appears to be active based on the logs.

RETURN ONLY JSON:
{
  "origins": [{"origin_id": "string", "raw_address": "string", "standardized_address": "string", "city": "string", "state": "string", "zip": "string"}],
  "self_audit": {"input_addresses": "number", "entities_created": "number"},
  "steward_observations": "string"
}`;

  const responseText = callGeminiSimple(
    systemPrompt,
    JSON.stringify(uniqueOrigins),
    `Unique Origins: ${uniqueOrigins.length}`,
  );
  const responseJson = JSON.parse(responseText);
  const origins = getCaseInsensitiveKey(responseJson, "origins") || [];
  const rows = origins.map((o) => [
    o.origin_id,
    o.raw_address,
    o.standardized_address,
    o.city,
    o.state,
    o.zip,
  ]);

  if (rows.length > 0) {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID_INVOICE_DATA_EXPORT);
    ss.getSheetByName(SHEET_NAME_INVOICE_EXPORT_MASTER_ORIGINS)
      .getRange(2, 1, rows.length, 6)
      .setValues(rows);
  }
}

/**
 * PASS 1B: Identifies and standardizes unique customers.
 */
function buildMasterCustomers(rawData) {
  const uniqueSoldTo = [...new Set(rawData.map((r) => r.sold_to))];

  const systemPrompt = `Act as a Forensic Data Steward. Build the Master Customer Glossary.
ASSIGN SHORT IDs: Give every unique logical business entity a "cust_id" (C1, C2...).

CRITICAL: Return a deduplicated list. One row per logical company. 
YOU ARE FORBIDDEN FROM SAMPLING. 

TASK:
1. Standardize names (remove Inc, LP, etc).
2. Identify procurement proxies (e.g. Technical Compliance -> Raytheon).
3. Return "address_aliases": A summary string of all raw addresses matched to this entity for audit.

RETURN ONLY JSON:
{
  "customers": [{"cust_id": "string", "canonical_name": "string", "parent_company": "string", "ultimate_end_user": "string", "country": "string", "state": "string", "region": "string", "industry": "string", "type": "string", "address_aliases": "string"}],
  "self_audit": {"input_addresses": "number", "entities_created": "number"},
  "steward_observations": "string"
}`;

  const responseText = callGeminiSimple(
    systemPrompt,
    JSON.stringify(uniqueSoldTo),
    `Unique Customers: ${uniqueSoldTo.length}`,
  );
  const responseJson = JSON.parse(responseText);

  const customers = getCaseInsensitiveKey(responseJson, "customers") || [];
  const rows = customers.map((c) => [
    c.cust_id,
    c.canonical_name,
    c.parent_company || "",
    c.ultimate_end_user || "",
    c.country || "",
    c.state || "",
    c.region || "",
    c.industry || "",
    c.type || "",
    c.address_aliases || "",
  ]);

  if (rows.length > 0) {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID_INVOICE_DATA_EXPORT);
    ss.getSheetByName(SHEET_NAME_INVOICE_EXPORT_MASTER_CUSTOMERS)
      .getRange(2, 1, rows.length, 10)
      .setValues(rows);
  }
}

/**
 * PASS 1C: Identifies and standardizes unique products/parts.
 */
function buildMasterProducts(rawData) {
  const uniqueItems = [];
  const seen = new Set();
  rawData.forEach((r) => {
    const key = `${r.item_no}_${r.description}`;
    if (!seen.has(key)) {
      uniqueItems.push({ item: r.item_no, desc: r.description });
      seen.add(key);
    }
  });

  const systemPrompt = `Act as a Product Catalog Expert. Build the Master Product Glossary.
ASSIGN SHORT IDs: Give every logical product a "prod_id" (P1, P2...).

CRITICAL: Return a deduplicated list. One row per logical product/part. 
YOU ARE FORBIDDEN FROM SAMPLING. 

TASK:
1. Normalize IDs.
2. CATEGORIZE: Major Equipment, Consumable Part, Service, Training, Fee, or Gas.
3. DESCRIPTION ANALYSIS: Identify specific items like "GAS - HYDROGEN", "TRADE-IN", "Combustion air pump", "Intake filter", and "Credit card fee" by looking at descriptions.
4. TRADE-INS: Treat "TRADE-IN" as the item and move the details of what was traded to the notes.

RETURN ONLY JSON:
{
  "products": [{"prod_id": "string", "raw_item_no": "string", "raw_description": "string", "canonical_item_no": "string", "category": "string", "product_class": "string", "model_line": "string", "notes": "string"}],
  "self_audit": {"input": "number", "actual": "number"}
}`;

  const responseText = callGeminiSimple(
    systemPrompt,
    JSON.stringify(uniqueItems),
    `Unique Items: ${uniqueItems.length}`,
  );
  const responseJson = JSON.parse(responseText);

  const products = getCaseInsensitiveKey(responseJson, "products") || [];
  const rows = products.map((p) => [
    p.prod_id,
    p.raw_item_no,
    p.raw_description,
    p.canonical_item_no,
    p.category,
    p.product_class || "",
    p.model_line,
    p.notes || "",
  ]);

  if (rows.length > 0) {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID_INVOICE_DATA_EXPORT);
    ss.getSheetByName(SHEET_NAME_INVOICE_EXPORT_MASTER_PRODUCTS)
      .getRange(2, 1, rows.length, 8)
      .setValues(rows);
  }
}

/**
 * PASS 2: Batch Reconstruction of Invoices.
 */
function runBatchInvoiceExport(rawData) {
  const startTime = new Date().getTime();
  const maxRunTimeMs = 5.5 * 60 * 1000;
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID_INVOICE_DATA_EXPORT);
  const invoiceSheet = ss.getSheetByName(SHEET_NAME_INVOICE_EXPORT_INVOICES);

  const existingValues = invoiceSheet.getDataRange().getValues();
  const processedBaseIds = new Set(existingValues.map((r) => String(r[0])));

  // Group raw rows by Base ID, filtering for Date >= 2021-01-01.
  const groups = {};
  const dateLimit = new Date("2021-01-01");
  rawData.forEach((r) => {
    const invDate = new Date(r.date);
    if (invDate < dateLimit) return;

    const baseId = String(r.invoice_id_base);
    if (processedBaseIds.has(baseId)) return;

    if (!groups[baseId]) groups[baseId] = [];
    groups[baseId].push(r);
  });

  // Sort Base IDs descending (Newest first).
  const baseIds = Object.keys(groups).sort((a, b) =>
    b.localeCompare(a, undefined, { numeric: true, sensitivity: "base" }),
  );
  if (baseIds.length === 0) return;

  const glossaries = loadMasterGlossariesFromSheet();
  const BATCH_SIZE = 25;

  for (let i = 0; i < baseIds.length; i += BATCH_SIZE) {
    if (new Date().getTime() - startTime > maxRunTimeMs) break;

    const chunkIds = baseIds.slice(i, i + BATCH_SIZE);
    const chunkData = chunkIds.flatMap((id) => groups[id]);

    const systemPrompt = `Act as a Master Systems Architect. Reconstruct the "One True Ledger". 
DEDUPLICATION: Resolve which invoice version is the Winner.
REPAIRS: Keep associations for LABOR, PARTS, and TRAINING via "parent_description". 
Identify the "serviced_model_line" for any service or repair job.
COMPRESSION: Use IDs (cust_id, prod_id, origin_id).

Specifically regarding de-duplication:

GOAL: Reconstruct the "One True Ledger" to ensure 100% financial accuracy for reporting.
* Versioning Logic: Reconcile base IDs and suffixes (e.g., -A, -B). Treat them as Replacements if they correct or finalize a previous entry, but as Supplements if the line items represent additional charges.
* Unique Anchors: Use Purchase Orders and Serial Numbers as physical anchors. It is physically impossible to sell the same serial number twice; use this to spot administrative duplicates.
* Financial Integrity: Identify "Progress Billing" (deposits vs. final invoices) and collapse literal file copies to prevent revenue inflation.
* Mandate: Every row in the final export must represent a unique financial event or physical unit. Do not double-count revenue, but do not "over-merge" distinct transactions.

IMPORTANT: Over-merging at the invoice level is a major failure in the system!!! In general, there should be one output invoice per invoice_id_base value. If that's not exactly one-to-one, then probably you either undermerged or overmerged.

IMPORTANT: Over-merging at the line item level is a ALSO major failure!!! Be very careful not to over-merge line items. That will result in loss of sales in the reporting.

IMPORTANT: Most of the time, you will choose one complete "winner" among the eligible invoices. On the rare occasion that you somehow mix from multiple, the value should be the word MERGED followed by a pipe separated of all the invoices merged from. Pipe character is |.

METADATA: If PO, Salesperson, Terms, or Shipped Via are missing, return "". DO NOT use "NOT_SPECIFIED" or similar placeholders.
FEES: Treat Credit Card Fees as line items in the "line_items" array.

CRITICAL: You are a data pipe. Output ONLY raw JSON. No preamble, no markdown backticks, and no concluding text. 
Everything you wish to report MUST be a string value inside the JSON keys.

RETURN ONLY JSON IN THIS SCHEMA:
{
  "winning_invoices": [
    {
      "invoice_id_full": "string",
      "invoice_id_base": "string",
      "iso_date": "string",
      "origin_id": "string",
      "cust_id": "string",
      "sold_to_attn": "string",
      "ship_to_resolved": "string",
      "ship_to_attn": "string",
      "metadata": {
        "po": "string",
        "salesperson": "string",
        "terms": "string",
        "shipped_via": "string",
        "fob": "string"
      },
      "financials": {
        "printed_subtotal": 0,
        "calculated_item_total": 0,
        "tax": 0,
        "shipping": 0,
        "cc_fees": 0,
        "intl_fees": 0,
        "discount_line": 0,
        "discount_invoice": 0,
        "total": 0,
        "currency": "string"
      },
      "line_items": [
        {
          "qty": 0,
          "prod_id": "string",
          "extended_total": 0,
          "parent_description": "string",
          "sub_details": "string",
          "serviced_model_line": "string"
        }
      ],
      "audit": {
        "level": "NONE|MINOR|MAJOR|SEVERE",
        "notes": "string",
        "math_check": "string"
      }
    }
  ],
  "architect_insights": "string"
}
`;

    const combinedPayload = {
      glossary_context: glossaries,
      invoice_log_segment: chunkData,
    };
    const responseText = callGeminiSimple(
      systemPrompt,
      JSON.stringify(combinedPayload),
      `Batch: ${chunkIds.length} IDs`,
    );
    const winners =
      getCaseInsensitiveKey(JSON.parse(responseText), "winning_invoices") || [];

    writeRelationalTablesAppend(winners, glossaries);
    SpreadsheetApp.flush();
  }
}

/**
 * ATOMIC LOAD (APPEND MODE).
 */
function writeRelationalTablesAppend(winningInvoices, glossaries) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID_INVOICE_DATA_EXPORT);
  const invoiceRows = [];
  const itemRows = [];
  const flatRows = [];

  winningInvoices.forEach((inv) => {
    const cust = glossaries.customers[inv.cust_id] || {};
    const orig = glossaries.origins[inv.origin_id] || {};

    invoiceRows.push([
      inv.invoice_id_base,
      inv.invoice_id_full,
      inv.iso_date,
      orig.name || "",
      cust.name || "UNMAPPED",
      cust.parent || "",
      inv.sold_to_attn || "",
      inv.ship_to_resolved || "",
      inv.ship_to_attn || "",
      cust.industry || "",
      cust.region || "",
      inv.metadata ? inv.metadata.po : "",
      inv.metadata ? inv.metadata.salesperson : "",
      inv.metadata ? inv.metadata.terms : "",
      inv.metadata ? inv.metadata.shipped_via : "",
      inv.metadata ? inv.metadata.fob : "",
      inv.financials.printed_subtotal,
      inv.financials.calculated_item_total,
      inv.financials.tax,
      inv.financials.shipping,
      inv.financials.cc_fees,
      inv.financials.intl_fees,
      inv.financials.discount_line,
      inv.financials.discount_invoice,
      inv.financials.total,
      inv.financials.currency || "USD",
      inv.audit ? inv.audit.level : "NONE",
      inv.audit ? inv.audit.math_check : "",
    ]);

    inv.line_items.forEach((item) => {
      const prod = glossaries.products[item.prod_id] || {};
      const unit = item.qty > 0 ? item.extended_total / item.qty : 0;

      itemRows.push([
        inv.invoice_id_base,
        item.qty,
        prod.item_no || "UNKNOWN",
        prod.desc || "UNKNOWN",
        unit,
        item.extended_total,
        prod.cat || "",
        prod.cls || "",
        item.serviced_model_line || prod.line || "",
        item.parent_description || "",
        item.sub_details || "",
      ]);

      flatRows.push([
        inv.invoice_id_base,
        inv.invoice_id_full,
        inv.iso_date,
        cust.name || "UNMAPPED",
        cust.parent || "",
        cust.industry || "",
        cust.region || "",
        item.qty,
        prod.item_no || "UNKNOWN",
        prod.desc || "UNKNOWN",
        unit,
        item.extended_total,
        prod.cat || "",
        prod.cls || "",
        item.serviced_model_line || prod.line || "",
        item.parent_description || "",
        item.sub_details || "",
        inv.financials.total,
        inv.audit ? inv.audit.level : "NONE",
      ]);
    });
  });

  const appendToSheet = (name, rows) => {
    if (rows.length > 0) {
      const s = ss.getSheetByName(name);
      s.getRange(s.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(
        rows,
      );
    }
  };

  appendToSheet(SHEET_NAME_INVOICE_EXPORT_INVOICES, invoiceRows);
  appendToSheet(SHEET_NAME_INVOICE_EXPORT_ITEMS, itemRows);
  appendToSheet(SHEET_NAME_INVOICE_EXPORT_FLAT, flatRows);
}

/**
 * HELPER: Loads Master Glossaries from sheets.
 */
function loadMasterGlossariesFromSheet() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID_INVOICE_DATA_EXPORT);
  const origData = ss
    .getSheetByName(SHEET_NAME_INVOICE_EXPORT_MASTER_ORIGINS)
    .getDataRange()
    .getValues();
  const custData = ss
    .getSheetByName(SHEET_NAME_INVOICE_EXPORT_MASTER_CUSTOMERS)
    .getDataRange()
    .getValues();
  const prodData = ss
    .getSheetByName(SHEET_NAME_INVOICE_EXPORT_MASTER_PRODUCTS)
    .getDataRange()
    .getValues();

  origData.shift();
  custData.shift();
  prodData.shift();

  const glossaries = { origins: {}, customers: {}, products: {} };
  origData.forEach((r) => {
    if (r[0]) glossaries.origins[r[0]] = { name: r[2], raw: r[1] };
  });
  custData.forEach((r) => {
    if (r[0])
      glossaries.customers[r[0]] = {
        name: r[1],
        parent: r[2],
        industry: r[7],
        region: r[6],
        aliases: r[9],
      };
  });
  prodData.forEach((r) => {
    if (r[0])
      glossaries.products[r[0]] = {
        item_no: r[3],
        desc: r[2],
        cat: r[4],
        cls: r[5],
        line: r[6],
      };
  });

  return glossaries;
}

/**
 * Ensures target tabs exist with headers.
 */
function setupExportTabs() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID_INVOICE_DATA_EXPORT);
  const tabs = [
    {
      name: SHEET_NAME_INVOICE_EXPORT_INVOICES,
      headers: [
        "Invoice ID Base",
        "Invoice ID Full",
        "ISO Date",
        "Origin Address",
        "Sold To Canonical",
        "Parent Company",
        "Sold To Attn",
        "Ship To Resolved",
        "Ship To Attn",
        "Customer Segment",
        "Region",
        "PO #",
        "Salesperson",
        "Terms",
        "Shipped Via",
        "FOB",
        "Printed Subtotal",
        "Calculated Item Total",
        "Tax",
        "Shipping",
        "CC Fees",
        "Intl Fees",
        "Discount Line",
        "Discount Invoice",
        "Grand Total",
        "Currency",
        "Inconsistency Level",
        "Math Check",
      ],
    },
    {
      name: SHEET_NAME_INVOICE_EXPORT_ITEMS,
      headers: [
        "Invoice ID Base",
        "Qty",
        "Item # Canonical",
        "Description",
        "Unit Cost",
        "Extended Total",
        "Product Category",
        "Product Class",
        "Product Line",
        "Parent Group",
        "Sub-Details",
      ],
    },
    {
      name: SHEET_NAME_INVOICE_EXPORT_FLAT,
      headers: [
        "Invoice ID Base",
        "Invoice ID Full",
        "ISO Date",
        "Sold To Canonical",
        "Parent Company",
        "Customer Segment",
        "Region",
        "Qty",
        "Item # Canonical",
        "Description",
        "Unit Cost",
        "Extended Total",
        "Product Category",
        "Product Class",
        "Product Line",
        "Parent Group",
        "Sub-Details",
        "Grand Total",
        "Inconsistency Level",
      ],
    },
    {
      name: SHEET_NAME_INVOICE_EXPORT_MASTER_CUSTOMERS,
      headers: [
        "ID",
        "Canonical Name",
        "Parent Company",
        "Ultimate End User",
        "Country",
        "State",
        "US Region",
        "Industry Segment",
        "Entity Type",
        "Address Aliases (Audit)",
      ],
    },
    {
      name: SHEET_NAME_INVOICE_EXPORT_MASTER_ORIGINS,
      headers: [
        "ID",
        "Raw Address",
        "Standardized Address",
        "City",
        "State",
        "ZIP",
      ],
    },
    {
      name: SHEET_NAME_INVOICE_EXPORT_MASTER_PRODUCTS,
      headers: [
        "ID",
        "Item # Raw",
        "Description Raw",
        "Canonical Item #",
        "Category",
        "Product Class",
        "Product Line",
        "Notes",
      ],
    },
  ];

  tabs.forEach((tab) => {
    let sheet = ss.getSheetByName(tab.name);
    if (!sheet) sheet = ss.insertSheet(tab.name);
    sheet.clear();
    sheet
      .getRange(1, 1, 1, tab.headers.length)
      .setValues([tab.headers])
      .setFontWeight("bold");
    sheet.setFrozenRows(1);
  });
}

/**
 * Ingests raw structured extraction data.
 */
function ingestRawExtractionData() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID_INVOICE_DATA_EXTRACTION);
  const sheet = ss.getSheetByName(SHEET_NAME_INVOICE_EXTRACTION_STRUCTURED);
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();

  return data.map((row) => {
    let obj = {};
    const essentials = [
      "Invoice ID Base",
      "Invoice ID Full",
      "Date",
      "Sold To",
      "Item #",
      "Description",
      "Unit Cost",
      "Extended Total",
      "Line Category",
      "Parent Desc",
      "Sub-Details",
      "Mod Date",
      "Origin Address",
    ];
    headers.forEach((h, i) => {
      if (essentials.includes(h))
        obj[h.replace(/\s+/g, "_").replace(/#/g, "no").toLowerCase()] = row[i];
    });
    return obj;
  });
}

/**
 * Optimized Gemini call.
 */
function callGeminiSimple(systemPrompt, userContent, summaryLogText) {
  const payload = {
    contents: [{ parts: [{ text: systemPrompt }, { text: userContent }] }],
    generationConfig: {
      response_mime_type: "application/json",
      max_output_tokens: 65536,
    },
  };
  console.log(`--- [DEBUG] AI REQUEST: ${summaryLogText} ---`);
  const response = UrlFetchApp.fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL_ID}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    },
  );
  const resultText = response.getContentText();
  if (JSON.parse(resultText).candidates) {
    const rawText = JSON.parse(resultText).candidates[0].content.parts[0].text;
    const start = rawText.indexOf("{");
    const end = rawText.lastIndexOf("}");
    const jsonString =
      start !== -1 && end !== -1 ? rawText.substring(start, end + 1) : rawText;
    return jsonString.replace(/,\s*([\]}])/g, "$1");
  } else throw new Error("Gemini failed: " + resultText);
}

/**
 * Case-insensitive key helper.
 */
function getCaseInsensitiveKey(obj, targetKey) {
  if (!obj) return null;
  const key = Object.keys(obj).find(
    (k) => k.toLowerCase() === targetKey.toLowerCase(),
  );
  return key ? obj[key] : null;
}

/**
 * Chunked logger.
 */
function logInChunks(text) {
  const chunkSize = 4000;
  for (let i = 0; i < text.length; i += chunkSize)
    console.log(text.substring(i, i + chunkSize));
}

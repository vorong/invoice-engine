/**
 * Project: Invoice Data Extraction
 * File: InvoiceExtraction.gs
 * Description: AI orchestrator to extract structured JSON from Hybrid Doc views.
 */

/**
 * Ensures the INVOICE_DATA sheet exists and has the correct flattened headers.
 */
function setupInvoiceDataSheet() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID_INVOICE_DATA_EXTRACTION);
  let dataSheet = ss.getSheetByName(SHEET_NAME_INVOICE_EXTRACTION_STRUCTURED);

  if (!dataSheet) {
    dataSheet = ss.insertSheet(SHEET_NAME_INVOICE_EXTRACTION_STRUCTURED);
  } else {
    dataSheet.clear();
  }

  const headers = [
    "Source File",
    "Mod Date",
    "Invoice ID Full",
    "Invoice ID Base",
    "Date",
    "Origin Address",
    "Sold To",
    "Sold To Attn",
    "Ship To Raw",
    "Ship To Resolved",
    "Ship To Attn",
    "PO #",
    "Salesperson",
    "Terms",
    "Shipped Via",
    "FOB",
    "Qty",
    "Item #",
    "Description",
    "Unit Cost",
    "Extended Total",
    "Line Category",
    "Parent Desc",
    "Sub-Details",
    "Rental Period",
    "Subtotal",
    "Tax",
    "Shipping",
    "CC Fees",
    "Intl Fees",
    "Discount Line",
    "Discount Invoice",
    "Grand Total",
    "Currency",
    "Invoice Type",
    "Inconsistency Level",
    "Inconsistency Notes",
    "Math Check",
  ];

  dataSheet
    .getRange(1, 1, 1, headers.length)
    .setValues([headers])
    .setFontWeight("bold");
  dataSheet.setFrozenRows(1);
}

/**
 * Runs for 4.25 minutes, collecting extractions and saving them to Column I.
 */
function runBatchExtraction() {
  const startTime = new Date().getTime();
  const maxRunTimeMs = 4.25 * 60 * 1000; // 5 minutes 15 seconds

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID_INVOICE_DATA_EXTRACTION);
  const registrySheet = ss.getSheetByName(SHEET_NAME_FILE_REGISTRY);
  const dataSheet = ss.getSheetByName(SHEET_NAME_INVOICE_EXTRACTION_STRUCTURED);
  const data = registrySheet.getDataRange().getValues();

  let processedCount = 0;

  console.log("--- [START] BATCH EXTRACTION RUN ---");

  for (let i = 1; i < data.length; i++) {
    // 1. Time Check
    const currentTime = new Date().getTime();
    if (currentTime - startTime > maxRunTimeMs) {
      console.log("Time limit reached. Stopping batch.");
      break;
    }

    // 2. Batch Limit Check
    if (processedCount >= BATCH_SIZE_INVOICE_EXTRACTION) break;

    // 3. Process only converted files that haven't been extracted yet
    const status = data[i][COLUMN_NUMBER_FILE_REGISTRY_CONVERSION_STATUS - 1];
    const extractionStatus =
      data[i][COLUMN_NUMBER_FILE_REGISTRY_EXTRACTION_STATUS - 1];

    if (status === "SUCCEEDED" && extractionStatus !== "SUCCEEDED") {
      const rowNum = i + 1;
      const fileData = {
        fileName: data[i][1],
        modDate: data[i][2],
        gDocId: data[i][COLUMN_NUMBER_FILE_REGISTRY_GDOC_ID - 1],
        pdfId: data[i][COLUMN_NUMBER_FILE_REGISTRY_PDF_ID - 1],
      };

      try {
        console.log(
          `\nProcessing [${processedCount + 1}]: ${fileData.fileName}`,
        );
        registrySheet
          .getRange(rowNum, COLUMN_NUMBER_FILE_REGISTRY_EXTRACTION_STATUS)
          .setValue("STARTED");
        SpreadsheetApp.flush();

        const json = performSingleGeminiExtraction(fileData);

        // Flatten JSON Line Items into individual spreadsheet rows
        const flatRows = json.line_items.map((item) => [
          fileData.fileName,
          fileData.modDate,
          json.invoice_identity.invoice_id_full,
          json.invoice_identity.invoice_id_base,
          json.invoice_identity.date,
          json.invoice_identity.origin_address,
          json.billing_and_shipping.sold_to,
          json.billing_and_shipping.sold_to_attn,
          json.billing_and_shipping.ship_to_raw,
          json.billing_and_shipping.ship_to,
          json.billing_and_shipping.ship_to_attn,
          json.order_metadata.po_number,
          json.order_metadata.salesperson,
          json.order_metadata.terms,
          json.order_metadata.shipped_via,
          json.order_metadata.fob,
          item.qty,
          item.item_no,
          item.description,
          item.unit_cost,
          item.extended_total,
          item.line_category,
          item.parent_description,
          item.sub_details,
          item.rental_period,
          json.financials.subtotal,
          json.financials.tax,
          json.financials.shipping,
          json.financials.cc_fees,
          json.financials.intl_doc_fees,
          json.financials.discount_line,
          json.financials.discount_invoice,
          json.financials.total_amount,
          json.financials.currency,
          json.audit.invoice_type,
          json.audit.inconsistency_level,
          json.audit.inconsistency_notes,
          json.audit.math_check,
        ]);

        if (flatRows.length > 0) {
          dataSheet
            .getRange(
              dataSheet.getLastRow() + 1,
              1,
              flatRows.length,
              flatRows[0].length,
            )
            .setValues(flatRows);
        }

        registrySheet
          .getRange(rowNum, COLUMN_NUMBER_FILE_REGISTRY_EXTRACTION_STATUS)
          .setValue("SUCCEEDED");
        processedCount++;

        // Write out to Google sheets immediately
        SpreadsheetApp.flush();

        // Short pause between successful files to respect RPM limits
        Utilities.sleep(1000);
      } catch (e) {
        console.error(
          `Failed extraction for ${fileData.fileName}: ${e.toString()}`,
        );
        registrySheet
          .getRange(rowNum, COLUMN_NUMBER_FILE_REGISTRY_EXTRACTION_STATUS)
          .setValue("FAILED");
        SpreadsheetApp.flush();
      }
    }
  }

  console.log(`Batch complete. Analyzed ${processedCount} files.`);
}

/**
 * CORE LOGIC: Calls Gemini API for a single file.
 * Includes strict schema, verbose logging, and intelligent 429/503 retries.
 */
function performSingleGeminiExtraction(fileData) {
  // 1. Prepare Semantic View (Text)
  const structuredText = getDocStructureAsText(fileData.gDocId);

  // RESTORED: Intermediate logging of the input for debugging
  console.log(
    `--- [DEBUG] DATA SENT TO GEMINI (File: ${fileData.fileName}) ---`,
  );
  console.log("TEXT VIEW:\n" + structuredText);

  // 2. Prepare Visual View (PDF)
  const pdfBase64 = getPdfBase64(fileData.pdfId);

  // 3. Construct Prompt with FORENSIC ACCOUNTING LOGIC
  const prompt = `Act as a forensic accounting parser. I am providing a digital text representation and a visual PDF of the same invoice. 
Extract every piece of metadata into an expanded JSON format following these STRICT business rules:

1. IDENTITY:
   - "invoice_id_full": Exactly as written.
   - "invoice_id_base": Numeric core only (strip suffixes like "- A").
   - "origin_address": Full address from the header logical block.

2. ADDRESS AND CONTACT RESOLUTION:
   - "sold_to": The billing address found in the "Sold To" address block.
   - "sold_to_attn": Extract the contact name from "Attn:" or "Attention:" lines within the "Sold To" address block. Be flexible with labels.
   - "ship_to_raw": Exactly what is written in the shipping area (e.g. "SAME").
   - "ship_to": If ship_to_raw is "SAME", copy the sold_to address here. Otherwise, extract the address from the "Ship To" address block.
   - "ship_to_attn": Extract the contact name from "Attn:" or "Attention:" lines within the "Ship To" address block. Be flexible with labels.

3. LINE ITEM HIERARCHY:
   - "Repair/Rebuild": If a row has a description but no price, treat it as a Parent. Link following "Parts" or "Labor" rows as children via "parent_description".
   - "Rental": Extract period (weeks/days) into a "rental_period" field.
   - "Back-Calculate": If "unit_cost" is blank but "extended_total" exists, calculate (extended_total / qty).
   - "Sub-Details": Attach serial numbers (S/N) or notes to the "sub_details" field of the line item.
   - IGNORE rows containing only "THANK YOU".

4. GLOBAL FINANCIALS:
   - Sink mid-table fees (Tax, CC Fee, Shipping, Intl Doc Fees) into global financial fields.
   - Distinguish line discounts from invoice-wide discounts.

5. AUDIT & CONSISTENCY:
   - "inconsistency_level": NONE, MINOR, MAJOR, or SEVERE.
   - "inconsistency_notes": Detailed explanation of math errors or missing critical IDs.

RETURN ONLY FULLY EXPANDED JSON IN THIS SCHEMA:
{
  "invoice_identity": {
    "invoice_id_full": "string",
    "invoice_id_base": "string",
    "date": "string",
    "origin_address": "string"
  },
  "billing_and_shipping": {
    "sold_to": "string",
    "sold_to_attn": "string",
    "ship_to_raw": "string",
    "ship_to": "string",
    "ship_to_attn": "string"
  },
  "order_metadata": {
    "po_number": "string",
    "salesperson": "string",
    "terms": "string",
    "shipped_via": "string",
    "fob": "string"
  },
  "line_items": [
    {
      "qty": "number",
      "item_no": "string",
      "description": "string",
      "unit_cost": "number",
      "extended_total": "number",
      "line_category": "string",
      "parent_description": "string",
      "sub_details": "string",
      "rental_period": "string"
    }
  ],
  "financials": {
    "subtotal": "number",
    "tax": "number",
    "shipping": "number",
    "cc_fees": "number",
    "intl_doc_fees": "number",
    "discount_line": "number",
    "discount_invoice": "number",
    "total_amount": "number",
    "currency": "string"
  },
  "audit": {
    "invoice_type": "string",
    "inconsistency_level": "string",
    "inconsistency_notes": "string",
    "math_check": "string"
  }
}`;

  // 4. Build Payload
  const payload = {
    contents: [
      {
        parts: [
          { text: "INVOICE STRUCTURED TEXT VIEW:\n" + structuredText },
          {
            inline_data: {
              mime_type: "application/pdf",
              data: pdfBase64,
            },
          },
          { text: prompt },
        ],
      },
    ],
    generationConfig: {
      response_mime_type: "application/json",
    },
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL_ID}:generateContent?key=${GEMINI_API_KEY}`;
  const options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  let response;
  let attempt = 0;
  const maxAttempts = 3;

  while (attempt < maxAttempts) {
    response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    const responseBody = response.getContentText();

    // RESTORED: Verbose logging of every attempt
    console.log(
      `--- [DEBUG] API ATTEMPT (Code: ${responseCode}, File: ${fileData.fileName}) ---`,
    );
    console.log(responseBody);

    if (responseCode === 200) {
      const result = JSON.parse(responseBody);
      if (result.candidates && result.candidates[0].content.parts[0].text) {
        return JSON.parse(result.candidates[0].content.parts[0].text);
      } else {
        throw new Error("API returned 200 but content was empty.");
      }
    } else if (responseCode === 429 || responseCode === 503) {
      attempt++;
      if (attempt >= maxAttempts)
        throw new Error(`Max retries reached for ${fileData.fileName}`);

      let waitTimeMs = attempt * 5000; // Fallback

      // Parse specific retry delay if provided (standard for 429s)
      try {
        const errorData = JSON.parse(responseBody);
        const retryInfo = errorData.error.details.find(
          (d) => d["@type"] && d["@type"].includes("RetryInfo"),
        );
        if (retryInfo && retryInfo.retryDelay) {
          waitTimeMs = parseFloat(retryInfo.retryDelay) * 1000 + 2000;
        }
      } catch (e) {
        console.warn(
          "Could not parse specific retry delay, using fallback backoff.",
        );
      }

      console.warn(
        `Retry ${attempt}/${maxAttempts} in ${waitTimeMs / 1000}s...`,
      );
      Utilities.sleep(waitTimeMs);
    } else {
      throw new Error(`API Error ${responseCode}: ${responseBody}`);
    }
  }
}

/**
 * HELPER: Build a string-based structural representation of the GDoc.
 * Puts table rows on new lines and wraps cells in [ ].
 */
function getDocStructureAsText(docId) {
  const doc = DocumentApp.openById(docId);
  let fullText = "";

  const sections = [doc.getHeader(), doc.getBody(), doc.getFooter()];

  sections.forEach((container) => {
    if (!container) return;

    for (let i = 0; i < container.getNumChildren(); i++) {
      const child = container.getChild(i);
      const type = child.getType();

      if (type === DocumentApp.ElementType.PARAGRAPH) {
        const pText = child.asParagraph().getText().trim();
        if (pText) fullText += pText + "\n";
      } else if (type === DocumentApp.ElementType.TABLE) {
        const table = child.asTable();
        fullText += "\n--- TABLE START ---\n";
        for (let r = 0; r < table.getNumRows(); r++) {
          let rowStr = "";
          for (let c = 0; c < table.getRow(r).getNumCells(); c++) {
            rowStr += `[ ${table.getRow(r).getCell(c).getText().trim() || "EMPTY"} ] `;
          }
          fullText += rowStr + "\n"; // New line for every table row
        }
        fullText += "--- TABLE END ---\n\n";
      }
    }
  });

  return fullText;
}

/**
 * HELPER: Fetch PDF and convert to Base64 string for API.
 */
function getPdfBase64(pdfId) {
  const file = DriveApp.getFileById(pdfId);
  const blob = file.getBlob();
  return Utilities.base64Encode(blob.getBytes());
}

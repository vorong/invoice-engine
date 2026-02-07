/**
 * Project: Invoice Data Extraction
 * File: Diagnostics.gs
 * Description: Debugging tools and one-off tests for document inspection.
 */

function debugReadHtmlOutput() {
  const folder = DriveApp.getFolderById(FOLDER_ID_INVOICE_CONVERTED_HTML);
  const files = folder.getFiles(); 
  let count = 0;
  console.log('--- START HTML DIAGNOSTIC ---');
  while (files.hasNext() && count < BATCH_SIZE_READ_CONVERTED_TEXT) {
    const file = files.next();
    if (file.getMimeType() === "text/html") {
      console.log(`\n--- FILE: ${file.getName()} ---\n${file.getBlob().getDataAsString()}`); 
      count++;
    }
  }
}

function debugReadConvertedText() {
  const folder = DriveApp.getFolderById(FOLDER_ID_INVOICE_CONVERTED_GDOC);
  const files = folder.getFilesByType(MimeType.GOOGLE_DOCS);
  let count = 0;
  console.log('--- START SIMPLE TEXT DIAGNOSTIC ---');
  while (files.hasNext() && count < BATCH_SIZE_READ_CONVERTED_TEXT) {
    const file = files.next();
    try {
      console.log(`\n--- FILE: ${file.getName()} ---\n${DocumentApp.openById(file.getId()).getBody().getText()}`);
    } catch (e) { console.error(`Error: ${e.toString()}`); }
    count++;
  }
}

function debugReadStructuralText() {
  const folder = DriveApp.getFolderById(FOLDER_ID_INVOICE_CONVERTED_GDOC);
  const files = folder.getFilesByType(MimeType.GOOGLE_DOCS);
  let count = 0;
  while (files.hasNext() && count < BATCH_SIZE_READ_CONVERTED_TEXT) {
    const file = files.next();
    const doc = DocumentApp.openById(file.getId());
    console.log(`\n=== FILE: ${file.getName()} ===`);
    if (doc.getHeader()) processContainer(doc.getHeader());
    if (doc.getBody()) processContainer(doc.getBody());
    if (doc.getFooter()) processContainer(doc.getFooter());
    count++;
  }
}

function processContainer(container) {
  for (let i = 0; i < container.getNumChildren(); i++) {
    const child = container.getChild(i);
    const type = child.getType();
    if (type === DocumentApp.ElementType.PARAGRAPH) {
      const p = child.asParagraph();
      let hasDrawing = false;
      for (let j = 0; j < p.getNumChildren(); j++) {
        if (p.getChild(j).getType() === DocumentApp.ElementType.INLINE_DRAWING) hasDrawing = true;
      }
      console.log(`${hasDrawing ? '[DRAWING] ' : ''}${p.getText()}`);
    } else if (type === DocumentApp.ElementType.TABLE) {
      const table = child.asTable();
      for (let r = 0; r < table.getNumRows(); r++) {
        let row = "";
        for (let c = 0; c < table.getRow(r).getNumCells(); c++) {
          row += `[ ${table.getRow(r).getCell(c).getText()} ] `;
        }
        console.log(row);
      }
    }
  }
}

function debugReadAdvancedJsonStructure() {
  const folder = DriveApp.getFolderById(FOLDER_ID_INVOICE_CONVERTED_GDOC);
  const files = folder.getFilesByType(MimeType.GOOGLE_DOCS);
  let count = 0;
  while (files.hasNext() && count < BATCH_SIZE_READ_CONVERTED_TEXT) {
    const file = files.next();
    try {
      const doc = Docs.Documents.get(file.getId());
      const res = [];
      recursiveTextSearch(doc, res);
      console.log(`\n=== FILE: ${file.getName()} ===\n${res.join("")}`);
    } catch (e) { console.error(e.toString()); }
    count++;
  }
}

function recursiveTextSearch(obj, results) {
  if (obj && obj.textRun && obj.textRun.content) results.push(obj.textRun.content);
  if (Array.isArray(obj)) obj.forEach(i => recursiveTextSearch(i, results));
  else if (typeof obj === 'object' && obj !== null) {
    for (let key in obj) if (obj.hasOwnProperty(key)) recursiveTextSearch(obj[key], results);
  }
}

function debugReadExportedPlainText() {
  const folder = DriveApp.getFolderById(FOLDER_ID_INVOICE_CONVERTED_GDOC);
  const files = folder.getFilesByType(MimeType.GOOGLE_DOCS);
  let count = 0;
  while (files.hasNext() && count < BATCH_SIZE_READ_CONVERTED_TEXT) {
    const file = files.next();
    try {
      const exportBlob = Drive.Files.export(file.getId(), 'text/plain', {alt: 'media'});
      console.log(`\n=== FILE: ${file.getName()} ===\n${exportBlob.getDataAsString()}`);
    } catch (e) { console.error(e.toString()); }
    count++;
  }
}

/**
 * Fetches a single file, builds the hybrid view, and tests Gemini extraction.
 * Includes verbose logging of raw inputs and outputs.
 */
function testSingleExtraction() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID_INVOICE_DATA_EXTRACTION);
  const sheet = ss.getSheetByName(SHEET_NAME_FILE_REGISTRY);
  const data = sheet.getDataRange().getValues();
  
  // Find the first row that is SUCCEEDED in conversion
  let targetRow = null;
  for (let i = 1; i < data.length; i++) {
    if (data[i][COLUMN_NUMBER_FILE_REGISTRY_CONVERSION_STATUS - 1] === "SUCCEEDED") {
      targetRow = {
        index: i + 1,
        fileName: data[i][1],
        gDocId: data[i][COLUMN_NUMBER_FILE_REGISTRY_GDOC_ID - 1],
        pdfId: data[i][COLUMN_NUMBER_FILE_REGISTRY_PDF_ID - 1]
      };
      break;
    }
  }

  if (!targetRow) {
    console.log("No converted files found to test.");
    return;
  }

  console.log(`\n--- [START] AI EXTRACTION TEST: ${targetRow.fileName} ---`);

  try {
    // 1. Prepare Semantic View (Text)
    const structuredText = getDocStructureAsText(targetRow.gDocId);
    console.log("--- [DEBUG] RAW SEMANTIC TEXT VIEW ---");
    console.log(structuredText);
    
    // 2. Prepare Visual View (PDF)
    const pdfBase64 = getPdfBase64(targetRow.pdfId);
    console.log(`--- [DEBUG] PDF PREPARED (Base64 length: ${pdfBase64.length}) ---`);

    // 3. Construct the Exploratory Prompt
    const prompt = "I am providing a digital text representation and a visual PDF of the same invoice. " +
                   "Please perform a deep analysis of both. Extract every piece of metadata you can find " +
                   "(Vendor, Dates, Totals, Line Items, Tax, etc.) and return it in a structured JSON format. " +
                   "Crucial: Ensure you find the Invoice Number, which may only be visible in the PDF drawing layer.";
    
    console.log("--- [DEBUG] RAW PROMPT ---");
    console.log(prompt);

    // 4. Build Payload
    const payload = {
      contents: [{
        parts: [
          { text: "INVOICE STRUCTURED TEXT VIEW:\n" + structuredText },
          {
            inline_data: {
              mime_type: "application/pdf",
              data: pdfBase64
            }
          },
          { text: prompt }
        ]
      }],
      generationConfig: {
        response_mime_type: "application/json"
      }
    };

    // 5. Call API
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL_ID}:generateContent?key=${GEMINI_API_KEY}`;
    const options = {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    console.log("--- [DEBUG] SENDING REQUEST TO GEMINI API ---");
    const response = UrlFetchApp.fetch(url, options);
    const responseBody = response.getContentText();
    
    console.log("--- [DEBUG] RAW RESPONSE FROM API ---");
    console.log(responseBody);

    const result = JSON.parse(responseBody);

    if (result.candidates && result.candidates[0].content.parts[0].text) {
      const extractedJson = result.candidates[0].content.parts[0].text;
      
      console.log("--- [SUCCESS] PARSED AI EXTRACTION JSON ---");
      console.log(extractedJson);
      
      // Basic Validation Check for Log
      const jsonParsed = JSON.parse(extractedJson);
      // Attempt to find invoice number regardless of how Gemini named the key
      const keys = Object.keys(jsonParsed);
      let foundInv = "NOT FOUND";
      keys.forEach(key => {
        if (key.toLowerCase().includes("invoice") && (key.toLowerCase().includes("no") || key.toLowerCase().includes("number"))) {
          foundInv = jsonParsed[key];
        }
      });
      
      console.log(`\n[FINAL VALIDATION] Detected Invoice Number: ${foundInv}`);

    } else {
      console.error("API Error or No Content Returned. Response Code:", response.getResponseCode());
    }

  } catch (e) {
    console.error(`Extraction Test Failed: ${e.toString()}`);
  }
  console.log(`--- [END] EXTRACTION TEST ---\n`);
}

/**
 * Senior Data Governance Audit.
 * Provides the COMPLETE extracted dataset to Gemini to identify deduplication signals and reporting categories.
 * Goal: Architect a logic for a clean executive dashboard that avoids all forms of double-counting.
 */
function debugAuditReportingReadiness() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID_INVOICE_DATA_EXTRACTION);
  const sheet = ss.getSheetByName(SHEET_NAME_INVOICE_EXTRACTION_STRUCTURED);
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  
  // Convert the entire dataset into an array of objects.
  const fullDataset = data.map(
    row => {
      let obj = {};
      headers.forEach(
        (h, i) => {
          obj[h] = row[i];
        }
      );
      return obj;
    }
  );

  console.log("--- [START] DATA GOVERNANCE AUDIT ---");
  console.log(`Sending the complete dataset (${fullDataset.length} rows) for architectural analysis.`);

  const prompt = `Act as a Senior Data Governance Architect and Business Intelligence Lead.
I have provided the COMPLETE log of extracted invoice data from 2021 to the present. 
My goal is to build a clean, reliable reporting dashboard (e.g., Sales by Model Type, Revenue by Region).

CHALLENGE: 
The data contains potential double-counting due to version suffixes (-A, -B), packing lists (-PL), manual file copies, and evolving business naming conventions.

TASK:
1. INTERNAL LINKAGE: Based on the data, what is the definitive logic for identifying if one row is a REPLACEMENT of another vs. a SUPPLEMENT to another? Look for signals in IDs, POs, and line items.
2. DEDUPLICATION: Identify specific instances in this full set where summing the totals would result in false revenue numbers. 
3. PRODUCT STANDARDIZATION: Suggest a "Canonical Model" list based on the messy descriptions (e.g., how to group variations of Model 20, 210, etc).
4. REPORTING SCHEMA: Propose the logic for a "Final Export" that ensures 100% financial accuracy for line-item and invoice-level reporting.
5. INNOVATIVE DEDUPLICATION & CLEANLINESS: Provide specific, creative ideas for how to programmatically ensure we are not double-counting revenue. If you were building a logic to identify the "Master Record" for a transaction, what multi-factor signals would you look for beyond just the ID suffix? How can we ensure the cleanest possible data for a final export?

DATA (FULL EXTRACTION LOG):
${JSON.stringify(fullDataset, null, 2)}`;

  try {
    const payload = {
      contents: [
        { 
          parts: [
            { text: prompt }
          ] 
        }
      ]
    };
    
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL_ID}:generateContent?key=${GEMINI_API_KEY}`;
    const options = {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(url, options);
    const result = JSON.parse(response.getContentText());
    
    if (result.candidates && result.candidates[0].content.parts[0].text) {
      const report = result.candidates[0].content.parts[0].text;
      
      console.log("\n--- AI ARCHITECT REPORT START ---");
      logInChunks(report);
      console.log("--- AI ARCHITECT REPORT END ---");
      
    } else {
      console.error("Audit failed:", response.getContentText());
    }
  } catch (e) {
    console.error(`Audit Error: ${e.toString()}`);
  }
}

/**
 * Helper: Splits long strings into chunks for the console log to avoid truncation.
 */
function logInChunks(text) {
  const chunkSize = 4000;
  for (let i = 0; i < text.length; i += chunkSize) {
    console.log(text.substring(i, i + chunkSize));
  }
}

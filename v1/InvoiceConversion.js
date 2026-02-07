/**
 * Project: Invoice Data Extraction
 * File: InvoiceConversion.gs
 * Description: Logic to convert Word (.doc) files to GDoc, HTML, and PDF formats.
 */

const MIME_TYPE_DOC = 'application/msword';
const MIME_TYPE_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/**
 * Creates/Resets the registry of all files to track processing status.
 */
function createRegistry() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID_INVOICE_DATA_EXTRACTION);
  const sheet = ss.getSheetByName(SHEET_NAME_FILE_REGISTRY);
  
  sheet.clearContents();
  const headers = [
    "Position",
    "File Name",
    "Modified Date",
    "Original File ID",
    "Conversion Status",
    "Converted File ID (GDOC)",
    "Converted File ID (HTML)",
    "Converted File ID (PDF)",
    "Extraction Status"
  ];
  sheet.appendRow(headers);
 
  console.log("Scanning source folder...");
  const folder = DriveApp.getFolderById(FOLDER_ID_INVOICE_SOURCE);
  const files = folder.getFiles();
  const results = [];
  
  while (files.hasNext()) {
    const file = files.next();
    const mime = file.getMimeType();
    if (mime === MIME_TYPE_DOC || mime === MIME_TYPE_DOCX) {
      results.push([
        file.getName(),           // File Name.
        file.getLastUpdated(),    // Modified Date.
        file.getId(),             // Original File ID.
        "NOT_STARTED"             // Conversion Status.
      ]);
    }
  }
  if (results.length === 0) {
    console.log("No Word files found.");
    return;
  }

  results.sort((a, b) => b[1] - a[1]);

  const finalData = results.map((row, index) => [
    index + 1,    // Position.
    row[0],       // File Name.
    row[1],       // Modified Date.
    row[2],       // Original File ID.
    row[3]        // Conversion Status.
  ]);

  sheet.getRange(2, 1, finalData.length, finalData[0].length).setValues(finalData);  
  console.log(`Successfully indexed ${finalData.length} files.`);
}

/**
 * Orchestrates conversion based on enabled flags and existing IDs.
 */
function runBatchConversion() {
  const startTime = new Date().getTime();
  const maxRunTimeMs = 4.25 * 60 * 1000; 

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID_INVOICE_DATA_EXTRACTION);
  const sheet = ss.getSheetByName(SHEET_NAME_FILE_REGISTRY);
  const data = sheet.getDataRange().getValues();
  let processedCount = 0;

  for (let i = 1; i < data.length; i++) {
    const currentTime = new Date().getTime();
    if (currentTime - startTime > maxRunTimeMs) {
      console.log(`Time limit reached (${(currentTime - startTime)/1000}s). Stopping batch.`);
      break;
    }
    
    if (processedCount >= BATCH_SIZE_FILE_CONVERSION) break;

    const status = data[i][COLUMN_NUMBER_FILE_REGISTRY_CONVERSION_STATUS - 1];
    const existingGDocId = data[i][COLUMN_NUMBER_FILE_REGISTRY_GDOC_ID - 1];
    const existingHtmlId = data[i][COLUMN_NUMBER_FILE_REGISTRY_HTML_ID - 1];
    const existingPdfId = data[i][COLUMN_NUMBER_FILE_REGISTRY_PDF_ID - 1];

    let isComplete = (status === "SUCCEEDED");
    if (ENABLE_CONVERT_GDOC && !existingGDocId) isComplete = false;
    if (ENABLE_CONVERT_HTML && !existingHtmlId) isComplete = false;
    if (ENABLE_CONVERT_PDF && !existingPdfId) isComplete = false;

    if (!isComplete) {
      processSingleFile(sheet, i + 1, data[i][1], data[i][3], existingGDocId, existingHtmlId, existingPdfId);
      processedCount++;
    }
  }
  console.log(`Batch complete. Processed ${processedCount} files.`);
}

function processSingleFile(sheet, row, fileName, originalFileId, existingGDocId, existingHtmlId, existingPdfId) {
  let gDocId = existingGDocId;
  let htmlId = existingHtmlId;
  let pdfId = existingPdfId;
  let finalStatus = "FAILED";

  try {
    if (!gDocId && (ENABLE_CONVERT_GDOC || ENABLE_CONVERT_HTML || ENABLE_CONVERT_PDF)) {
      const resource = {
        name: fileName,
        parents: [FOLDER_ID_INVOICE_CONVERTED_GDOC],
        mimeType: 'application/vnd.google-apps.document'
      };
      gDocId = Drive.Files.copy(resource, originalFileId).id;
      console.log(`[GDOC] Created: ${fileName}`);
    }

    if (ENABLE_CONVERT_HTML && !htmlId) {
      const url = `https://www.googleapis.com/drive/v3/files/${gDocId}/export?mimeType=text/html`;
      const response = UrlFetchApp.fetch(url, {method: "get", headers: {Authorization: "Bearer " + ScriptApp.getOAuthToken()}, muteHttpExceptions: true});
      htmlId = DriveApp.getFolderById(FOLDER_ID_INVOICE_CONVERTED_HTML).createFile(response.getBlob()).setName(fileName + ".html").getId();
      console.log(`[HTML] Exported: ${fileName}`);
    }

    if (ENABLE_CONVERT_PDF && !pdfId) {
      const url = `https://www.googleapis.com/drive/v3/files/${gDocId}/export?mimeType=application/pdf`;
      const response = UrlFetchApp.fetch(url, {method: "get", headers: {Authorization: "Bearer " + ScriptApp.getOAuthToken()}, muteHttpExceptions: true});
      pdfId = DriveApp.getFolderById(FOLDER_ID_INVOICE_CONVERTED_PDF).createFile(response.getBlob()).setName(fileName + ".pdf").getId();
      console.log(`[PDF] Exported: ${fileName}`);
    }

    finalStatus = "SUCCEEDED";
  } catch (e) {
    console.error(`Error processing ${fileName}: ${e.toString()}`);
  }

  const resultsUpdate = [[finalStatus, gDocId || "", htmlId || "", pdfId || ""]];
  sheet.getRange(row, COLUMN_NUMBER_FILE_REGISTRY_CONVERSION_STATUS, 1, 4).setValues(resultsUpdate);
}

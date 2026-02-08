/**
 * Project: Invoice Data Extraction
 * File: WebExtraction.gs
 * Description: Scrapes VIG Industries website to build a product/service knowledge base.
 */

function runRawWebsiteScrape() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID_SUPPORTING_DATA_EXTRACTION);
  let sheet = ss.getSheetByName(SHEET_NAME_COMPANY_WEBSITE_EXTRACTION_RAW);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME_COMPANY_WEBSITE_EXTRACTION_RAW);
  }
  sheet.clear();
  const headers = ["Source URL", "Extracted Text Content", "Character Count"];
  sheet
    .getRange(1, 1, 1, headers.length)
    .setValues([headers])
    .setFontWeight("bold");

  const rows = [];
  URLS_COMPANY_WEBSITE_TARGETS.forEach((url) => {
    const cleanText = fetchAndCleanHtml(url);
    const safeText =
      cleanText.length > 49000
        ? cleanText.substring(0, 49000) + "... [TRUNCATED]"
        : cleanText;
    rows.push([url, safeText, cleanText.length]);
  });

  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
  }
}

function fetchAndCleanHtml(url) {
  try {
    const html = UrlFetchApp.fetch(url).getContentText();
    let cleanText = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return cleanText;
  } catch (e) {
    return "ERROR: " + e.toString();
  }
}

function runWebsiteKnowledgeExtraction() {
  console.log(
    "Standing by for RAW data review before finalizing structured extraction.",
  );
}

/**
 * Project: Invoice Data Extraction
 * File: Config.gs
 * Description: Global constants and configuration for the extraction pipeline.
 */

const scriptProperties = PropertiesService.getScriptProperties();

////////////////////////////////////////////////////////////////////////////////
// Gemini API Configuration.                                                  //
////////////////////////////////////////////////////////////////////////////////
const GEMINI_API_KEY = scriptProperties.getProperty("GEMINI_API_KEY");
const GEMINI_MODEL_ID = "gemini-3-flash-preview";

////////////////////////////////////////////////////////////////////////////////
// Invoice Data Extraction Constants.                                         //
////////////////////////////////////////////////////////////////////////////////
const BATCH_SIZE_FILE_CONVERSION = 50;
const BATCH_SIZE_INVOICE_EXTRACTION = 20;

// Invoice Data Extraction - Spreadsheet Constants.
const SPREADSHEET_ID_INVOICE_DATA_EXTRACTION = scriptProperties.getProperty(
  "SPREADSHEET_ID_INVOICE_DATA_EXTRACTION",
);
const SHEET_NAME_FILE_REGISTRY = "FILE_REGISTRY";
const SHEET_NAME_INVOICE_EXTRACTION_STRUCTURED =
  "INVOICE_EXTRACTION_STRUCTURED";
const COLUMN_NUMBER_FILE_REGISTRY_CONVERSION_STATUS = 5;
const COLUMN_NUMBER_FILE_REGISTRY_GDOC_ID = 6;
const COLUMN_NUMBER_FILE_REGISTRY_HTML_ID = 7;
const COLUMN_NUMBER_FILE_REGISTRY_PDF_ID = 8;
const COLUMN_NUMBER_FILE_REGISTRY_EXTRACTION_STATUS = 9;

// Invoice Data Extraction - Drive Constants.
const FOLDER_ID_INVOICE_SOURCE = scriptProperties.getProperty(
  "FOLDER_ID_INVOICE_SOURCE",
);
const FOLDER_ID_INVOICE_CONVERTED_GDOC = scriptProperties.getProperty(
  "FOLDER_ID_INVOICE_CONVERTED_GDOC",
);
const FOLDER_ID_INVOICE_CONVERTED_HTML = scriptProperties.getProperty(
  "FOLDER_ID_INVOICE_CONVERTED_HTML",
);
const FOLDER_ID_INVOICE_CONVERTED_PDF = scriptProperties.getProperty(
  "FOLDER_ID_INVOICE_CONVERTED_PDF",
);

// Invoice Data Extraction - Feature Flags.
const ENABLE_CONVERT_GDOC = true;
const ENABLE_CONVERT_HTML = true;
const ENABLE_CONVERT_PDF = true;

////////////////////////////////////////////////////////////////////////////////
// Invoice Data Export Constants.                                             //
////////////////////////////////////////////////////////////////////////////////
const SPREADSHEET_ID_INVOICE_DATA_EXPORT = scriptProperties.getProperty(
  "SPREADSHEET_ID_INVOICE_DATA_EXPORT",
);

////////////////////////////////////////////////////////////////////////////////
// Invoice Supporting Extraction Constants.                                   //
////////////////////////////////////////////////////////////////////////////////
const SPREADSHEET_ID_SUPPORTING_DATA_EXTRACTION = scriptProperties.getProperty(
  "SPREADSHEET_ID_SUPPORTING_DATA_EXTRACTION",
);
const SHEET_NAME_COMPANY_WEBSITE_EXTRACTION_RAW =
  "COMPANY_WEBSITE_EXTRACTION_RAW";
const URLS_COMPANY_WEBSITE_TARGETS = [
  "https://www.vigindustries.com/",
  "https://www.vigindustries.com/sitemap.xml",
  "https://www.vigindustries.com/products",
  "https://www.vigindustries.com/sales-and-service",
  "https://www.vigindustries.com/rentals",
  "https://www.vigindustries.com/clients",
];

////////////////////////////////////////////////////////////////////////////////
// Diagnostic Constants.                                                      //
////////////////////////////////////////////////////////////////////////////////
const BATCH_SIZE_READ_CONVERTED_TEXT = 25;

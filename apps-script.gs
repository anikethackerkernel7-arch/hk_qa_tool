/**
 * Argos Training — Google Sheets receiver
 * ---------------------------------------
 * This script receives submissions from the training tool and appends
 * one row per submission to the active Google Sheet.
 *
 * SETUP:
 *  1. Create a new Google Sheet.
 *  2. Extensions → Apps Script.
 *  3. Delete the default code and paste THIS file.
 *  4. Click Deploy → New deployment → Type: Web app.
 *     - Execute as: Me
 *     - Who has access: Anyone
 *  5. Copy the deployment URL and paste it into index.html
 *     (the SHEETS_ENDPOINT constant near the top of the <script> block).
 *
 * Re-deploy (Deploy → Manage deployments → Edit) any time you change
 * this code. The URL stays the same across edits of the same deployment.
 */

const SHEET_NAME = "Submissions";

// Header row written on first run.
const HEADERS = [
  "Timestamp",
  "Email",
  "Clip ID",
  "Workitem",
  "Locale",
  "File",
  "Spoken",
  "Written",
  "Speaker Count",
  "Speaker 1 Gender", "Speaker 1 Nativity",
  "Speaker 2 Gender", "Speaker 2 Nativity",
  "Speaker 3 Gender", "Speaker 3 Nativity",
  "Speaker 4 Gender", "Speaker 4 Nativity",
  "Play Count",
  "Time Spent (sec)",
  "Skipped"
];

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const sheet = getOrCreateSheet();

    // Ensure headers exist
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(HEADERS);
      sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold");
      sheet.setFrozenRows(1);
    }

    const s = data.speakers || [];
    const speakerCells = [];
    for (let i = 0; i < 4; i++) {
      speakerCells.push(s[i] ? s[i].gender  || "" : "");
      speakerCells.push(s[i] ? s[i].nativity || "" : "");
    }

    const row = [
      data.timestamp     || new Date().toISOString(),
      data.email         || "",
      data.clipId        || "",
      data.workitem      || "",
      data.locale        || "",
      data.fileName      || "",
      data.spoken        || "",
      data.written       || "",
      data.speakerCount  || 0,
      ...speakerCells,
      data.playCount     || 0,
      data.timeSpentSec  || 0,
      data.skipped ? "Yes" : "No"
    ];

    sheet.appendRow(row);

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet() {
  return ContentService
    .createTextOutput("Argos Training endpoint is live. Use POST to submit.")
    .setMimeType(ContentService.MimeType.TEXT);
}

function getOrCreateSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  return sheet;
}

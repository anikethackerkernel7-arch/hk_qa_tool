/**
 * Argos Training — Google Sheets receiver (v18)
 *
 * POST routes (data.type / data.action):
 *  - Practice clips (default) — per-user sheet + summary totals
 *  - assessment — full assessment row on shared "Assessment" sheet
 *  - assessment_guidelines — early guidelines MCQ row on "GuidelinesMcq" sheet
 *  - action: admin_* / check_user — sheet-backed user allowlist (Users tab)
 *
 * Practice sheet behaviour:
 *  - Idempotent clip submissions (email + clipId + clipStartedAt)
 *  - Skipped submissions ignored; correction columns (Incorrect / Original Text)
 *  - Totals block with mm:ss time column as plain text
 */

const HEADERS = [
  "Timestamp",
  "Name",
  "Email",
  "Clip ID",
  "Workitem",
  "Locale",
  "File",
  "Spoken",
  "Written",
  "Incorrect Text",
  "Original Text",
  "Speaker Count",
  "Speaker 1 Gender", "Speaker 1 Nativity",
  "Speaker 2 Gender", "Speaker 2 Nativity",
  "Speaker 3 Gender", "Speaker 3 Nativity",
  "Speaker 4 Gender", "Speaker 4 Nativity",
  "Play Count",
  "Time on Clip (sec)",
  "Time on Clip (mm:ss)",
  "Session Elapsed (sec)",
  "Clip Started At",
  "Clip Submitted At",
  "Skipped"
];

// 0-based indexes into HEADERS / data rows
const COL = {
  email: 2,
  clipId: 3,
  playCount: 20,
  timeSec: 21,
  timeMmSs: 22,       // 1-based column = 23
  clipStartedAt: 24,
  skipped: 26,
};

// Marker strings used to identify totals rows so we can safely filter them out.
const TOTAL_MARKERS = ["TOTAL", "AVG", "SKIPPED CLIPS"];

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    // User admin API (sheet-backed allowlist)
    if (data.action) {
      return handleUserAdminPost(data);
    }

    // Guidelines MCQ — saved when user completes first section (before rest of assessment)
    if (data.type === "assessment_guidelines") {
      return handleGuidelinesMcqPost(data);
    }

    // Assessment flow — shared sheet, append-only (does not touch per-user sheets)
    if (data.type === "assessment") {
      return handleAssessmentPost(data);
    }

    // Ignore skipped submissions — don't save them to the sheet
    if (data.skipped === true) {
      return ContentService
        .createTextOutput(JSON.stringify({ ok: true, ignored: "skipped" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const sheet = getOrCreateUserSheet(data.email);

    // Idempotency check — reject duplicates from GAS 302 redirect double-execution
    if (isDuplicateSubmission(sheet, data)) {
      return ContentService
        .createTextOutput(JSON.stringify({ ok: true, ignored: "duplicate" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const existingRows = getExistingDataRows(sheet);
    const newRow = buildDataRow(data);
    const allRows = existingRows.concat([newRow]);

    rewriteUserSheet(sheet, allRows);
    updateSummarySheet(data);

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  try {
    const params = (e && e.parameter) ? e.parameter : {};
    const action = String(params.action || "").trim();

    if (action === "check_user") {
      return jsonResponse(handleCheckUser(params.email));
    }

    if (action === "admin_users") {
      return jsonResponse(handleAdminListUsers(params.token));
    }

    return ContentService
      .createTextOutput("Argos Training endpoint is live.")
      .setMimeType(ContentService.MimeType.TEXT);
  } catch (err) {
    return jsonResponse({ ok: false, message: "Unable to process the request." });
  }
}

/* ---------------- Idempotency ---------------- */

/**
 * Check if this exact submission was already saved.
 * Uses email + clipId + clipStartedAt as the unique key.
 * Prevents duplicate rows from Apps Script's 302 redirect double-execution.
 */
function isDuplicateSubmission(sheet, data) {
  if (!data.clipStartedAt) return false; // no key to check against

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;

  const values = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();

  const targetEmail     = String(data.email         || "").trim();
  const targetClipId    = String(data.clipId        || "").trim();
  const targetStartedAt = String(data.clipStartedAt || "").trim();

  return values.some(r => {
    return String(r[COL.email]         || "").trim() === targetEmail &&
           String(r[COL.clipId]        || "").trim() === targetClipId &&
           String(r[COL.clipStartedAt] || "").trim() === targetStartedAt;
  });
}

/* ---------------- Row builders ---------------- */

function buildDataRow(data) {
  const s = data.speakers || [];
  const speakerCells = [];
  for (let i = 0; i < 4; i++) {
    speakerCells.push(s[i] ? s[i].gender  || "" : "");
    speakerCells.push(s[i] ? s[i].nativity || "" : "");
  }

  const timeSec = data.timeSpentSec || 0;

  return [
    data.timestamp        || new Date().toISOString(),
    data.name             || "",
    data.email            || "",
    data.clipId           || "",
    data.workitem         || "",
    data.locale           || "",
    data.fileName         || "",
    data.spoken           || "",
    data.written          || "",
    data.incorrectText    || "",
    data.originalText     || "",
    data.speakerCount     || 0,
    ...speakerCells,
    data.playCount        || 0,
    timeSec,
    formatSeconds(timeSec),
    data.sessionElapsedSec || 0,
    data.clipStartedAt    || "",
    data.clipSubmittedAt  || "",
    data.skipped ? "Yes" : "No"
  ];
}

/* ---------------- Sheet helpers ---------------- */

function getExistingDataRows(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const values = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();

  return values.filter(r => {
    const first = String(r[0] || "").trim();
    if (!first) return false;
    // Filter out totals block rows
    for (const marker of TOTAL_MARKERS) {
      if (first.indexOf(marker) !== -1) return false;
    }
    // Filter out any old skipped rows so they get removed on the next rewrite
    if (r[COL.skipped] === "Yes") return false;
    return true;
  });
}

function rewriteUserSheet(sheet, dataRows) {
  // 1. Clear the used range + buffer AND reset formats at the column level
  const maxRow = Math.max(sheet.getLastRow() + 20, 100);
  const clearRange = sheet.getRange(1, 1, maxRow, HEADERS.length);
  clearRange.clearContent();
  clearRange.setBackground(null);
  clearRange.setFontWeight("normal");

  // Reset ALL column formats to General — clears sticky Date/Time formats from
  // prior script versions that made "Time on Clip (mm:ss)" render as 12/30/1899.
  sheet.getRange(1, 1, sheet.getMaxRows(), HEADERS.length).setNumberFormat("General");

  // 2. Headers
  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold");
  sheet.setFrozenRows(1);

  // 3. Data rows
  if (dataRows.length > 0) {
    sheet.getRange(2, 1, dataRows.length, HEADERS.length).setValues(dataRows);

    // Force plain-text format on "Time on Clip (mm:ss)" (1-based col 23)
    sheet.getRange(1, COL.timeMmSs + 1, sheet.getMaxRows(), 1).setNumberFormat("@");
  }

  // 4. Totals block — only columns A + B, correctly aligned
  const totals = computeTotals(dataRows);
  const totalsStartRow = dataRows.length + 3;

  const totalsBlock = [
    ["TOTAL CLIPS",         totals.count],
    ["TOTAL PLAY COUNT",    totals.plays],
    ["TOTAL TIME (sec)",    totals.timeSec],
    ["TOTAL TIME (mm:ss)",  formatSeconds(totals.timeSec)],
    ["AVG TIME PER CLIP",   formatSeconds(totals.avgSec)],
  ];

  const totalsRange = sheet.getRange(totalsStartRow, 1, totalsBlock.length, 2);
  totalsRange.setValues(totalsBlock);
  totalsRange.setFontWeight("bold");
  totalsRange.setBackground("#f0fdfa");

  // Force correct display format per row
  sheet.getRange(totalsStartRow,     2).setNumberFormat("0");   // TOTAL CLIPS       — integer
  sheet.getRange(totalsStartRow + 1, 2).setNumberFormat("0");   // TOTAL PLAY COUNT  — integer
  sheet.getRange(totalsStartRow + 2, 2).setNumberFormat("0");   // TOTAL TIME (sec)  — integer
  sheet.getRange(totalsStartRow + 3, 2).setNumberFormat("@");   // TOTAL TIME (mm:ss)— plain text
  sheet.getRange(totalsStartRow + 4, 2).setNumberFormat("@");   // AVG TIME PER CLIP — plain text

  // Re-write time strings as literal text to prevent Sheets from parsing them as durations
  sheet.getRange(totalsStartRow + 3, 2).setValue("'" + formatSeconds(totals.timeSec));
  sheet.getRange(totalsStartRow + 4, 2).setValue("'" + formatSeconds(totals.avgSec));
}

function computeTotals(dataRows) {
  const timeSec = dataRows.reduce((sum, r) => sum + (Number(r[COL.timeSec]) || 0), 0);
  const plays   = dataRows.reduce((sum, r) => sum + (Number(r[COL.playCount]) || 0), 0);
  const count   = dataRows.length;
  return {
    count,
    plays,
    timeSec,
    avgSec: count ? Math.round(timeSec / count) : 0
  };
}

/* ---------------- Utility ---------------- */

function formatSeconds(sec) {
  sec = Math.round(sec);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function emailToSheetName(email) {
  if (!email) return "unknown_user";
  return email
    .toLowerCase()
    .replace(/[\[\]\*\?\/\\:]/g, "_")
    .substring(0, 100);
}

function getOrCreateUserSheet(email) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetName = emailToSheetName(email);
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) sheet = ss.insertSheet(sheetName);
  return sheet;
}

/* ---------------- Summary ---------------- */

function updateSummarySheet(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let summary = ss.getSheetByName("Summary");
  if (!summary) {
    summary = ss.insertSheet("Summary", 0);
    summary.appendRow([
      "Name", "Email", "Last Submission",
      "Total Clips", "Total Time (mm:ss)",
      "Avg Time per Clip", "Sheet Link"
    ]);
    summary.getRange(1, 1, 1, 7).setFontWeight("bold");
    summary.setFrozenRows(1);
  }

  const email = data.email || "";
  const userSheet = ss.getSheetByName(emailToSheetName(email));
  const userDataRows = userSheet ? getExistingDataRows(userSheet) : [];
  const totals = computeTotals(userDataRows);

  const link = userSheet
    ? `=HYPERLINK("#gid=${userSheet.getSheetId()}","Open ${emailToSheetName(email)}")`
    : "";

  const rows = summary.getDataRange().getValues();
  const rowIndex = rows.findIndex((r, i) => i > 0 && r[1] === email);

  const newRow = [
    data.name || "",
    email,
    new Date(),
    totals.count,
    formatSeconds(totals.timeSec),
    formatSeconds(totals.avgSec),
    link
  ];

  if (rowIndex === -1) {
    summary.appendRow(newRow);
    if (link) summary.getRange(summary.getLastRow(), 7).setFormula(link);
    const r = summary.getLastRow();
    summary.getRange(r, 4).setNumberFormat("0");   // Total Clips
    summary.getRange(r, 5).setNumberFormat("@");   // Total Time (mm:ss)
    summary.getRange(r, 6).setNumberFormat("@");   // Avg Time per Clip
  } else {
    const r = rowIndex + 1;
    summary.getRange(r, 1).setValue(newRow[0]);
    summary.getRange(r, 3).setValue(newRow[2]);
    summary.getRange(r, 4).setValue(newRow[3]);
    summary.getRange(r, 5).setValue(newRow[4]);
    summary.getRange(r, 6).setValue(newRow[5]);
    if (link) summary.getRange(r, 7).setFormula(link);
    summary.getRange(r, 4).setNumberFormat("0");
    summary.getRange(r, 5).setNumberFormat("@");
    summary.getRange(r, 6).setNumberFormat("@");
  }
}

/* =========================================================
   ASSESSMENT (v9 additive) — shared sheet, append-only
   Existing practice helpers above are intentionally unchanged.
   ========================================================= */

const ASSESSMENT_SHEET_NAME = "Assessment";

const ASSESSMENT_HEADERS = [
  "Timestamp",
  "Name",
  "Email",
  "OverallScore",
  "McqAScore",
  "McqBScore",
  "TranscribeScore",
  "McqADetail",
  "McqBDetail",
  "TranscribeDetail",
  "SessionElapsedSec",
  "SubmittedAt",
  "GuidelinesMcqScore",
  "GuidelinesMcqDetail"
];

function handleAssessmentPost(data) {
  try {
    const sheet = getOrCreateAssessmentSheet();
    ensureAssessmentHeaders(sheet);

    if (isDuplicateAssessment(sheet, data)) {
      return ContentService
        .createTextOutput(JSON.stringify({ ok: true, ignored: "duplicate" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    sheet.appendRow(buildAssessmentRow(data));

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function getOrCreateAssessmentSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(ASSESSMENT_SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(ASSESSMENT_SHEET_NAME);
  return sheet;
}

function ensureAssessmentHeaders(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(ASSESSMENT_HEADERS);
    sheet.getRange(1, 1, 1, ASSESSMENT_HEADERS.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
    return;
  }
  const lastCol = Math.max(sheet.getLastColumn(), 1);
  const existing = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  ASSESSMENT_HEADERS.forEach((header, i) => {
    if (existing[i] !== header) {
      sheet.getRange(1, i + 1).setValue(header).setFontWeight("bold");
    }
  });
  sheet.setFrozenRows(1);
}

function isDuplicateAssessment(sheet, data) {
  const submittedAt = String(data.submittedAt || "").trim();
  const email = String(data.email || "").trim();
  if (!submittedAt || !email) return false;

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;

  // Email = col 3 (index 2), SubmittedAt = col 12 (index 11)
  // getRange(row, col, lastRow, lastCol) — use lastRow, not lastRow-1
  // (lastRow-1 throws when only one data row exists and skips the latest row)
  const values = sheet.getRange(2, 1, lastRow, ASSESSMENT_HEADERS.length).getValues();
  return values.some(r =>
    String(r[2] || "").trim() === email &&
    String(r[11] || "").trim() === submittedAt
  );
}

function buildAssessmentRow(data) {
  return [
    data.timestamp || new Date().toISOString(),
    data.name || "",
    data.email || "",
    data.overallScore != null ? data.overallScore : "",
    data.mcqAScore != null ? data.mcqAScore : "",
    data.mcqBScore != null ? data.mcqBScore : "",
    data.transcribeScore != null ? data.transcribeScore : "",
    JSON.stringify(data.mcqA || []),
    JSON.stringify(data.mcqB || []),
    JSON.stringify(data.transcribe || []),
    data.sessionElapsedSec != null ? data.sessionElapsedSec : "",
    data.submittedAt || "",
    data.guidelinesMcqScore != null ? data.guidelinesMcqScore : "",
    JSON.stringify(data.guidelinesMcq || [])
  ];
}

const GUIDELINES_MCQ_SHEET_NAME = "GuidelinesMcq";

const GUIDELINES_MCQ_HEADERS = [
  "Timestamp",
  "Name",
  "Email",
  "GuidelinesMcqScore",
  "GuidelinesMcqDetail",
  "SubmittedAt",
  "SessionStartedAt"
];

function handleGuidelinesMcqPost(data) {
  try {
    const sheet = getOrCreateGuidelinesMcqSheet();
    ensureGuidelinesMcqHeaders(sheet);

    if (isDuplicateGuidelinesMcq(sheet, data)) {
      return ContentService
        .createTextOutput(JSON.stringify({ ok: true, ignored: "duplicate" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    sheet.appendRow(buildGuidelinesMcqRow(data));

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function getOrCreateGuidelinesMcqSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(GUIDELINES_MCQ_SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(GUIDELINES_MCQ_SHEET_NAME);
  return sheet;
}

function ensureGuidelinesMcqHeaders(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(GUIDELINES_MCQ_HEADERS);
    sheet.getRange(1, 1, 1, GUIDELINES_MCQ_HEADERS.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
    return;
  }
  const lastCol = Math.max(sheet.getLastColumn(), 1);
  const existing = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  GUIDELINES_MCQ_HEADERS.forEach((header, i) => {
    if (existing[i] !== header) {
      sheet.getRange(1, i + 1).setValue(header).setFontWeight("bold");
    }
  });
  sheet.setFrozenRows(1);
}

function isDuplicateGuidelinesMcq(sheet, data) {
  const email = String(data.email || "").trim();
  const sessionStartedAt = String(data.sessionStartedAt || "").trim();
  if (!email || !sessionStartedAt) return false;

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;

  const values = sheet.getRange(2, 1, lastRow, GUIDELINES_MCQ_HEADERS.length).getValues();
  return values.some(r =>
    String(r[2] || "").trim() === email &&
    String(r[6] || "").trim() === sessionStartedAt
  );
}

function buildGuidelinesMcqRow(data) {
  return [
    data.timestamp || new Date().toISOString(),
    data.name || "",
    data.email || "",
    data.guidelinesMcqScore != null ? data.guidelinesMcqScore : "",
    JSON.stringify(data.guidelinesMcq || []),
    data.submittedAt || "",
    data.sessionStartedAt || ""
  ];
}

/* =========================================================
   USERS (sheet-backed allowlist + admin CRUD)
   ========================================================= */

const USERS_SHEET_NAME = "Users";
const ADMIN_TOKEN_TTL_SEC = 7200; // 2 hours

const DEFAULT_USERS = [
  ["dishikamore205@gmail.com", "Dishika More", true],
  ["fatimagoshiya5@gmail.com", "Goshiya Fatima", true],
  ["dubeyrishika53@gmail.com", "Rishika Dubey", true],
  ["kaharashish657@gmail.com", "Ashish Kahar", true],
  ["ramji@gmail.com", "Amrendra Pratap Singh", true],
  ["murtuza21@gmail.com", "Murtaza Ali", true],
  ["jaknoreshubham@gmail.com", "Shubham Jaknore", true],
  ["abhaysinghhrr744@gmail.com", "Abhay Rathore", true],
  ["poojaverma462023@gmail.com", "Pooja Verma", true],
  ["raiaman9122@gmail.com", "Aman Rai", true],
  ["syedrayyansajid@gmail.com", "Syed Rayyan Sajid", true],
  ["adnan119786@gmail.com", "Mohannad Adnan", true],
  ["garimamukati81@gmail.com", "Garima Mukati", true],
  ["khantahoor568@gmail.com", "Tahur Khan", true],
  ["vaishnavisharma11505@gmail.com", "Vaishnavi Sharma", true],
  ["mahakvishwakarma848@gmail.com", "Mahak Vishwakarma", true],
  ["riyanagwani3032004@gmail.com", "Riyan Agwani", true],
  ["yashtupkar6@gmail.com", "Yash Tupkar", true],
  ["utkarshchurariya19@gmail.com", "Utkarsh Churariya", true],
  ["murtuza33@gmail.com", "Murtuza Ali", true],
  ["jiyavishwakarma5582@gmail.com", "Jiya Vishwakarma", true],
  ["azizsaniyaa@gmail.com", "Aziz Saniya", true],
  ["ybhadauriya40@gmail.com", "Yogesh Bhadauriya", true],
  ["alisayedumar45@gmail.com", "Umar Ali", true],
  ["uk765292@gmail.com", "Usman", true],
  ["zzzaidkhan02@gmail.com", "Zaid", true],
  ["saeedurrehman786100@gmai.com", "Saeed", true],
  ["shayanskhan00@gmail.com", "Shayan", true]
];

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function parseEnabled(value) {
  if (value === true || value === 1) return true;
  const s = String(value || "").trim().toLowerCase();
  return s === "true" || s === "yes" || s === "1";
}

function getOrCreateUsersSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(USERS_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(USERS_SHEET_NAME);
  }
  ensureUsersHeaders(sheet);
  return sheet;
}

function ensureUsersHeaders(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["Email", "Name", "Enabled"]);
    sheet.getRange(1, 1, 1, 3).setFontWeight("bold");
    sheet.setFrozenRows(1);
    return;
  }
  const headers = sheet.getRange(1, 1, 1, 3).getValues()[0];
  const expected = ["Email", "Name", "Enabled"];
  expected.forEach((header, i) => {
    if (headers[i] !== header) {
      sheet.getRange(1, i + 1).setValue(header).setFontWeight("bold");
    }
  });
  sheet.setFrozenRows(1);
}

/**
 * Run once from the Apps Script editor to populate Users if empty.
 */
function seedUsersIfEmpty() {
  const sheet = getOrCreateUsersSheet();
  if (sheet.getLastRow() > 1) {
    return { ok: true, seeded: false, message: "Users sheet already has data." };
  }
  const rows = DEFAULT_USERS.map((row) => [row[0], row[1], row[2]]);
  if (rows.length) {
    sheet.getRange(2, 1, rows.length, 3).setValues(rows);
  }
  return { ok: true, seeded: true, count: rows.length };
}

function readAllUsers() {
  seedUsersIfEmpty();
  const sheet = getOrCreateUsersSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const values = sheet.getRange(2, 1, lastRow, 3).getValues();
  return values
    .map((row) => ({
      email: normalizeEmail(row[0]),
      name: String(row[1] || "").trim(),
      enabled: parseEnabled(row[2])
    }))
    .filter((u) => u.email);
}

function findUserRow(sheet, email) {
  const key = normalizeEmail(email);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2 || !key) return -1;

  const values = sheet.getRange(2, 1, lastRow, 1).getValues();
  for (let i = 0; i < values.length; i++) {
    if (normalizeEmail(values[i][0]) === key) {
      return i + 2; // 1-based sheet row
    }
  }
  return -1;
}

function handleCheckUser(email) {
  try {
    const key = normalizeEmail(email);
    if (!key || !isValidEmail(key)) {
      return { ok: true, allowed: false, name: "" };
    }

    const users = readAllUsers();
    const user = users.find((u) => u.email === key);
    if (!user) {
      return { ok: true, allowed: false, name: "" };
    }
    if (!user.enabled) {
      return { ok: true, allowed: false, name: user.name, disabled: true };
    }
    return { ok: true, allowed: true, name: user.name };
  } catch (err) {
    Logger.log("handleCheckUser failed: " + err);
    return { ok: false, message: "Unable to verify user access." };
  }
}

function getAdminCredentials_() {
  const props = PropertiesService.getScriptProperties();
  return {
    email: normalizeEmail(props.getProperty("ADMIN_EMAIL")),
    password: String(props.getProperty("ADMIN_PASSWORD") || "")
  };
}

function createAdminToken_() {
  const token = Utilities.getUuid() + Utilities.getUuid();
  const cache = CacheService.getScriptCache();
  cache.put("admin_" + token, "1", ADMIN_TOKEN_TTL_SEC);
  return { token: token, expiresIn: ADMIN_TOKEN_TTL_SEC };
}

function validateAdminToken_(token) {
  if (!token) return false;
  const cache = CacheService.getScriptCache();
  return cache.get("admin_" + String(token).trim()) === "1";
}

function requireAdminToken_(token) {
  if (!validateAdminToken_(token)) {
    throw new Error("Unauthorized");
  }
}

function handleAdminLogin(data) {
  const creds = getAdminCredentials_();
  const email = normalizeEmail(data.email);
  const password = String(data.password || "");

  if (!creds.email || !creds.password) {
    return { ok: false, message: "Admin credentials are not configured." };
  }
  if (email !== creds.email || password !== creds.password) {
    return { ok: false, message: "Invalid email or password." };
  }

  const session = createAdminToken_();
  return { ok: true, token: session.token, expiresIn: session.expiresIn };
}

function handleAdminListUsers(token) {
  try {
    requireAdminToken_(token);
    const users = readAllUsers().map((u) => ({
      email: u.email,
      name: u.name,
      enabled: u.enabled
    }));
    return { ok: true, users: users };
  } catch (err) {
    return { ok: false, message: "Unauthorized." };
  }
}

function handleAdminAddUser(data) {
  try {
    requireAdminToken_(data.token);

    const email = normalizeEmail(data.email);
    const name = String(data.name || "").trim();
    const enabled = data.enabled !== false;

    if (!email || !isValidEmail(email)) {
      return { ok: false, message: "Please enter a valid email address." };
    }
    if (!name) {
      return { ok: false, message: "Name is required." };
    }

    const sheet = getOrCreateUsersSheet();
    if (findUserRow(sheet, email) !== -1) {
      return { ok: false, message: "This email is already registered." };
    }

    sheet.appendRow([email, name, enabled]);
    return { ok: true };
  } catch (err) {
    if (String(err.message || err) === "Unauthorized") {
      return { ok: false, message: "Unauthorized." };
    }
    Logger.log("handleAdminAddUser failed: " + err);
    return { ok: false, message: "Unable to add user." };
  }
}

function handleAdminRemoveUser(data) {
  try {
    requireAdminToken_(data.token);

    const email = normalizeEmail(data.email);
    if (!email || !isValidEmail(email)) {
      return { ok: false, message: "Please enter a valid email address." };
    }

    const sheet = getOrCreateUsersSheet();
    const row = findUserRow(sheet, email);
    if (row === -1) {
      return { ok: false, message: "User not found." };
    }

    sheet.deleteRow(row);
    return { ok: true };
  } catch (err) {
    if (String(err.message || err) === "Unauthorized") {
      return { ok: false, message: "Unauthorized." };
    }
    Logger.log("handleAdminRemoveUser failed: " + err);
    return { ok: false, message: "Unable to remove user." };
  }
}

function handleAdminToggleUser(data) {
  try {
    requireAdminToken_(data.token);

    const email = normalizeEmail(data.email);
    const enabled = !!data.enabled;

    if (!email || !isValidEmail(email)) {
      return { ok: false, message: "Please enter a valid email address." };
    }

    const sheet = getOrCreateUsersSheet();
    const row = findUserRow(sheet, email);
    if (row === -1) {
      return { ok: false, message: "User not found." };
    }

    sheet.getRange(row, 3).setValue(enabled);
    return { ok: true };
  } catch (err) {
    if (String(err.message || err) === "Unauthorized") {
      return { ok: false, message: "Unauthorized." };
    }
    Logger.log("handleAdminToggleUser failed: " + err);
    return { ok: false, message: "Unable to update user." };
  }
}

function handleUserAdminPost(data) {
  const action = String(data.action || "").trim();

  if (action === "admin_login") {
    return jsonResponse(handleAdminLogin(data));
  }
  if (action === "admin_add_user") {
    return jsonResponse(handleAdminAddUser(data));
  }
  if (action === "admin_remove_user") {
    return jsonResponse(handleAdminRemoveUser(data));
  }
  if (action === "admin_toggle_user") {
    return jsonResponse(handleAdminToggleUser(data));
  }

  return jsonResponse({ ok: false, message: "Unknown action." });
}


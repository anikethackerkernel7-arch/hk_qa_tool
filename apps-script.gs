/**
 * Argos Training — Google Sheets receiver (v22)
 *
 * POST routes (data.type / data.action):
 *  - Practice clips (default) — per-user sheet + summary totals; server scores vs ANSWER_KEY
 *  - training3 — shared Training3 sheet; server scores vs ANSWER_KEY
 *  - assessment — full assessment row; server scores vs ANSWER_KEY
 *  - assessment_guidelines — GuidelinesMcq sheet; server scores vs ANSWER_KEY
 *  - action: score_assessment_section / score_assessment_submit / admin_* / training3_* / batch_*
 *
 * Requires companion file answer-key.gs defining global ANSWER_KEY (never ship to HTML).
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
  "Skipped",
  "SimilarityPercent"
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
  similarity: 27,
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

    // Training 3 — shared sheet (does not touch per-user practice sheets)
    if (data.type === "training3") {
      return handleTraining3Post(data);
    }

    // Ignore skipped submissions — don't save them to the sheet
    if (data.skipped === true) {
      return ContentService
        .createTextOutput(JSON.stringify({ ok: true, ignored: "skipped" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // Practice — enrich with server-side original + similarity before write
    enrichPracticeClipPayload_(data);

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

    if (action === "admin_submissions") {
      return jsonResponse(handleAdminGetSubmissions(params.token, params.email));
    }

    if (action === "get_training3_assignment") {
      return jsonResponse(handleGetTraining3Assignment(params.email));
    }

    if (action === "admin_batches") {
      return jsonResponse(handleAdminListBatches(params.token));
    }

    if (action === "admin_batch_members") {
      return jsonResponse(handleAdminListBatchMembers(params.token, params.batchId));
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
    data.skipped ? "Yes" : "No",
    data.similarityPercent != null && data.similarityPercent !== ""
      ? Number(data.similarityPercent)
      : ""
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
  }).map((r) => {
    // Pad older rows that predate SimilarityPercent
    const row = r.slice();
    while (row.length < HEADERS.length) row.push("");
    return row.slice(0, HEADERS.length);
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
    ["AVG SIMILARITY %",    totals.avgSimilarity],
  ];

  const totalsRange = sheet.getRange(totalsStartRow, 1, totalsBlock.length, 2);
  totalsRange.setValues(totalsBlock);
  totalsRange.setFontWeight("bold");
  totalsRange.setBackground("#f0fdfa");

  // Force correct display format per row
  sheet.getRange(totalsStartRow,     2).setNumberFormat("0");   // TOTAL CLIPS
  sheet.getRange(totalsStartRow + 1, 2).setNumberFormat("0");   // TOTAL PLAY COUNT
  sheet.getRange(totalsStartRow + 2, 2).setNumberFormat("0");   // TOTAL TIME (sec)
  sheet.getRange(totalsStartRow + 3, 2).setNumberFormat("@");   // TOTAL TIME (mm:ss)
  sheet.getRange(totalsStartRow + 4, 2).setNumberFormat("@");   // AVG TIME PER CLIP
  sheet.getRange(totalsStartRow + 5, 2).setNumberFormat("0");   // AVG SIMILARITY %

  // Re-write time strings as literal text to prevent Sheets from parsing them as durations
  sheet.getRange(totalsStartRow + 3, 2).setValue("'" + formatSeconds(totals.timeSec));
  sheet.getRange(totalsStartRow + 4, 2).setValue("'" + formatSeconds(totals.avgSec));
}

function computeTotals(dataRows) {
  const timeSec = dataRows.reduce((sum, r) => sum + (Number(r[COL.timeSec]) || 0), 0);
  const plays   = dataRows.reduce((sum, r) => sum + (Number(r[COL.playCount]) || 0), 0);
  const count   = dataRows.length;
  const sims = dataRows
    .map((r) => r[COL.similarity])
    .filter((v) => v !== "" && v != null && !isNaN(Number(v)))
    .map((v) => Number(v));
  const avgSimilarity = sims.length
    ? Math.round(sims.reduce((s, v) => s + v, 0) / sims.length)
    : "";
  return {
    count,
    plays,
    timeSec,
    avgSec: count ? Math.round(timeSec / count) : 0,
    avgSimilarity
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
  const summaryHeaders = [
    "Name", "Email", "Last Submission",
    "Total Clips", "Total Time (mm:ss)",
    "Avg Time per Clip", "Avg Similarity %", "Sheet Link"
  ];
  if (!summary) {
    summary = ss.insertSheet("Summary", 0);
    summary.appendRow(summaryHeaders);
    summary.getRange(1, 1, 1, summaryHeaders.length).setFontWeight("bold");
    summary.setFrozenRows(1);
  } else {
    // Ensure Avg Similarity % column exists (migrate older 7-col Summary)
    const lastCol = Math.max(summary.getLastColumn(), 1);
    const existing = summary.getRange(1, 1, 1, lastCol).getValues()[0];
    if (existing[6] !== "Avg Similarity %" || existing[7] !== "Sheet Link") {
      summary.getRange(1, 1, 1, summaryHeaders.length).setValues([summaryHeaders]);
      summary.getRange(1, 1, 1, summaryHeaders.length).setFontWeight("bold");
    }
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
    totals.avgSimilarity === "" ? "" : totals.avgSimilarity,
    link
  ];

  if (rowIndex === -1) {
    summary.appendRow(newRow);
    if (link) summary.getRange(summary.getLastRow(), 8).setFormula(link);
    const r = summary.getLastRow();
    summary.getRange(r, 4).setNumberFormat("0");   // Total Clips
    summary.getRange(r, 5).setNumberFormat("@");   // Total Time (mm:ss)
    summary.getRange(r, 6).setNumberFormat("@");   // Avg Time per Clip
    summary.getRange(r, 7).setNumberFormat("0");   // Avg Similarity %
  } else {
    const r = rowIndex + 1;
    summary.getRange(r, 1).setValue(newRow[0]);
    summary.getRange(r, 3).setValue(newRow[2]);
    summary.getRange(r, 4).setValue(newRow[3]);
    summary.getRange(r, 5).setValue(newRow[4]);
    summary.getRange(r, 6).setValue(newRow[5]);
    summary.getRange(r, 7).setValue(newRow[6]);
    if (link) summary.getRange(r, 8).setFormula(link);
    summary.getRange(r, 4).setNumberFormat("0");
    summary.getRange(r, 5).setNumberFormat("@");
    summary.getRange(r, 6).setNumberFormat("@");
    summary.getRange(r, 7).setNumberFormat("0");
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

// GuidelinesMcqScore = number of correct answers (not weighted points)

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
// GuidelinesMcqScore = number of correct answers (not weighted points)

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
  if (action === "admin_submissions") {
    return jsonResponse(handleAdminGetSubmissions(data.token, data.email));
  }
  if (action === "training3_get_or_assign") {
    return jsonResponse(handleTraining3GetOrAssign(data));
  }
  if (action === "admin_create_batch") {
    return jsonResponse(handleAdminCreateBatch(data));
  }
  if (action === "admin_archive_batch") {
    return jsonResponse(handleAdminArchiveBatch(data));
  }
  if (action === "admin_add_batch_members") {
    return jsonResponse(handleAdminAddBatchMembers(data));
  }
  if (action === "admin_remove_batch_member") {
    return jsonResponse(handleAdminRemoveBatchMember(data));
  }
  if (action === "admin_move_batch_member") {
    return jsonResponse(handleAdminMoveBatchMember(data));
  }
  if (action === "admin_batches") {
    return jsonResponse(handleAdminListBatches(data.token));
  }
  if (action === "admin_batch_members") {
    return jsonResponse(handleAdminListBatchMembers(data.token, data.batchId));
  }
  if (action === "score_assessment_section") {
    return jsonResponse(handleScoreAssessmentSection(data));
  }
  if (action === "score_assessment_submit") {
    return jsonResponse(handleScoreAssessmentSubmit(data));
  }
  if (action === "score_guidelines_submit") {
    return jsonResponse(handleScoreGuidelinesSubmit(data));
  }

  return jsonResponse({ ok: false, message: "Unknown action." });
}

function safeJsonParse_(str, fallback) {
  if (!str) return fallback;
  if (typeof str !== "string") return str;
  try {
    return JSON.parse(str);
  } catch (_) {
    return fallback;
  }
}

function parseDateValue_(val) {
  if (!val) return 0;
  if (val instanceof Date) return val.getTime();
  const t = Date.parse(val);
  return isNaN(t) ? 0 : t;
}

function handleAdminGetSubmissions(token, email) {
  try {
    requireAdminToken_(token);
    const targetEmail = normalizeEmail(email);

    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // 1. Assessment submissions
    const assessments = [];
    const assessSheet = ss.getSheetByName(ASSESSMENT_SHEET_NAME);
    if (assessSheet && assessSheet.getLastRow() > 1) {
      const rows = assessSheet.getRange(2, 1, assessSheet.getLastRow() - 1, ASSESSMENT_HEADERS.length).getValues();
      rows.forEach((r) => {
        const rowEmail = normalizeEmail(r[2]);
        if (!targetEmail || rowEmail === targetEmail) {
          assessments.push({
            timestamp: r[0] ? new Date(r[0]).toISOString() : "",
            name: String(r[1] || ""),
            email: rowEmail,
            overallScore: r[3] !== "" ? Number(r[3]) : null,
            mcqAScore: r[4] !== "" ? Number(r[4]) : null,
            mcqBScore: r[5] !== "" ? Number(r[5]) : null,
            transcribeScore: r[6] !== "" ? Number(r[6]) : null,
            mcqADetail: safeJsonParse_(r[7], []),
            mcqBDetail: safeJsonParse_(r[8], []),
            transcribeDetail: safeJsonParse_(r[9], []),
            sessionElapsedSec: r[10] !== "" ? Number(r[10]) : null,
            submittedAt: String(r[11] || ""),
            guidelinesMcqScore: r[12] !== "" ? Number(r[12]) : null,
            guidelinesMcqDetail: safeJsonParse_(r[13], [])
          });
        }
      });
      // Sort descending by timestamp / submittedAt
      assessments.sort((a, b) => {
        const tA = parseDateValue_(a.submittedAt || a.timestamp);
        const tB = parseDateValue_(b.submittedAt || b.timestamp);
        return tB - tA;
      });
    }

    // 2. Guidelines MCQ submissions
    const guidelines = [];
    const guideSheet = ss.getSheetByName(GUIDELINES_MCQ_SHEET_NAME);
    if (guideSheet && guideSheet.getLastRow() > 1) {
      const rows = guideSheet.getRange(2, 1, guideSheet.getLastRow() - 1, GUIDELINES_MCQ_HEADERS.length).getValues();
      rows.forEach((r) => {
        const rowEmail = normalizeEmail(r[2]);
        if (!targetEmail || rowEmail === targetEmail) {
          guidelines.push({
            timestamp: r[0] ? new Date(r[0]).toISOString() : "",
            name: String(r[1] || ""),
            email: rowEmail,
            guidelinesMcqScore: r[3] !== "" ? Number(r[3]) : null,
            guidelinesMcqDetail: safeJsonParse_(r[4], []),
            submittedAt: String(r[5] || ""),
            sessionStartedAt: String(r[6] || "")
          });
        }
      });
      // Sort descending by timestamp / submittedAt
      guidelines.sort((a, b) => {
        const tA = parseDateValue_(a.submittedAt || a.timestamp);
        const tB = parseDateValue_(b.submittedAt || b.timestamp);
        return tB - tA;
      });
    }

    // 3. Training 3 submissions (shared sheet)
    const training3 = readTraining3ClipsForEmail_(targetEmail);

    // 4. Stage 4 practice (per-user sheet — read-only for reports)
    const practice = readPracticeClipsForEmail_(targetEmail);

    return {
      ok: true,
      email: targetEmail,
      assessments: assessments,
      guidelines: guidelines,
      training3: training3,
      practice: practice
    };
  } catch (err) {
    if (String(err.message || err) === "Unauthorized") {
      return { ok: false, message: "Unauthorized." };
    }
    Logger.log("handleAdminGetSubmissions failed: " + err);
    return { ok: false, message: "Unable to load submissions." };
  }
}

/* =========================================================
   TRAINING 3 — shared sheet + assignments
   ========================================================= */

const TRAINING3_SHEET_NAME = "Training3";
const TRAINING3_ASSIGN_SHEET_NAME = "Training3Assignments";
const TRAINING3_CLIP_PICK = 20;

const TRAINING3_HEADERS = HEADERS.concat(["SessionId"]);

const TRAINING3_ASSIGN_HEADERS = [
  "Email",
  "ClipIdsJson",
  "AssignedAt",
  "SessionId"
];

function handleTraining3Post(data) {
  try {
    if (data.skipped === true) {
      return ContentService
        .createTextOutput(JSON.stringify({ ok: true, ignored: "skipped" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const sheet = getOrCreateTraining3Sheet();
    ensureTraining3Headers(sheet);

    if (isDuplicateTraining3Submission(sheet, data)) {
      return ContentService
        .createTextOutput(JSON.stringify({ ok: true, ignored: "duplicate" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    enrichPracticeClipPayload_(data);
    sheet.appendRow(buildTraining3Row(data));

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    Logger.log("handleTraining3Post failed: " + err);
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: "Unable to save Training 3 submission." }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function getOrCreateTraining3Sheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(TRAINING3_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(TRAINING3_SHEET_NAME);
    sheet.appendRow(TRAINING3_HEADERS);
    sheet.getRange(1, 1, 1, TRAINING3_HEADERS.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function ensureTraining3Headers(sheet) {
  if (sheet.getLastRow() < 1) {
    sheet.appendRow(TRAINING3_HEADERS);
    sheet.getRange(1, 1, 1, TRAINING3_HEADERS.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
    return;
  }
  const lastCol = Math.max(sheet.getLastColumn(), 1);
  const existing = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  if (String(existing[0] || "") !== TRAINING3_HEADERS[0] || existing.length < TRAINING3_HEADERS.length) {
    sheet.getRange(1, 1, 1, TRAINING3_HEADERS.length).setValues([TRAINING3_HEADERS]);
    sheet.getRange(1, 1, 1, TRAINING3_HEADERS.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
}

function isDuplicateTraining3Submission(sheet, data) {
  if (!data.clipStartedAt) return false;
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;
  const values = sheet.getRange(2, 1, lastRow - 1, TRAINING3_HEADERS.length).getValues();
  const targetEmail = String(data.email || "").trim();
  const targetClipId = String(data.clipId || "").trim();
  const targetStartedAt = String(data.clipStartedAt || "").trim();
  return values.some((r) => {
    return String(r[COL.email] || "").trim() === targetEmail &&
      String(r[COL.clipId] || "").trim() === targetClipId &&
      String(r[COL.clipStartedAt] || "").trim() === targetStartedAt;
  });
}

function buildTraining3Row(data) {
  const base = buildDataRow(data);
  base.push(String(data.sessionId || ""));
  return base;
}

function getOrCreateTraining3AssignSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(TRAINING3_ASSIGN_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(TRAINING3_ASSIGN_SHEET_NAME);
    sheet.appendRow(TRAINING3_ASSIGN_HEADERS);
    sheet.getRange(1, 1, 1, TRAINING3_ASSIGN_HEADERS.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
  } else if (sheet.getLastRow() < 1) {
    sheet.appendRow(TRAINING3_ASSIGN_HEADERS);
    sheet.getRange(1, 1, 1, TRAINING3_ASSIGN_HEADERS.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function findTraining3AssignRow_(sheet, email) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  const values = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (let i = 0; i < values.length; i++) {
    if (normalizeEmail(values[i][0]) === email) return i + 2;
  }
  return -1;
}

function shuffleArrayCopy_(arr) {
  const a = Array.isArray(arr) ? arr.slice() : [];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i];
    a[i] = a[j];
    a[j] = tmp;
  }
  return a;
}

function handleGetTraining3Assignment(email) {
  try {
    const targetEmail = normalizeEmail(email);
    if (!targetEmail || !isValidEmail(targetEmail)) {
      return { ok: false, message: "Please enter a valid email address.", clipIds: [] };
    }
    const sheet = getOrCreateTraining3AssignSheet();
    const row = findTraining3AssignRow_(sheet, targetEmail);
    if (row === -1) {
      return { ok: true, assigned: false, clipIds: [], sessionId: "" };
    }
    const clipIds = safeJsonParse_(sheet.getRange(row, 2).getValue(), []);
    const sessionId = String(sheet.getRange(row, 4).getValue() || "");
    return {
      ok: true,
      assigned: true,
      clipIds: Array.isArray(clipIds) ? clipIds : [],
      sessionId: sessionId
    };
  } catch (err) {
    Logger.log("handleGetTraining3Assignment failed: " + err);
    return { ok: false, message: "Unable to load Training 3 assignment.", clipIds: [] };
  }
}

function handleTraining3GetOrAssign(data) {
  try {
    const targetEmail = normalizeEmail(data.email);
    if (!targetEmail || !isValidEmail(targetEmail)) {
      return { ok: false, message: "Please enter a valid email address." };
    }

    const sheet = getOrCreateTraining3AssignSheet();
    const existingRow = findTraining3AssignRow_(sheet, targetEmail);
    if (existingRow !== -1) {
      const clipIds = safeJsonParse_(sheet.getRange(existingRow, 2).getValue(), []);
      const sessionId = String(sheet.getRange(existingRow, 4).getValue() || "");
      return {
        ok: true,
        created: false,
        clipIds: Array.isArray(clipIds) ? clipIds : [],
        sessionId: sessionId
      };
    }

    const pool = Array.isArray(data.poolClipIds)
      ? data.poolClipIds.map((id) => String(id || "").trim()).filter(Boolean)
      : [];
    if (pool.length < TRAINING3_CLIP_PICK) {
      return { ok: false, message: "Not enough clips available for Training 3." };
    }

    const clipIds = shuffleArrayCopy_(pool).slice(0, TRAINING3_CLIP_PICK);
    const sessionId = String(data.sessionId || ("t3-" + Utilities.getUuid()));
    const assignedAt = new Date().toISOString();
    sheet.appendRow([targetEmail, JSON.stringify(clipIds), assignedAt, sessionId]);

    return { ok: true, created: true, clipIds: clipIds, sessionId: sessionId };
  } catch (err) {
    Logger.log("handleTraining3GetOrAssign failed: " + err);
    return { ok: false, message: "Unable to assign Training 3 clips." };
  }
}

function readTraining3ClipsForEmail_(targetEmail) {
  const clips = [];
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TRAINING3_SHEET_NAME);
  if (!sheet || sheet.getLastRow() < 2) return clips;

  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, TRAINING3_HEADERS.length).getValues();
  values.forEach((r) => {
    const rowEmail = normalizeEmail(r[COL.email]);
    if (!targetEmail || rowEmail === targetEmail) {
      if (String(r[COL.skipped] || "") === "Yes") return;
      clips.push(mapPracticeLikeRow_(r, String(r[28] || "")));
    }
  });
  clips.sort((a, b) => parseDateValue_(b.clipSubmittedAt || b.timestamp) - parseDateValue_(a.clipSubmittedAt || a.timestamp));
  return clips;
}

function mapPracticeLikeRow_(r, sessionId) {
  return {
    timestamp: r[0] ? (r[0] instanceof Date ? r[0].toISOString() : String(r[0])) : "",
    name: String(r[1] || ""),
    email: normalizeEmail(r[2]),
    clipId: String(r[3] || ""),
    workitem: String(r[4] || ""),
    locale: String(r[5] || ""),
    fileName: String(r[6] || ""),
    spoken: String(r[7] || ""),
    written: String(r[8] || ""),
    incorrectText: String(r[9] || ""),
    originalText: String(r[10] || ""),
    speakerCount: r[11] !== "" ? Number(r[11]) : null,
    playCount: r[COL.playCount] !== "" ? Number(r[COL.playCount]) : null,
    timeSpentSec: r[COL.timeSec] !== "" ? Number(r[COL.timeSec]) : null,
    sessionElapsedSec: r[23] !== "" ? Number(r[23]) : null,
    clipStartedAt: String(r[COL.clipStartedAt] || ""),
    clipSubmittedAt: String(r[25] || ""),
    similarity: r[COL.similarity] !== "" && r[COL.similarity] != null ? Number(r[COL.similarity]) : null,
    sessionId: sessionId || ""
  };
}

function readPracticeClipsForEmail_(targetEmail) {
  const clips = [];
  if (!targetEmail) return clips;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(emailToSheetName(targetEmail));
  if (!sheet || sheet.getLastRow() < 2) return clips;

  const rows = getExistingDataRows(sheet);
  rows.forEach((r) => {
    clips.push(mapPracticeLikeRow_(r, ""));
  });
  clips.sort((a, b) => parseDateValue_(b.clipSubmittedAt || b.timestamp) - parseDateValue_(a.clipSubmittedAt || a.timestamp));
  return clips;
}

function countTraining3ClipsForEmail_(email) {
  return readTraining3ClipsForEmail_(normalizeEmail(email)).length;
}

function hasPracticeForEmail_(email) {
  const targetEmail = normalizeEmail(email);
  if (!targetEmail) return false;
  const summary = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Summary");
  if (summary && summary.getLastRow() > 1) {
    const rows = summary.getRange(2, 1, summary.getLastRow() - 1, 4).getValues();
    for (let i = 0; i < rows.length; i++) {
      if (normalizeEmail(rows[i][1]) === targetEmail && Number(rows[i][3]) > 0) {
        return true;
      }
    }
  }
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(emailToSheetName(targetEmail));
  if (!sheet) return false;
  return getExistingDataRows(sheet).length > 0;
}

function hasGuidelinesForEmail_(email) {
  const targetEmail = normalizeEmail(email);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(GUIDELINES_MCQ_SHEET_NAME);
  if (!sheet || sheet.getLastRow() < 2) return false;
  const values = sheet.getRange(2, 3, sheet.getLastRow() - 1, 1).getValues();
  return values.some((r) => normalizeEmail(r[0]) === targetEmail);
}

function hasAssessmentForEmail_(email) {
  const targetEmail = normalizeEmail(email);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ASSESSMENT_SHEET_NAME);
  if (!sheet || sheet.getLastRow() < 2) return false;
  const values = sheet.getRange(2, 3, sheet.getLastRow() - 1, 1).getValues();
  return values.some((r) => normalizeEmail(r[0]) === targetEmail);
}

function deriveTraineeStage_(email) {
  const e = normalizeEmail(email);
  const stage1 = hasGuidelinesForEmail_(e);
  const stage2 = hasAssessmentForEmail_(e);
  const t3Count = countTraining3ClipsForEmail_(e);
  const stage3 = t3Count >= TRAINING3_CLIP_PICK;
  const stage4 = hasPracticeForEmail_(e);

  let current = "Not started";
  if (stage4) current = "Stage 4 — Practice complete";
  else if (stage3) current = "Stage 3 — Training 3 complete";
  else if (t3Count > 0) current = "Stage 3 — Training 3 in progress";
  else if (stage2) current = "Stage 2 — Assessment complete";
  else if (stage1) current = "Stage 1 — Guidelines complete";

  return {
    stage1Done: stage1,
    stage2Done: stage2,
    stage3Done: stage3,
    stage3ClipCount: t3Count,
    stage4Done: stage4,
    currentStage: current
  };
}

/* =========================================================
   BATCHES
   ========================================================= */

const BATCHES_SHEET_NAME = "Batches";
const BATCH_MEMBERS_SHEET_NAME = "BatchMembers";

const BATCHES_HEADERS = [
  "BatchId",
  "Name",
  "Description",
  "CreatedAt",
  "Status",
  "CreatedBy"
];

const BATCH_MEMBERS_HEADERS = [
  "BatchId",
  "Email",
  "Name",
  "AddedAt"
];

function getOrCreateBatchesSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(BATCHES_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(BATCHES_SHEET_NAME);
    sheet.appendRow(BATCHES_HEADERS);
    sheet.getRange(1, 1, 1, BATCHES_HEADERS.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
  } else if (sheet.getLastRow() < 1) {
    sheet.appendRow(BATCHES_HEADERS);
    sheet.getRange(1, 1, 1, BATCHES_HEADERS.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getOrCreateBatchMembersSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(BATCH_MEMBERS_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(BATCH_MEMBERS_SHEET_NAME);
    sheet.appendRow(BATCH_MEMBERS_HEADERS);
    sheet.getRange(1, 1, 1, BATCH_MEMBERS_HEADERS.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
  } else if (sheet.getLastRow() < 1) {
    sheet.appendRow(BATCH_MEMBERS_HEADERS);
    sheet.getRange(1, 1, 1, BATCH_MEMBERS_HEADERS.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function handleAdminListBatches(token) {
  try {
    requireAdminToken_(token);
    const sheet = getOrCreateBatchesSheet();
    const membersSheet = getOrCreateBatchMembersSheet();
    const memberCounts = {};
    if (membersSheet.getLastRow() > 1) {
      const mRows = membersSheet.getRange(2, 1, membersSheet.getLastRow() - 1, 1).getValues();
      mRows.forEach((r) => {
        const id = String(r[0] || "");
        if (!id) return;
        memberCounts[id] = (memberCounts[id] || 0) + 1;
      });
    }

    const batches = [];
    if (sheet.getLastRow() > 1) {
      const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, BATCHES_HEADERS.length).getValues();
      rows.forEach((r) => {
        const id = String(r[0] || "");
        if (!id) return;
        batches.push({
          batchId: id,
          name: String(r[1] || ""),
          description: String(r[2] || ""),
          createdAt: r[3] ? (r[3] instanceof Date ? r[3].toISOString() : String(r[3])) : "",
          status: String(r[4] || "Active"),
          createdBy: String(r[5] || ""),
          traineeCount: memberCounts[id] || 0
        });
      });
    }
    batches.sort((a, b) => parseDateValue_(b.createdAt) - parseDateValue_(a.createdAt));
    return { ok: true, batches: batches };
  } catch (err) {
    if (String(err.message || err) === "Unauthorized") {
      return { ok: false, message: "Unauthorized." };
    }
    Logger.log("handleAdminListBatches failed: " + err);
    return { ok: false, message: "Unable to list batches." };
  }
}

function handleAdminCreateBatch(data) {
  try {
    requireAdminToken_(data.token);
    const name = String(data.name || "").trim();
    if (!name) {
      return { ok: false, message: "Batch name is required." };
    }
    const description = String(data.description || "").trim();
    const batchId = "batch-" + Utilities.getUuid().replace(/-/g, "").substring(0, 12);
    const createdAt = new Date().toISOString();
    const createdBy = String(data.createdBy || "").trim();
    const sheet = getOrCreateBatchesSheet();
    sheet.appendRow([batchId, name, description, createdAt, "Active", createdBy]);
    return { ok: true, batchId: batchId };
  } catch (err) {
    if (String(err.message || err) === "Unauthorized") {
      return { ok: false, message: "Unauthorized." };
    }
    Logger.log("handleAdminCreateBatch failed: " + err);
    return { ok: false, message: "Unable to create batch." };
  }
}

function findBatchRow_(sheet, batchId) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  const values = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (let i = 0; i < values.length; i++) {
    if (String(values[i][0] || "") === batchId) return i + 2;
  }
  return -1;
}

function handleAdminArchiveBatch(data) {
  try {
    requireAdminToken_(data.token);
    const batchId = String(data.batchId || "").trim();
    if (!batchId) return { ok: false, message: "Batch ID is required." };
    const sheet = getOrCreateBatchesSheet();
    const row = findBatchRow_(sheet, batchId);
    if (row === -1) return { ok: false, message: "Batch not found." };
    sheet.getRange(row, 5).setValue("Archived");
    return { ok: true };
  } catch (err) {
    if (String(err.message || err) === "Unauthorized") {
      return { ok: false, message: "Unauthorized." };
    }
    Logger.log("handleAdminArchiveBatch failed: " + err);
    return { ok: false, message: "Unable to archive batch." };
  }
}

function handleAdminListBatchMembers(token, batchId) {
  try {
    requireAdminToken_(token);
    const id = String(batchId || "").trim();
    if (!id) return { ok: false, message: "Batch ID is required." };

    const sheet = getOrCreateBatchMembersSheet();
    const members = [];
    if (sheet.getLastRow() > 1) {
      const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, BATCH_MEMBERS_HEADERS.length).getValues();
      rows.forEach((r) => {
        if (String(r[0] || "") !== id) return;
        const email = normalizeEmail(r[1]);
        const stage = deriveTraineeStage_(email);
        members.push({
          batchId: id,
          email: email,
          name: String(r[2] || ""),
          addedAt: r[3] ? (r[3] instanceof Date ? r[3].toISOString() : String(r[3])) : "",
          stage: stage
        });
      });
    }
    return { ok: true, batchId: id, members: members };
  } catch (err) {
    if (String(err.message || err) === "Unauthorized") {
      return { ok: false, message: "Unauthorized." };
    }
    Logger.log("handleAdminListBatchMembers failed: " + err);
    return { ok: false, message: "Unable to list batch members." };
  }
}

function handleAdminAddBatchMembers(data) {
  try {
    requireAdminToken_(data.token);
    const batchId = String(data.batchId || "").trim();
    if (!batchId) return { ok: false, message: "Batch ID is required." };

    const batchSheet = getOrCreateBatchesSheet();
    if (findBatchRow_(batchSheet, batchId) === -1) {
      return { ok: false, message: "Batch not found." };
    }

    const emails = Array.isArray(data.emails) ? data.emails : [];
    if (!emails.length) return { ok: false, message: "Select at least one trainee." };

    const usersByEmail = {};
    readAllUsers().forEach((u) => {
      usersByEmail[normalizeEmail(u.email)] = u;
    });

    const membersSheet = getOrCreateBatchMembersSheet();
    const existing = {};
    if (membersSheet.getLastRow() > 1) {
      const rows = membersSheet.getRange(2, 1, membersSheet.getLastRow() - 1, 2).getValues();
      rows.forEach((r) => {
        if (String(r[0] || "") === batchId) {
          existing[normalizeEmail(r[1])] = true;
        }
      });
    }

    let added = 0;
    const now = new Date().toISOString();
    emails.forEach((raw) => {
      const email = normalizeEmail(raw);
      if (!email || !isValidEmail(email) || existing[email]) return;
      const user = usersByEmail[email];
      if (!user) return;
      membersSheet.appendRow([batchId, email, user.name || "", now]);
      existing[email] = true;
      added++;
    });

    return { ok: true, added: added };
  } catch (err) {
    if (String(err.message || err) === "Unauthorized") {
      return { ok: false, message: "Unauthorized." };
    }
    Logger.log("handleAdminAddBatchMembers failed: " + err);
    return { ok: false, message: "Unable to add batch members." };
  }
}

function handleAdminRemoveBatchMember(data) {
  try {
    requireAdminToken_(data.token);
    const batchId = String(data.batchId || "").trim();
    const email = normalizeEmail(data.email);
    if (!batchId || !email) return { ok: false, message: "Batch ID and email are required." };

    const sheet = getOrCreateBatchMembersSheet();
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return { ok: false, message: "Member not found." };

    const rows = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
    for (let i = 0; i < rows.length; i++) {
      if (String(rows[i][0] || "") === batchId && normalizeEmail(rows[i][1]) === email) {
        sheet.deleteRow(i + 2);
        return { ok: true };
      }
    }
    return { ok: false, message: "Member not found." };
  } catch (err) {
    if (String(err.message || err) === "Unauthorized") {
      return { ok: false, message: "Unauthorized." };
    }
    Logger.log("handleAdminRemoveBatchMember failed: " + err);
    return { ok: false, message: "Unable to remove batch member." };
  }
}

function handleAdminMoveBatchMember(data) {
  try {
    requireAdminToken_(data.token);
    const fromBatchId = String(data.fromBatchId || "").trim();
    const toBatchId = String(data.toBatchId || "").trim();
    const email = normalizeEmail(data.email);
    if (!fromBatchId || !toBatchId || !email) {
      return { ok: false, message: "From batch, to batch, and email are required." };
    }
    if (fromBatchId === toBatchId) return { ok: true };

    const batchSheet = getOrCreateBatchesSheet();
    if (findBatchRow_(batchSheet, toBatchId) === -1) {
      return { ok: false, message: "Target batch not found." };
    }

    const removeResult = handleAdminRemoveBatchMember({
      token: data.token,
      batchId: fromBatchId,
      email: email
    });
    if (!removeResult.ok) return removeResult;

    return handleAdminAddBatchMembers({
      token: data.token,
      batchId: toBatchId,
      emails: [email]
    });
  } catch (err) {
    if (String(err.message || err) === "Unauthorized") {
      return { ok: false, message: "Unauthorized." };
    }
    Logger.log("handleAdminMoveBatchMember failed: " + err);
    return { ok: false, message: "Unable to move batch member." };
  }
}

/* =========================================================
   ANSWER KEY SCORING (LCS) — requires answer-key.gs (ANSWER_KEY)
   ========================================================= */

function getAnswerKey_() {
  if (typeof ANSWER_KEY === "undefined" || !ANSWER_KEY) {
    throw new Error("ANSWER_KEY is not loaded. Add answer-key.gs to the Apps Script project.");
  }
  return ANSWER_KEY;
}

function tokenizeWords_(text) {
  return String(text || "").trim().split(/\s+/).filter(Boolean);
}

function lcsTable_(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, function () { return new Array(n + 1).fill(0); });
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) dp[i][j] = dp[i - 1][j - 1] + 1;
      else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp;
}

function wordDiffMatches_(answerTokens, correctTokens) {
  const aNorm = answerTokens.map(function (t) { return String(t).toLowerCase(); });
  const cNorm = correctTokens.map(function (t) { return String(t).toLowerCase(); });
  const dp = lcsTable_(aNorm, cNorm);
  const matchedA = new Array(answerTokens.length).fill(false);
  const matchedC = new Array(correctTokens.length).fill(false);
  let i = answerTokens.length;
  let j = correctTokens.length;
  while (i > 0 && j > 0) {
    if (aNorm[i - 1] === cNorm[j - 1]) {
      matchedA[i - 1] = true;
      matchedC[j - 1] = true;
      i--;
      j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }
  return { matchedA: matchedA, matchedC: matchedC };
}

/** Word-level: matched / (matched + missing + extra) * 100 */
function similarityPercent_(answer, gold) {
  const aToks = tokenizeWords_(answer);
  const gToks = tokenizeWords_(gold);
  if (!aToks.length || !gToks.length) return 0;
  const flags = wordDiffMatches_(aToks, gToks);
  const matched = flags.matchedC.filter(Boolean).length;
  const missing = flags.matchedC.length - matched;
  const extra = flags.matchedA.length - flags.matchedA.filter(Boolean).length;
  const denom = matched + missing + extra;
  if (!denom) return 0;
  return Math.round((matched / denom) * 100);
}

function remainingMissingCount_(answer, gold) {
  const aToks = tokenizeWords_(answer);
  const cToks = tokenizeWords_(gold);
  if (!cToks.length) return 0;
  const flags = wordDiffMatches_(aToks, cToks);
  return flags.matchedC.filter(function (m) { return !m; }).length;
}

function escapeHtml_(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function normalizeText_(s) {
  return String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Answer-side highlights only (no gold plaintext leaked). */
function renderAnswerDiffHtml_(answer, gold) {
  const aToks = tokenizeWords_(answer);
  const cToks = tokenizeWords_(gold);
  if (!aToks.length) {
    return '<span class="diff-bad">(no answer)</span>';
  }
  if (!cToks.length) {
    return aToks.map(function (tok) {
      return '<span class="diff-bad">' + escapeHtml_(tok) + "</span>";
    }).join(" ");
  }
  const flags = wordDiffMatches_(aToks, cToks);
  return aToks.map(function (tok, idx) {
    const cls = flags.matchedA[idx] ? "diff-ok" : "diff-bad";
    return '<span class="' + cls + '">' + escapeHtml_(tok) + "</span>";
  }).join(" ");
}

function renderCorrectDiffHtml_(answer, gold) {
  const aToks = tokenizeWords_(answer);
  const cToks = tokenizeWords_(gold);
  if (!cToks.length) {
    return '<span class="diff-miss">(no gold text)</span>';
  }
  if (!aToks.length) {
    return cToks.map(function (tok) {
      return '<span class="diff-miss">' + escapeHtml_(tok) + "</span>";
    }).join(" ");
  }
  const flags = wordDiffMatches_(aToks, cToks);
  return cToks.map(function (tok, idx) {
    const cls = flags.matchedC[idx] ? "diff-ok" : "diff-miss";
    return '<span class="' + cls + '">' + escapeHtml_(tok) + "</span>";
  }).join(" ");
}

function getClipOriginal_(clipId) {
  const key = getAnswerKey_();
  const id = String(clipId || "");
  if (!key.clipOriginals || key.clipOriginals[id] == null) return "";
  return String(key.clipOriginals[id] || "");
}

function enrichPracticeClipPayload_(data) {
  try {
    const clipId = String(data.clipId || "");
    const original = getClipOriginal_(clipId);
    data.originalText = original;
    data.similarityPercent = similarityPercent_(data.written || "", original);
  } catch (err) {
    Logger.log("enrichPracticeClipPayload_ failed: " + err);
    data.originalText = "";
    data.similarityPercent = 0;
  }
}

function scoreMcqAnswers_(sectionKey, answersMap, includeSecrets) {
  const key = getAnswerKey_();
  const bank = key[sectionKey] || {};
  const weights = key.weights || {};
  let perItem = 1;
  if (sectionKey === "mcqA") perItem = Number(weights.mcqAPerItem) || 5;
  else if (sectionKey === "guidelinesMcq") perItem = 1;

  const items = [];
  let scoreSum = 0;
  const idList = answersMap && Object.keys(answersMap).length
    ? Object.keys(answersMap)
    : Object.keys(bank);
  idList.forEach(function (qid) {
    const meta = bank[qid] || {};
    const selected = String((answersMap && answersMap[qid]) || "");
    const correctKey = String(meta.correctKey || "");
    const isCorrect = !!(selected && selected === correctKey);
    const points = isCorrect ? perItem : 0;
    scoreSum += points;
    const row = {
      questionId: qid,
      selected: selected,
      points: points,
      isCorrect: isCorrect
    };
    if (includeSecrets) {
      row.correctKey = correctKey;
      row.correctAnswer = String(meta.correctAnswer || "");
      row.question = String(meta.question || "");
      row.section = String(meta.section || "");
    }
    items.push(row);
  });
  return { items: items, score: scoreSum };
}

function scoreTypingSection_(sectionKey, answersMap, includeSecrets) {
  const key = getAnswerKey_();
  const bank = key[sectionKey] || {};
  const weights = key.weights || {};
  const items = [];
  let similaritySum = 0;
  let count = 0;
  let allExact = true;

  Object.keys(bank).forEach(function (qid) {
    const meta = bank[qid] || {};
    const gold = sectionKey === "mcqB"
      ? String(meta.correct || "")
      : String(meta.gold || "");
    const answer = String((answersMap && answersMap[qid]) || "");
    const similarity = similarityPercent_(answer, gold);
    const exact = normalizeText_(answer) === normalizeText_(gold) && !!answer;
    if (!exact) allExact = false;
    similaritySum += similarity;
    count++;
    const row = {
      id: qid,
      clipId: qid,
      answer: answer,
      similarity: similarity,
      exact: exact,
      remaining: remainingMissingCount_(answer, gold),
      answerHtml: renderAnswerDiffHtml_(answer, gold)
    };
    if (includeSecrets) {
      if (sectionKey === "mcqB") {
        row.correct = gold;
        row.incorrect = "";
        const pts = Math.round((similarity / 100) * (Number(weights.mcqBPerItem) || 10));
        row.points = pts;
      } else {
        row.gold = gold;
      }
      row.correctHtml = renderCorrectDiffHtml_(answer, gold);
    }
    items.push(row);
  });

  const averageSimilarity = count ? Math.round(similaritySum / count) : 0;
  return {
    items: items,
    averageSimilarity: averageSimilarity,
    allExact: allExact,
    count: count
  };
}

function handleScoreAssessmentSection(data) {
  try {
    const section = String(data.section || "").trim();
    const answers = data.answers && typeof data.answers === "object" ? data.answers : {};
    const thresholds = { mcqB: 80, transcribe: 70 };

    if (section === "mcqA" || section === "guidelinesMcq") {
      const scored = scoreMcqAnswers_(section, answers, false);
      const total = scored.items.length;
      const correct = scored.items.filter(function (x) { return x.isCorrect; }).length;
      return {
        ok: true,
        section: section,
        items: scored.items,
        score: scored.score,
        correctCount: correct,
        total: total,
        allCorrect: total > 0 && correct === total
      };
    }

    if (section === "mcqB" || section === "transcribe") {
      const scored = scoreTypingSection_(section, answers, false);
      const threshold = thresholds[section] != null ? thresholds[section] : 100;
      return {
        ok: true,
        section: section,
        items: scored.items,
        averageSimilarity: scored.averageSimilarity,
        allCorrect: scored.allExact,
        threshold: threshold,
        canForceContinue: scored.averageSimilarity >= threshold
      };
    }

    return { ok: false, message: "Unknown section." };
  } catch (err) {
    Logger.log("handleScoreAssessmentSection failed: " + err);
    return { ok: false, message: "Unable to score section." };
  }
}

function buildFullAssessmentScores_(payload) {
  const answers = payload.answers && typeof payload.answers === "object" ? payload.answers : {};
  const key = getAnswerKey_();
  const weights = key.weights || {};

  const gMap = answers.guidelinesMcq || {};
  const aMap = answers.mcqA || {};
  const bMap = answers.mcqB || {};
  const tMap = answers.transcribe || {};

  const gScored = scoreMcqAnswers_("guidelinesMcq", gMap, true);
  gScored.items.forEach(function (row, qi) {
    row.displayNumber = qi + 1;
    const optText = ""; // client may attach later; store key fields
    row.answer = row.answer || "";
  });
  // Attach selected option text if client sent answerTexts
  const gTexts = (payload.answerTexts && payload.answerTexts.guidelinesMcq) || {};
  gScored.items.forEach(function (row) {
    if (gTexts[row.questionId]) row.answer = String(gTexts[row.questionId]);
  });

  const aScored = scoreMcqAnswers_("mcqA", aMap, true);
  const aTexts = (payload.answerTexts && payload.answerTexts.mcqA) || {};
  const mcqADetail = aScored.items.map(function (d) {
    return {
      clipId: d.questionId,
      selected: d.selected,
      correctKey: d.correctKey,
      points: d.points,
      isCorrect: d.isCorrect,
      answer: aTexts[d.questionId] || "",
      correctAnswer: d.correctAnswer || ""
    };
  });

  const bScored = scoreTypingSection_("mcqB", bMap, true);
  const mcqBDetail = bScored.items.map(function (d) {
    return {
      clipId: d.clipId,
      answer: d.answer,
      correct: d.correct || "",
      incorrect: d.incorrect || "",
      similarity: d.similarity,
      points: d.points != null ? d.points : Math.round((d.similarity / 100) * (Number(weights.mcqBPerItem) || 10))
    };
  });

  const tScored = scoreTypingSection_("transcribe", tMap, true);
  const trDetail = tScored.items.map(function (d) {
    return {
      clipId: d.clipId,
      answer: d.answer,
      gold: d.gold || "",
      similarity: d.similarity
    };
  });

  const guidelinesMcqDetail = gScored.items;
  const guidelinesMcqScore = gScored.score;
  const mcqAScore = aScored.score;
  const mcqBScore = mcqBDetail.reduce(function (s, x) { return s + (x.points || 0); }, 0);
  const avgSim = trDetail.length
    ? trDetail.reduce(function (s, x) { return s + x.similarity; }, 0) / trDetail.length
    : 0;
  const transcribeScore = Math.round((avgSim / 100) * (Number(weights.transcribeMax) || 40));
  const overallScore = Math.max(0, Math.min(100, Math.round(mcqAScore + mcqBScore + transcribeScore)));

  return {
    guidelinesMcqScore: guidelinesMcqScore,
    mcqAScore: mcqAScore,
    mcqBScore: mcqBScore,
    transcribeScore: transcribeScore,
    overallScore: overallScore,
    guidelinesMcqDetail: guidelinesMcqDetail,
    mcqADetail: mcqADetail,
    mcqBDetail: mcqBDetail,
    trDetail: trDetail
  };
}

function handleScoreGuidelinesSubmit(data) {
  try {
    const answers = (data.answers && data.answers.guidelinesMcq) || data.answers || {};
    const texts = (data.answerTexts && data.answerTexts.guidelinesMcq) || {};
    const scored = scoreMcqAnswers_("guidelinesMcq", answers, true);
    scored.items.forEach(function (row, qi) {
      row.displayNumber = qi + 1;
      if (texts[row.questionId]) row.answer = String(texts[row.questionId]);
    });

    const rowData = {
      timestamp: new Date().toISOString(),
      name: data.name || "",
      email: data.email || "",
      guidelinesMcqScore: scored.score,
      guidelinesMcq: scored.items,
      submittedAt: data.submittedAt || new Date().toISOString(),
      sessionStartedAt: data.sessionStartedAt || ""
    };

    const sheet = getOrCreateGuidelinesMcqSheet();
    ensureGuidelinesMcqHeaders(sheet);
    if (!isDuplicateGuidelinesMcq(sheet, rowData)) {
      sheet.appendRow(buildGuidelinesMcqRow(rowData));
    }

    return {
      ok: true,
      guidelinesMcqScore: scored.score,
      guidelinesMcqDetail: scored.items
    };
  } catch (err) {
    Logger.log("handleScoreGuidelinesSubmit failed: " + err);
    return { ok: false, message: "Unable to save guidelines." };
  }
}

function handleScoreAssessmentSubmit(data) {
  try {
    const scores = buildFullAssessmentScores_(data);
    const rowData = {
      timestamp: new Date().toISOString(),
      name: data.name || "",
      email: data.email || "",
      overallScore: scores.overallScore,
      mcqAScore: scores.mcqAScore,
      mcqBScore: scores.mcqBScore,
      transcribeScore: scores.transcribeScore,
      mcqA: scores.mcqADetail,
      mcqB: scores.mcqBDetail,
      transcribe: scores.trDetail,
      sessionElapsedSec: data.sessionElapsedSec != null ? data.sessionElapsedSec : "",
      submittedAt: data.submittedAt || new Date().toISOString(),
      guidelinesMcqScore: scores.guidelinesMcqScore,
      guidelinesMcq: scores.guidelinesMcqDetail
    };

    const sheet = getOrCreateAssessmentSheet();
    ensureAssessmentHeaders(sheet);
    if (!isDuplicateAssessment(sheet, rowData)) {
      sheet.appendRow(buildAssessmentRow(rowData));
    }

    return { ok: true, scores: scores };
  } catch (err) {
    Logger.log("handleScoreAssessmentSubmit failed: " + err);
    return { ok: false, message: "Unable to submit assessment." };
  }
}

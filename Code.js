/**
 * Finds the first eligible row on the Main sheet and writes an attendance report into its D cell.
 * @returns {void}
 */
function runAnalyzer() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    SpreadsheetApp.getUi().alert('Analyzer is already running, try again shortly.');
    return;
  }

  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MAIN_SHEET_NAME);
    if (!sheet) {
      SpreadsheetApp.getUi().alert(`Sheet "${MAIN_SHEET_NAME}" not found.`);
      return;
    }

    const target = findTargetRow_(sheet);
    if (!target) {
      SpreadsheetApp.getUi().alert('No eligible row to process.');
      return;
    }

    const { report, skippedFiles } = processFolder_(target.folder, target.regex);
    sheet.getRange(target.rowNum, target.reportCol).setValue(report);

    if (skippedFiles.length > 0) {
      SpreadsheetApp.getUi().alert(`Skipped ${skippedFiles.length} file(s):\n${skippedFiles.join('\n')}`);
    }
  } finally {
    lock.releaseLock();
  }
}

/**
 * Processes every .docx file in a folder and returns the final report text plus the
 * names of any files that couldn't be processed (undated filename or conversion/parse error).
 * @param {GoogleAppsScript.Drive.Folder} folder
 * @param {RegExp} headerRegex
 * @returns {{report: string, skippedFiles: string[]}}
 */
function processFolder_(folder, headerRegex) {
  const files = listDocxFiles_(folder);
  const skippedFiles = [];

  if (files.length === 0) return { report: NO_FILES_MARKER, skippedFiles };

  const fileInfos = files
    .map((file) => ({
      id: file.getId(),
      name: file.getName(),
      date: extractDateFromFilename_(file.getName()),
    }))
    .filter((info) => {
      if (!info.date) skippedFiles.push(info.name);
      return info.date;
    })
    .sort((a, b) => (a.date === b.date ? a.name.localeCompare(b.name) : a.date < b.date ? -1 : 1));

  const personOrder = [];
  const personDates = {};

  for (const info of fileInfos) {
    let entries;
    try {
      entries = processFile_(info.id, headerRegex);
    } catch (e) {
      Logger.log(`Skipping "${info.name}": ${e}`);
      skippedFiles.push(info.name);
      continue;
    }

    for (const identity of entries) {
      if (!personDates[identity]) {
        personDates[identity] = {};
        personOrder.push(identity);
      }
      personDates[identity][info.date] = true;
    }
  }

  const report = personOrder.length === 0 ? NO_MATCH_MARKER : buildReportText_(personOrder, personDates);
  return { report, skippedFiles };
}

/**
 * Converts a single .docx file to text and scans it for personnel entries, always cleaning up the temp doc.
 * @param {string} fileId
 * @param {RegExp} headerRegex
 * @returns {string[]}
 */
function processFile_(fileId, headerRegex) {
  const tempDocId = convertDocxToGoogleDoc_(fileId);
  try {
    const doc = DocumentApp.openById(tempDocId);
    const lines = extractLines_(doc.getBody());
    return scanLinesForPersonnel_(lines, headerRegex);
  } finally {
    trashFile_(tempDocId);
  }
}

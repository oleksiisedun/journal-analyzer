/**
 * Finds the first eligible row on the Main sheet and opens a progress dialog that
 * processes its folder in time-boxed chunks (see processChunk), avoiding the
 * 6-minute execution limit on large folders.
 * @returns {void}
 */
function runAnalyzer() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    SpreadsheetApp.getUi().alert('Analyzer is already running, try again shortly.');
    return;
  }

  let target;
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MAIN_SHEET_NAME);
    if (!sheet) {
      SpreadsheetApp.getUi().alert(`Sheet "${MAIN_SHEET_NAME}" not found.`);
      return;
    }

    target = findTargetRow_(sheet);
    if (!target) {
      SpreadsheetApp.getUi().alert('No eligible row to process.');
      return;
    }
  } finally {
    // Only the row-selection step is serialized; each processChunk call below acquires
    // its own short-lived lock. Two dialogs opened close together could both pass
    // findTargetRow_ before either writes to D and end up processing the same row — an
    // accepted limitation for this single-operator tool rather than added bookkeeping.
    lock.releaseLock();
  }

  const initialState = {
    rowNum: target.rowNum,
    reportCol: target.reportCol,
    folderId: target.folder.getId(),
    regexSource: target.regex.source,
    regexFlags: target.regex.flags,
    fileIndex: 0,
    fileInfos: null,
    personOrder: [],
    personDates: {},
    skippedFiles: [],
  };

  const template = HtmlService.createTemplateFromFile('Progress');
  template.initialStateJson = JSON.stringify(initialState).replace(/</g, '\\u003c');

  const html = template.evaluate().setWidth(420).setHeight(260);
  SpreadsheetApp.getUi().showModalDialog(html, 'Journal Analyzer');
}

/**
 * Processes one time-boxed chunk of a folder's .docx files, resuming from the given
 * state and returning either the finished result or an updated state for the next chunk.
 * Called repeatedly from Progress.html via google.script.run. Deliberately has no
 * trailing underscore: google.script.run silently refuses to invoke functions whose
 * names end with "_" (Apps Script's private-function convention), so this name must
 * stay "public"-shaped even though it's only ever called from Progress.html.
 * @param {Object} state
 * @returns {Object}
 */
function processChunk(state) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return { retry: true };

  try {
    if (state.fileInfos === null) {
      const folder = DriveApp.getFolderById(state.folderId);
      const files = listDocxFiles_(folder);

      if (files.length === 0) {
        writeReport_(state.rowNum, state.reportCol, NO_FILES_MARKER);
        return { done: true, report: NO_FILES_MARKER, skippedFiles: state.skippedFiles, processedCount: 0, totalCount: 0 };
      }

      const built = buildFileInfos_(files);
      state.fileInfos = built.fileInfos;
      state.skippedFiles = state.skippedFiles.concat(built.skippedFiles);
    }

    const regex = new RegExp(state.regexSource, state.regexFlags);
    const totalCount = state.fileInfos.length;
    const startTime = Date.now();

    while (state.fileIndex < totalCount && Date.now() - startTime < CHUNK_TIME_BUDGET_MS) {
      const info = state.fileInfos[state.fileIndex];

      try {
        const entries = processFile_(info.id, regex);
        for (const identity of entries) {
          if (!state.personDates[identity]) {
            state.personDates[identity] = {};
            state.personOrder.push(identity);
          }
          state.personDates[identity][info.date] = true;
        }
      } catch (e) {
        Logger.log(`Skipping "${info.name}": ${e}`);
        state.skippedFiles.push(info.name);
      }

      state.fileIndex++;
    }

    if (state.fileIndex >= totalCount) {
      const report = state.personOrder.length === 0 ? NO_MATCH_MARKER : buildReportText_(state.personOrder, state.personDates);
      writeReport_(state.rowNum, state.reportCol, report);
      return { done: true, report, skippedFiles: state.skippedFiles, processedCount: totalCount, totalCount };
    }

    return { done: false, state, processedCount: state.fileIndex, totalCount };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Annotates files with filename-derived dates, drops undated ones into skippedFiles,
 * and sorts the rest ascending by date (then name) for first-appearance report ordering.
 * @param {GoogleAppsScript.Drive.File[]} files
 * @returns {{fileInfos: {id: string, name: string, date: string}[], skippedFiles: string[]}}
 */
function buildFileInfos_(files) {
  const skippedFiles = [];

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

  return { fileInfos, skippedFiles };
}

/**
 * Writes a value into the Main sheet's report column for a given row.
 * @param {number} rowNum
 * @param {number} reportCol
 * @param {string} value
 * @returns {void}
 */
function writeReport_(rowNum, reportCol, value) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MAIN_SHEET_NAME);
  sheet.getRange(rowNum, reportCol).setValue(value);
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

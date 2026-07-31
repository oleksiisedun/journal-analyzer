/**
 * Scans the Main sheet from row 2 down and returns the first row ready to process,
 * writing error markers into the report column for any invalid rows encountered along the way.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @returns {{rowNum: number, reportCol: number, folder: GoogleAppsScript.Drive.Folder, positionListKey: string}|null}
 */
function findTargetRow_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;

  const firstCol = columnNumber_(sheet, FOLDER_LINK_COLUMN);
  const positionCol = columnNumber_(sheet, POSITION_CHOICE_COLUMN);
  const reportCol = columnNumber_(sheet, REPORT_COLUMN);
  const lastCol = Math.max(firstCol, positionCol, reportCol);
  const values = sheet.getRange(2, firstCol, lastRow - 1, lastCol - firstCol + 1).getValues();

  for (let i = 0; i < values.length; i++) {
    const rowNum = i + 2;
    const row = values[i];
    const link = row[0];
    const positionListKey = row[positionCol - firstCol];
    const report = row[reportCol - firstCol];

    if (!link || report) continue;

    const folder = parseFolderFromLink_(link);
    if (!folder) {
      sheet.getRange(rowNum, reportCol).setValue(ERROR_INVALID_LINK);
      continue;
    }

    if (!positionListKey) continue;

    const trimmedKey = String(positionListKey).trim();
    if (!POSITION_LIST_COLUMNS.hasOwnProperty(trimmedKey)) {
      sheet.getRange(rowNum, reportCol).setValue(ERROR_INVALID_POSITION_LIST);
      continue;
    }

    return { rowNum, reportCol, folder, positionListKey: trimmedKey };
  }

  return null;
}

/**
 * Resolves the 1-based column number for an open-ended A1 column range like 'D2:D'.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {string} columnRangeA1
 * @returns {number}
 */
function columnNumber_(sheet, columnRangeA1) {
  return sheet.getRange(columnRangeA1).getColumn();
}

/**
 * Reads a position-name list from the Handbook sheet, trimmed, with blanks dropped
 * and duplicates removed (first occurrence wins).
 * @param {string} listKey a key of POSITION_LIST_COLUMNS (already validated by the caller)
 * @returns {string[]}
 */
function readPositionNames_(listKey) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(HANDBOOK_SHEET_NAME);
  if (!sheet) throw new Error(`Sheet "${HANDBOOK_SHEET_NAME}" not found.`);

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const col = columnNumber_(sheet, POSITION_LIST_COLUMNS[listKey]);
  const values = sheet.getRange(2, col, lastRow - 1, 1).getValues();

  const names = values.map((row) => String(row[0]).trim()).filter((name) => name.length > 0);
  return [...new Set(names)];
}

/**
 * Extracts a Drive folder ID from a link (or a bare ID) and resolves it to a Folder.
 * @param {string} link
 * @returns {GoogleAppsScript.Drive.Folder|null}
 */
function parseFolderFromLink_(link) {
  const id = extractFolderId_(String(link).trim());
  if (!id) return null;

  try {
    return DriveApp.getFolderById(id);
  } catch (e) {
    return null;
  }
}

/**
 * @param {string} link
 * @returns {string|null}
 */
function extractFolderId_(link) {
  const folderPathMatch = link.match(/\/folders\/([-\w]+)/);
  if (folderPathMatch) return folderPathMatch[1];

  const idParamMatch = link.match(/[?&]id=([-\w]+)/);
  if (idParamMatch) return idParamMatch[1];

  if (/^[-\w]{10,}$/.test(link)) return link;

  return null;
}

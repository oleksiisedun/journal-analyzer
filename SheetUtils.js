/**
 * Scans the Main sheet from row 2 down and returns the first row ready to process,
 * writing error markers into the report column for any invalid rows encountered along the way.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @returns {{rowNum: number, reportCol: number, folder: GoogleAppsScript.Drive.Folder}|null}
 */
function findTargetRow_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;

  const firstCol = columnNumber_(sheet, FOLDER_LINK_COLUMN);
  const reportCol = columnNumber_(sheet, REPORT_COLUMN);
  const values = sheet.getRange(2, firstCol, lastRow - 1, reportCol - firstCol + 1).getValues();

  for (let i = 0; i < values.length; i++) {
    const rowNum = i + 2;
    const [link, report] = values[i];

    if (!link || report) continue;

    const folder = parseFolderFromLink_(link);
    if (!folder) {
      sheet.getRange(rowNum, reportCol).setValue(ERROR_INVALID_LINK);
      continue;
    }

    return { rowNum, reportCol, folder };
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

/**
 * Lists .docx files directly inside a folder (no subfolder recursion).
 * @param {GoogleAppsScript.Drive.Folder} folder
 * @returns {GoogleAppsScript.Drive.File[]}
 */
function listDocxFiles_(folder) {
  const files = [];
  const iterator = folder.getFiles();

  while (iterator.hasNext()) {
    const file = iterator.next();
    if (file.getName().toLowerCase().endsWith('.docx')) {
      files.push(file);
    }
  }

  return files;
}

/**
 * Converts a .docx file to a temporary Google Doc and returns its ID.
 * Caller is responsible for trashing the returned file via trashFile_ when done.
 * @param {string} fileId
 * @returns {string}
 */
function convertDocxToGoogleDoc_(fileId) {
  const converted = Drive.Files.copy(
    { name: `tmp_journal_analyzer_${fileId}`, mimeType: MimeType.GOOGLE_DOCS },
    fileId
  );
  return converted.id;
}

/**
 * Trashes a Drive file by ID, swallowing errors so cleanup never masks the original failure.
 * @param {string} fileId
 * @returns {void}
 */
function trashFile_(fileId) {
  try {
    DriveApp.getFileById(fileId).setTrashed(true);
  } catch (e) {
    Logger.log(`Cleanup failed for ${fileId}: ${e}`);
  }
}

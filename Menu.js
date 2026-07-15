/**
 * Installs the custom menu when the spreadsheet opens.
 * @param {GoogleAppsScript.Events.SheetsOnOpen} e
 * @returns {void}
 */
function onOpen(e) {
  SpreadsheetApp.getUi()
    .createMenu('Journal Analyzer')
    .addItem('Run analysis', 'runAnalyzer')
    .addToUi();
}

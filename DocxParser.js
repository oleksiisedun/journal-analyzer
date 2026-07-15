/**
 * Extracts the first DD.MM.YYYY, DD.MM.YY, DD_MM_YYYY, or DD-MM-YYYY date found in a filename, as an ISO YYYY-MM-DD string.
 * @param {string} name
 * @returns {string|null}
 */
function extractDateFromFilename_(name) {
  const match = name.match(/(\d{2})[._-](\d{2})[._-](\d{4}|\d{2})/);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = match[3].length === 2 ? `20${match[3]}` : match[3];

  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  return `${year}-${match[2]}-${match[1]}`;
}

/**
 * Recursively walks a document body (paragraphs and table cells) into an ordered array of text lines.
 * @param {GoogleAppsScript.Document.Body} body
 * @returns {string[]}
 */
function extractLines_(body) {
  const lines = [];
  walkElement_(body, lines);
  return lines;
}

/**
 * @param {GoogleAppsScript.Document.Element} element
 * @param {string[]} lines
 * @returns {void}
 */
function walkElement_(element, lines) {
  if (typeof element.getNumChildren !== 'function') return;

  const numChildren = element.getNumChildren();
  for (let i = 0; i < numChildren; i++) {
    const child = element.getChild(i);
    const type = child.getType();

    if (type === DocumentApp.ElementType.PARAGRAPH || type === DocumentApp.ElementType.LIST_ITEM) {
      child.getText().split('\n').forEach((line) => lines.push(line));
    } else {
      walkElement_(child, lines);
    }
  }
}

/**
 * Scans document lines for personnel entries under matching position headers.
 * A block ends on: a line matching headerRegex (starts a new block instead), a quoted
 * "position name"-shaped line that does NOT match headerRegex (some other position), a
 * line longer than HEADER_LINE_MAX_LENGTH (non-personnel text), a blank line, or a line
 * with no whitespace (a single word can't be a "rank + surname + initials" name).
 * @param {string[]} lines
 * @param {RegExp} headerRegex
 * @returns {string[]} trimmed personnel entries, in document order
 */
function scanLinesForPersonnel_(lines, headerRegex) {
  const entries = [];
  let inMatchingBlock = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      inMatchingBlock = false;
      continue;
    }

    if (headerRegex.test(line)) {
      inMatchingBlock = true;
      continue;
    }

    const isSingleWord = !/\s/.test(line);

    if (GENERIC_POSITION_HEADER_REGEX.test(line) || line.length > HEADER_LINE_MAX_LENGTH || isSingleWord) {
      inMatchingBlock = false;
      continue;
    }

    if (inMatchingBlock) entries.push(line);
  }

  return entries;
}

/**
 * Collapses a sorted array of unique ISO dates (YYYY-MM-DD) into a semicolon-joined
 * string of DD.MM.YYYY dates/ranges, merging consecutive calendar days.
 * @param {string[]} isoDatesSortedAscUnique
 * @returns {string}
 */
function collapseDatesToRanges_(isoDatesSortedAscUnique) {
  const ranges = [];
  let i = 0;

  while (i < isoDatesSortedAscUnique.length) {
    const start = isoDatesSortedAscUnique[i];
    let end = start;
    let j = i + 1;

    while (j < isoDatesSortedAscUnique.length && isNextDay_(end, isoDatesSortedAscUnique[j])) {
      end = isoDatesSortedAscUnique[j];
      j++;
    }

    ranges.push(start === end ? toDMY_(start) : `${toDMY_(start)}-${toDMY_(end)}`);
    i = j;
  }

  return ranges.join('; ');
}

/**
 * @param {string} isoA
 * @param {string} isoB
 * @returns {boolean}
 */
function isNextDay_(isoA, isoB) {
  const a = new Date(`${isoA}T00:00:00`);
  const b = new Date(`${isoB}T00:00:00`);
  return Math.round((b - a) / 86400000) === 1;
}

/**
 * @param {string} iso
 * @returns {string}
 */
function toDMY_(iso) {
  const [year, month, day] = iso.split('-');
  return `${day}.${month}.${year}`;
}

/**
 * Builds the final multi-line report text, one line per person.
 * @param {string[]} personOrder identities in first-appearance order
 * @param {Object<string, Object<string, boolean>>} personDates identity -> set (as object) of ISO dates
 * @returns {string}
 */
function buildReportText_(personOrder, personDates) {
  return personOrder
    .map((identity) => {
      const isoDates = Object.keys(personDates[identity]).sort();
      const rangesText = collapseDatesToRanges_(isoDates);
      return `${identity} — ${isoDates.length} — ${rangesText}`;
    })
    .join('\n');
}

/**
 * Builds a single regex matching a position-header line for any of the given position
 * names, using POSITION_HEADER_TEMPLATE as the per-name shape.
 * @param {string[]} positionNames non-empty, already-trimmed position names
 * @returns {RegExp}
 */
function buildPositionHeaderRegex_(positionNames) {
  const alternation = positionNames.map(escapeRegExp_).join('|');
  const source = POSITION_HEADER_TEMPLATE.replace('POSITION_NAME', `(?:${alternation})`);
  return new RegExp(source);
}

/**
 * Escapes a string for safe interpolation into a RegExp source.
 * @param {string} text
 * @returns {string}
 */
function escapeRegExp_(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Scans document lines for personnel entries under matching position headers.
 * Each line has a leading list-number marker (e.g. "1)", "2.") and a leading role label
 * (e.g. "Пілот:", "Штурман:" — LEADING_ROLE_LABELS in Config.js) stripped before any other
 * check, so neither distorts word-count/header/block-end detection. Lines matching any of
 * IGNORE_LINE_REGEXES are then skipped entirely before any other check — they
 * neither end nor extend the current block, and are never recorded as personnel.
 * A block ends on: a line matching headerRegex (starts a new block instead), a quoted
 * "position name"-shaped line that does NOT match headerRegex (some other position), a
 * blank line, a line matching any of BLOCK_END_REGEXES (other known non-personnel markers),
 * or a line matching none of RANK_REGEXES (Config.js — recognized rank prefixes; a personnel
 * line always starts with a military rank, so a line without one isn't a person). Rank is
 * the source of truth for "is this a person" — there is no separate word-count check.
 * @param {string[]} lines
 * @param {RegExp} headerRegex
 * @returns {string[]} trimmed personnel entries (see trimTrailingPunctuation_), in document order
 */
function scanLinesForPersonnel_(lines, headerRegex) {
  const entries = [];
  let inMatchingBlock = false;

  for (const rawLine of lines) {
    const line = rawLine.trim().replace(LEADING_LIST_NUMBER_REGEX, '').replace(LEADING_ROLE_LABEL_REGEX, '');

    if (IGNORE_LINE_REGEXES.some((regex) => regex.test(line))) continue;

    if (!line) {
      inMatchingBlock = false;
      continue;
    }

    if (headerRegex.test(line)) {
      inMatchingBlock = true;
      continue;
    }

    const matchesBlockEndRegex = BLOCK_END_REGEXES.some((regex) => regex.test(line));
    const hasRank = RANK_REGEXES.some((regex) => regex.test(line));

    if (
      GENERIC_POSITION_HEADER_REGEX.test(line) ||
      matchesBlockEndRegex ||
      !hasRank
    ) {
      inMatchingBlock = false;
      continue;
    }

    if (inMatchingBlock) entries.push(trimTrailingPunctuation_(line));
  }

  return entries;
}

/**
 * Strips a trailing run of ";" (always) and a trailing run of "." — but only when that
 * dot isn't a single-letter initial's dot (e.g. keeps "Іванов О.В." intact, while still
 * stripping a genuine stray trailing "." that source docs sometimes append).
 * @param {string} line
 * @returns {string}
 */
function trimTrailingPunctuation_(line) {
  const withoutSemicolons = line.replace(/;+$/, '');
  if (TRAILING_INITIAL_REGEX.test(withoutSemicolons)) return withoutSemicolons;
  return withoutSemicolons.replace(/\.+$/, '');
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

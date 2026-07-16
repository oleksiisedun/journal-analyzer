# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Google Apps Script (clasp-managed) project bound to a Google Sheet. It automates reading daily `.docx` personnel-status reports out of a Google Drive folder and writing an attendance summary back into the sheet. There is no local runtime — all code executes in the Apps Script sandbox against the Sheets, Drive, and Docs services.

## Commands

- `clasp push` — deploy local `.js`/`.json` files to the live Apps Script project (script ID in `.clasp.json`).
- `clasp pull` — pull the live project's state back down (useful if the Apps Script editor may have diverged from these files).
- `clasp open` — open the Apps Script editor in the browser (useful to verify Advanced Service method/field names via autocomplete, or to read execution logs).
- There is no build step, linter, or test suite in this project — Apps Script runs the `.js` files directly, and correctness is verified by running `runAnalyzer` against a real Sheet/Drive folder.

## Sheet contract

The bound spreadsheet must have a sheet named `Main` (`MAIN_SHEET_NAME` in `Config.js`). Each row is one analysis job:

- `B` (`FOLDER_LINK_COLUMN`) — a Drive folder link or bare folder ID
- `C` (`REGEX_COLUMN`) — a regex string matching every position-header line in that folder's `.docx` files (e.g. `ПВ\s+[«"“].+[»"”]`)
- `D` (`REPORT_COLUMN`) — output; empty until processed

Running the "Journal Analyzer → Run analysis" menu item processes exactly **one** row per invocation: the first row (top to bottom) with non-empty B/C and empty D. Multiple rows require multiple menu invocations.

## Architecture

Apps Script concatenates every `.js` file in the project into one global scope — file boundaries here are purely organizational, not module boundaries. Execution flows in one direction: `Menu.js` (`onOpen`) installs the custom menu, which calls `Code.js`'s `runAnalyzer` (the orchestrator). It asks `SheetUtils.js` (`findTargetRow_`) for the next eligible row, then for each `.docx` file in that row's folder calls `DriveUtils.js` (`convertDocxToGoogleDoc_` / `trashFile_`) and `DocxParser.js` (`extractDateFromFilename_`, `extractLines_`) to produce a flat array of text lines, which `ReportBuilder.js` (`scanLinesForPersonnel_`, `buildReportText_`) scans into the final report text written back to the sheet. See `README.md` for a diagram of this flow.

Key points a future change is likely to touch:

- **`.docx` can't be read directly** — Apps Script has no native `.docx` parser. `DriveUtils.convertDocxToGoogleDoc_` uses the Drive Advanced Service (`Drive.Files.copy` with `mimeType: MimeType.GOOGLE_DOCS`, enabled in `appsscript.json`) to make a throwaway Google Doc, which is opened with `DocumentApp` for text extraction and always trashed in a `finally` (`Code.js:processFile_`). If the copy call ever throws on the `name` field, the Advanced Service may be bound to v2 instead of v3, where the field is `title`.
- **Line extraction is a generic recursive walk** (`DocxParser.js:walkElement_`) over the whole document body — it doesn't special-case tables; `PARAGRAPH`/`LIST_ITEM` elements are the only leaf nodes that produce lines, everything else (including tables, rows, cells) is just recursed into.
- **The personnel state machine** (`ReportBuilder.js:scanLinesForPersonnel_`) is the core parsing logic and the most likely place for edge-case bugs. It walks lines with a single `inMatchingBlock` flag. A block starts when a line matches the row's `headerRegex`, and ends on any of: a blank line, a line with fewer than 3 whitespace-separated words (a "rank + surname + initials" name always has at least 3), a line longer than `HEADER_LINE_MAX_LENGTH` (100) chars, a line shaped like a position header (`GENERIC_POSITION_HEADER_REGEX`) that did *not* match `headerRegex` (i.e. some other position mixed into the same file), or a line matching any of `BLOCK_END_REGEXES` (`Config.js` — other known non-personnel markers, e.g. `ппд`, `бпла`). Only lines encountered while inside a matching block are recorded as personnel.
- **Person identity is the exact trimmed line text** (rank + name together, e.g. `с-нт ГЛАДКИЙ А.В.`) — not normalized. The same person with a different rank prefix on a different date is treated as a different person by design.
- **Dates are tracked as a per-person set of ISO strings** (built in `Code.js:processFolder_` as `personDates` — a plain object keyed by identity then by date, not a JS `Set`), de-duplicating repeated listings, then `ReportBuilder.collapseDatesToRanges_` renders them back to `DD.MM.YYYY`, merging consecutive calendar days into ranges. Row order in the final report is first-appearance order, which falls out of processing files sorted by their filename-derived date ascending.
- **Concurrent runs are serialized, not queued**: `runAnalyzer` (`Code.js`) acquires `LockService.getScriptLock()` with a 5s timeout before touching the sheet. If another invocation is already holding the lock, the new one alerts "Analyzer is already running, try again shortly." and returns immediately rather than waiting.
- **Column positions are resolved at runtime, not hardcoded**: `Config.js` defines `FOLDER_LINK_COLUMN` / `REGEX_COLUMN` / `REPORT_COLUMN` as open-ended A1 ranges (e.g. `'D2:D'`), and `SheetUtils.columnNumber_` converts one to a numeric index via `sheet.getRange(a1).getColumn()`.
- **Invalid or empty outcomes are written back to D**, never left blank, so a row is never silently reprocessed or silently skipped forever: `ERROR_INVALID_LINK` / `ERROR_INVALID_REGEX` for rows that fail validation, `NO_FILES_MARKER` / `NO_MATCH_MARKER` for folders that produce nothing. Files that fail to process (undated filename, conversion error) are collected into `skippedFiles` and surfaced via `SpreadsheetApp.getUi().alert` after the run.

## Required OAuth scope

Because the script must read arbitrary pre-existing Drive folders (not just files it created itself), it needs the broad `.../auth/drive` scope, not `drive.file`. `appsscript.json` intentionally leaves `oauthScopes` unset so Apps Script auto-detects the required scopes from code rather than needing manual upkeep.

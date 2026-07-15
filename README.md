# Journal Analyzer

A Google Apps Script (clasp-managed) project bound to a Google Sheet. It automates reading daily `.docx` personnel-status reports out of a Google Drive folder and writing an attendance summary back into the sheet.

## Setup

1. `clasp login` (once per machine).
2. `clasp push` to deploy the local `.js`/`.json` files to the live Apps Script project (script ID in `.clasp.json`).
3. `clasp open` to open the Apps Script editor — useful to confirm the Drive Advanced Service is enabled with no error, or to read execution logs.
4. Reload the bound spreadsheet to pick up the "Journal Analyzer" custom menu.

## Sheet contract

The bound spreadsheet must have a sheet named `Main`. Each row is one analysis job:

- **B** — a Google Drive folder link or bare folder ID
- **C** — a regex string matching every position-header line in that folder's `.docx` files (e.g. `ПВ\s+[«"“].+[»"”]`)
- **D** — output; empty until processed

Running "Journal Analyzer → Run analysis" processes exactly **one** row per invocation: the first row (top to bottom) with non-empty B/C and empty D. Multiple rows require multiple menu invocations.

Each `.docx` filename must contain a date (`DD.MM.YYYY` or `DD.MM.YY`) identifying the day it reports on. The output written to D is one line per person, in order of first appearance across the processed files:

```
с-нт ІВАНОВ А.В. — 4 — 01.06.2026; 03.06.2026-05.06.2026
```

## Architecture

Apps Script concatenates every `.js` file in the project into one global scope — file boundaries here are purely organizational, not module boundaries. `Menu.js` installs the custom menu, which calls the orchestrator in `Code.js`. It asks `SheetUtils.js` for the next eligible row, then for each `.docx` file in that row's folder uses `DriveUtils.js` to convert it to a temporary Google Doc and `DocxParser.js` to pull out its text lines. `ReportBuilder.js` scans those lines for personnel entries and builds the final report text, which is written back to the sheet.

```mermaid
graph TD
  Menu["Menu.js\nonOpen"] --> Code

  subgraph Code["Code.js — orchestrator"]
    runAnalyzer --> processFolder_
    processFolder_ --> processFile_
  end

  runAnalyzer --> SheetUtils["SheetUtils.js\nfindTargetRow_"]
  processFolder_ --> DocxParser1["DocxParser.js\nextractDateFromFilename_"]
  processFile_ --> DriveUtils["DriveUtils.js\nconvertDocxToGoogleDoc_ / trashFile_"]
  processFile_ --> DocxParser2["DocxParser.js\nextractLines_"]
  processFile_ --> ReportBuilder1["ReportBuilder.js\nscanLinesForPersonnel_"]
  processFolder_ --> ReportBuilder2["ReportBuilder.js\nbuildReportText_"]

  DriveUtils --> Drive[("Google Drive")]
  DocxParser2 --> Docs[("Google Docs\n(temp conversion)")]
  SheetUtils --> Sheet[("Main sheet")]
  ReportBuilder2 --> Sheet
```

See `CLAUDE.md` for implementation-level detail on the parsing state machine, identity/date-tracking rules, and other non-obvious invariants.

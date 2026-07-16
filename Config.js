const MAIN_SHEET_NAME = 'Main';
const HEADER_LINE_MAX_LENGTH = 100;
const CHUNK_TIME_BUDGET_MS = 1 * 60 * 1000;
const GENERIC_POSITION_HEADER_REGEX = /[«"“].+[»"”]/;
const BLOCK_END_REGEXES = [/ппд/i, /бпла/i];

const FOLDER_LINK_COLUMN = 'B2:B';
const REGEX_COLUMN = 'C2:C';
const REPORT_COLUMN = 'D2:D';

const NO_FILES_MARKER = 'No .docx files found';
const NO_MATCH_MARKER = 'No personnel matched';
const ERROR_INVALID_LINK = 'ERROR: invalid folder link';
const ERROR_INVALID_REGEX = 'ERROR: invalid regex';

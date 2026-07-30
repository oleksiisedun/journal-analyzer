const POSITION_HEADER_TEMPLATE = '^.+[«"“]POSITION_NAME[»"”].{0,10}$';

const GENERIC_POSITION_HEADER_REGEX = /[«"“].+[»"”]/;
const BLOCK_END_REGEXES = [/ппд/i, /бпла/i];
const IGNORE_LINE_REGEXES = [/заведено:/i, /виведено:/i];

const MAIN_SHEET_NAME = 'Main';
const HANDBOOK_SHEET_NAME = 'Handbook';
const HEADER_LINE_MAX_LENGTH = 100;
const CHUNK_TIME_BUDGET_MS = 1 * 60 * 1000;

const FOLDER_LINK_COLUMN = 'B2:B';
const POSITION_CHOICE_COLUMN = 'C2:C';
const REPORT_COLUMN = 'D2:D';

const POSITION_LIST_COLUMNS = {
  '170': 'A2:A',
  '70': 'B2:B',
};

const NO_FILES_MARKER = 'No .docx files found';
const NO_MATCH_MARKER = 'No personnel matched';
const ERROR_INVALID_LINK = 'ERROR: invalid folder link';
const ERROR_INVALID_POSITION_LIST = 'ERROR: invalid position list';

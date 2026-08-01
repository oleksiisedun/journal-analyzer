const POSITION_HEADER_TEMPLATE = '^.+[«"“]POSITION_NAME[»"”].*$';

const GENERIC_POSITION_HEADER_REGEX = /[«"“].+[»"”]/;
const BLOCK_END_REGEXES = [/ппд/i, /бпла/i];
const RANK_REGEXES = [
  /солд/i,
  /серж/i,
  /лейт/i,
  /капітан/i,
  /майор/i,
  /полковник/i
];
const LEADING_LIST_NUMBER_REGEX = /^\d+[).]\s*/;
const LEADING_ROLE_LABELS = ['Пілот', 'Штурман'];
const LEADING_ROLE_LABEL_REGEX = new RegExp(`^(?:${LEADING_ROLE_LABELS.join('|')}):\\s*`, 'i');
const TRAILING_INITIAL_REGEX = /\p{Lu}\.$/u;
const IGNORE_LINE_REGEXES = [
  /заведено:/i,
  /виведено:/i,
  /заходить:/i,
  /виходить:/i,
  /провідник/i
];

const MAIN_SHEET_NAME = 'Main';
const HANDBOOK_SHEET_NAME = 'Handbook';
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

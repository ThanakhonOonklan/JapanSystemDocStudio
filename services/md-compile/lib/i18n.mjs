// Labels used by the generated parts of a document (cover, table of
// contents, figure/table captions, cross-references).

const STRINGS = {
  th: {
    contents: 'สารบัญ',
    listOfFigures: 'สารบัญภาพ',
    listOfTables: 'สารบัญตาราง',
    page: 'หน้า',
    continued: '(ต่อ)',
    chapter: 'บทที่',
    section: 'หัวข้อ',
    figure: 'ภาพที่',
    note: 'หมายเหตุ',
    table: 'ตารางที่',
    version: 'เวอร์ชัน',
    author: 'ผู้จัดทำ',
    organization: 'หน่วยงาน',
    date: 'วันที่',
    preparedBy: 'จัดทำโดย',
  },
  en: {
    contents: 'Contents',
    listOfFigures: 'List of Figures',
    listOfTables: 'List of Tables',
    page: 'Page',
    continued: '(continued)',
    chapter: 'Chapter',
    section: 'Section',
    figure: 'Figure',
    note: 'Note',
    table: 'Table',
    version: 'Version',
    author: 'Author',
    organization: 'Organization',
    date: 'Date',
    preparedBy: 'Prepared by',
  },
}

/**
 * @param {string} lang
 * @param {{ chapter?: string }} [overrides] e.g. { chapter: 'ขั้นที่' } for a
 *        workflow whose top-level parts are steps, not chapters; '' = the
 *        number alone ("2  การเข้าสู่ระบบ")
 */
export function strings(lang, overrides = {}) {
  const base = String(lang || 'en').toLowerCase().split('-')[0]
  const found = STRINGS[base] || STRINGS.en
  return overrides.chapter !== undefined && overrides.chapter !== null
    ? { ...found, chapter: String(overrides.chapter) }
    : found
}

/** "บทที่ 2", or just "2" when the label is empty */
export function numberedLabel(label, number) {
  return label ? `${label} ${number}` : `${number}`
}

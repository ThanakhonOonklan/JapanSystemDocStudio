// Labels used by the generated parts of a document (cover, table of
// contents, figure/table captions, cross-references).

const STRINGS = {
  th: {
    contents: 'สารบัญ',
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

export function strings(lang) {
  const base = String(lang || 'en').toLowerCase().split('-')[0]
  return STRINGS[base] || STRINGS.en
}

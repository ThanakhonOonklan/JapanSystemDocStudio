// Document templates. A template is a stylesheet plus default options; any
// option can still be overridden in book.yaml.
//
//   template: user-manual   (the default) a user manual: TH Sarabun New 16pt,
//                           A4 margins 1.5/1/1/1.5 in, cover, contents,
//                           "บทที่ N" chapter headings, framed screenshots
//                           numbered "ภาพที่ 1-1", Thai-letter page numbers in
//                           the front matter and Arabic numbers at the top
//                           right from chapter 1
//
// `template: default` in older projects means the same template.

import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))

const userManual = {
  name: 'user-manual',
  css: path.join(here, 'templates', 'user-manual.css'),
  defaults: {
    chapterHeading: 'label-break',
    // figures and tables are numbered "chapter-n" (ภาพที่ 4-8)
    numberSeparator: '-',
  },
  pageLabels: {
    frontStart: 1,
    mainStart: 1,
  },
  // families the stylesheet asks for; a missing one is reported
  fonts: ['THSarabunNew'],
  // fonts shipped with the template (a project's Font/ folder can override)
  fontDir: path.join(here, '..', 'fonts'),
}

export const TEMPLATES = {
  'user-manual': userManual,
  default: userManual,
}

export function getTemplate(name) {
  if (name == null) return TEMPLATES.default
  return TEMPLATES[name] ?? null
}

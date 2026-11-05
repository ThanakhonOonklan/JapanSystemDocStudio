// Document templates. A template is a stylesheet plus default options; any
// option can still be overridden in book.yaml.
//
//   template: default          cover, table of contents, numbered headings
//   template: kmutnb-project   Thai project report (KMUTNB): TH Sarabun New
//                              16pt, A4 margins 1.5/1/1.5/1 in, Thai-letter
//                              page numbers in the front matter and Arabic
//                              numbers at the top right from chapter 1

import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))

export const TEMPLATES = {
  default: {
    name: 'default',
    css: path.join(here, 'template.css'),
    defaults: {},
    // null: use the page counters of Paged.js as they are
    pageLabels: null,
    fonts: [],
  },
  'kmutnb-project': {
    name: 'kmutnb-project',
    css: path.join(here, 'templates', 'kmutnb-project.css'),
    defaults: {
      // the front matter of a report (cover, certificate, abstract, lists)
      // is written by the author in the first files of the book
      cover: false,
      toc: false,
      chapterHeading: 'label-break',
    },
    pageLabels: {
      // the certificate page counts as the first page (ก) but shows no number
      frontStart: 2,
      mainStart: 1,
    },
    // families the stylesheet asks for; a missing one is reported
    fonts: ['THSarabunNew'],
  },
}

export function getTemplate(name) {
  if (name == null) return TEMPLATES.default
  return TEMPLATES[name] ?? null
}

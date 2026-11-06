// Contents pages of a manual: สารบัญ, สารบัญภาพ, สารบัญตาราง
// (Contents, List of Figures, List of Tables), in the layout of the
// reference report:
//   - no dotted leaders; the page number is right-aligned
//   - a column header ("หน้า", or "ภาพที่ … หน้า") under the title
//   - pages after the first repeat the title with "(ต่อ)" and the header
//   - chapters read "บทที่ 1  ชื่อบท", sections are indented
//
// The page numbers and the headers of the following pages are written after
// layout (lib/pdf.mjs), because only then is it known which page each entry
// is on and what label that page has (ก ข ค / 1 2 3).

import { escapeHtml } from './render.mjs'
import { strings } from './i18n.mjs'

// ids of the contents pages themselves, so they can be listed too
export const CONTENTS_IDS = { toc: 'contents', lof: 'list-of-figures', lot: 'list-of-tables' }

function entry({ level, id, num, text }) {
  return `<li class="contents-entry contents-${level}"><a href="#${escapeHtml(id)}">${
    num ? `<span class="contents-num">${escapeHtml(num)}</span>` : ''
  }<span class="contents-text">${escapeHtml(text)}</span><span class="contents-page" data-target="${escapeHtml(id)}"></span></a></li>`
}

function section({ kind, id, title, headLeft, t, items }) {
  // data-* tell the page decorator what to draw on the following pages
  return `<section class="contents contents-${kind}" id="${id}" data-kind="front" data-contents="${kind}" data-title="${escapeHtml(title)}" data-continued="${escapeHtml(t.continued)}" data-head-left="${escapeHtml(headLeft)}" data-head-right="${escapeHtml(t.page)}">
<h2 class="contents-title">${escapeHtml(title)}</h2>
<div class="contents-head"><span>${escapeHtml(headLeft)}</span><span>${escapeHtml(t.page)}</span></div>
<ul>
${items.join('\n')}
</ul>
</section>`
}

/**
 * @param {{ headings: Array<{ level: number, id: string, number?: string, text: string }>,
 *           figures: Array<{ id: string, number: string, text: string }>,
 *           tables: Array<{ id: string, number: string, text: string }>,
 *           depth: number, lang: string, chapterHeading?: string,
 *           toc?: boolean, lof?: boolean, lot?: boolean }} options
 */
export function renderContents({
  headings,
  figures = [],
  tables = [],
  depth,
  lang,
  chapterHeading = 'number',
  chapterLabel,
  toc = true,
  lof = true,
  lot = true,
}) {
  const t = strings(lang, { chapter: chapterLabel })
  const hasLof = lof && figures.length > 0
  const hasLot = lot && tables.length > 0
  const parts = []

  if (toc) {
    const items = []
    // the contents pages are listed first, like the reference
    items.push(entry({ level: 1, id: CONTENTS_IDS.toc, text: t.contents }))
    if (hasLof) items.push(entry({ level: 1, id: CONTENTS_IDS.lof, text: t.listOfFigures }))
    if (hasLot) items.push(entry({ level: 1, id: CONTENTS_IDS.lot, text: t.listOfTables }))
    for (const h of headings) {
      if (h.level > depth) continue
      let num = h.number
      if (num && h.level === 1 && ['label-break', 'inline'].includes(chapterHeading)) {
        num = `${t.chapter} ${num}`
      }
      items.push(entry({ level: h.level, id: h.id, num, text: h.text }))
    }
    if (headings.some(h => h.level <= depth)) {
      parts.push(
        section({ kind: 'toc', id: CONTENTS_IDS.toc, title: t.contents, headLeft: '', t, items })
      )
    }
  }
  if (hasLof) {
    const items = figures.map(f => entry({ level: 'item', id: f.id, num: f.number, text: f.text }))
    parts.push(
      section({ kind: 'lof', id: CONTENTS_IDS.lof, title: t.listOfFigures, headLeft: t.figure, t, items })
    )
  }
  if (hasLot) {
    const items = tables.map(f => entry({ level: 'item', id: f.id, num: f.number, text: f.text }))
    parts.push(
      section({ kind: 'lot', id: CONTENTS_IDS.lot, title: t.listOfTables, headLeft: t.table, t, items })
    )
  }
  return parts.join('\n')
}

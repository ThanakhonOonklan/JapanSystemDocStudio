// Page numbers for templates that need their own rules.
//
// Paged.js counters cannot restart at chapter 1 or hide the number on the
// first page of every chapter, so after the pages are laid out we decide the
// label of each page here and write it into the page's margin box.

// Thai alphabet as used for the front matter of reports (ก ข ค ง จ ...).
const THAI_LETTERS = [
  'ก', 'ข', 'ค', 'ง', 'จ', 'ฉ', 'ช', 'ซ', 'ฌ', 'ญ',
  'ฎ', 'ฏ', 'ฐ', 'ฑ', 'ฒ', 'ณ', 'ด', 'ต', 'ถ', 'ท', 'ธ', 'น',
  'บ', 'ป', 'ผ', 'ฝ', 'พ', 'ฟ', 'ภ', 'ม', 'ย', 'ร', 'ล', 'ว',
  'ศ', 'ษ', 'ส', 'ห', 'ฬ', 'อ', 'ฮ',
]

/** 1 -> ก, 2 -> ข, 40 -> ฮ, 41 -> กก, ... */
export function thaiLetter(n) {
  if (!Number.isInteger(n) || n < 1) return ''
  let text = ''
  let rest = n
  while (rest > 0) {
    rest -= 1
    text = THAI_LETTERS[rest % THAI_LETTERS.length] + text
    rest = Math.floor(rest / THAI_LETTERS.length)
  }
  return text
}

/**
 * @param {Array<{ kind: string, chapterStart?: boolean }>} pages in page order
 * @param {{ frontStart?: number, mainStart?: number }} config
 * @returns {Array<{ text: string, position: 'top-right' | 'bottom-center' | null }>}
 *
 * kind `cover`            no number, not counted
 * kind `front`            Thai letters at the bottom centre, from frontStart
 * kind `chapter`, `appendix`, `back` (anything else)
 *                         Arabic numbers at the top right from mainStart;
 *                         counted, but not shown, on the first page of a
 *                         chapter / appendix / bibliography
 */
export function computePageLabels(pages, config = {}) {
  const frontStart = config.frontStart ?? 1
  const mainStart = config.mainStart ?? 1
  let front = frontStart
  let main = mainStart
  return pages.map(page => {
    if (page.kind === 'cover') {
      return { text: '', position: null }
    }
    if (page.kind === 'front') {
      return { text: thaiLetter(front++), position: 'bottom-center' }
    }
    const number = main++
    return {
      text: page.chapterStart ? '' : String(number),
      position: 'top-right',
    }
  })
}

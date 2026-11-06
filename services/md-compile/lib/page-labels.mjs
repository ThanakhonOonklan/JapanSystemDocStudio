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

const ROMAN = [
  [1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'],
  [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i'],
]

/** 1 -> i, 4 -> iv, 14 -> xiv */
export function roman(n) {
  if (!Number.isInteger(n) || n < 1) return ''
  let text = ''
  let rest = n
  for (const [value, letters] of ROMAN) {
    while (rest >= value) {
      text += letters
      rest -= value
    }
  }
  return text
}

/**
 * @param {Array<{ kind: string, chapterStart?: boolean }>} pages in page order
 * @param {{ frontStart?: number, mainStart?: number, frontStyle?: 'thai' | 'roman' }} config
 * @returns {Array<{ text: string, number: string, position: 'top-right' | 'bottom-center' | null }>}
 *   text: what is printed on the page; number: the page's number even when
 *   it is not printed (used by the contents pages)
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
  // Thai letters (ก ข ค) or lower-case roman numerals (i ii iii)
  const format = { front: config.frontStyle === 'roman' ? roman : thaiLetter }
  let front = frontStart
  let main = mainStart
  return pages.map(page => {
    if (page.kind === 'cover') {
      return { text: '', number: '', position: null }
    }
    if (page.kind === 'front') {
      const letter = format.front(front++)
      return { text: letter, number: letter, position: 'bottom-center' }
    }
    const number = String(main++)
    return {
      text: page.chapterStart ? '' : number,
      number,
      position: 'top-right',
    }
  })
}

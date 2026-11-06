// Project fonts: every .ttf/.otf/.woff/.woff2 in a Font/ (or fonts/) folder of
// the project is made available to the document with @font-face. The family
// and style come from the file name, e.g.
//
//   Font/THSarabunNew.ttf             -> family THSarabunNew, regular
//   Font/THSarabunNew Bold.ttf        -> bold
//   Font/THSarabunNew BoldItalic.ttf  -> bold italic
//
// so a book can keep its own fonts next to its text.

import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const FONT_DIRS = ['Font', 'Fonts', 'font', 'fonts']
const FONT_FILE = /\.(ttf|otf|woff2?)$/i
const STYLE_SUFFIX = /^(.*?)[\s_-]*(bold[\s_-]*italic|bold[\s_-]*oblique|bold|italic|oblique|regular)?$/i

const FORMATS = {
  '.ttf': 'truetype',
  '.otf': 'opentype',
  '.woff': 'woff',
  '.woff2': 'woff2',
}

/** "THSarabunNew BoldItalic.ttf" -> { family, weight, style } */
export function parseFontName(fileName) {
  const base = fileName.replace(FONT_FILE, '')
  const [, family, suffix = ''] = STYLE_SUFFIX.exec(base)
  const lower = suffix.toLowerCase()
  return {
    family: family.trim() || base,
    weight: lower.includes('bold') ? 700 : 400,
    style: /italic|oblique/.test(lower) ? 'italic' : 'normal',
  }
}

/**
 * @param {string} baseDir folder that holds book.yaml (or the root file)
 * @param {{ direct?: boolean }} [options] direct: baseDir is the font folder
 * @returns {Array<{ family: string, weight: number, style: string, file: string }>}
 */
export function discoverFonts(baseDir, { direct = false } = {}) {
  const fonts = []
  // Font/ and font/ are the same folder on case-insensitive file systems
  const seen = new Set()
  // direct: baseDir is itself the font folder
  for (const dirName of direct ? ['.'] : FONT_DIRS) {
    const dir = path.join(baseDir, dirName)
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) continue
    for (const entry of fs.readdirSync(dir)) {
      if (!FONT_FILE.test(entry)) continue
      const file = path.join(dir, entry)
      const key = fs.realpathSync.native(file).toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      fonts.push({ ...parseFontName(entry), file })
    }
  }
  return fonts
}

export function fontFaceCss(fonts) {
  return fonts
    .map(font => {
      const url = pathToFileURL(font.file).href
      const format = FORMATS[path.extname(font.file).toLowerCase()]
      return (
        `@font-face { font-family: '${font.family.replace(/'/g, '')}'; ` +
        `src: url('${url}') format('${format}'); ` +
        `font-weight: ${font.weight}; font-style: ${font.style}; }`
      )
    })
    .join('\n')
}

export function fontFamilies(fonts) {
  return [...new Set(fonts.map(font => font.family))]
}

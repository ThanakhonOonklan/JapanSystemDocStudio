// Reads the root file of a project and works out what has to be built.
//
// Two kinds of root file are supported:
//
//   book.yaml / book.yml   a book with chapters, optionally in several
//                          languages (a folder per language code):
//
//       title:
//         th: คู่มือการใช้งาน
//         en: User manual
//       defaultLanguage: th        # language written to output.pdf
//       languages: [th, en]        # optional, detected from folders
//       chapters:
//         - 01-intro.md
//         - 02-install.md
//
//   *.md                   a single Markdown file (optional YAML front matter
//                          with `title` and `lang`)

import fs from 'node:fs'
import path from 'node:path'
import yaml from 'js-yaml'
import { resolveInside } from './paths.mjs'

const LANGUAGE_DIRS = ['th', 'en']
const FRONT_MATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/

/**
 * Split optional YAML front matter from the Markdown body.
 * `lineOffset` is the number of lines removed, so that line numbers in the
 * body can be mapped back to the file.
 */
export function parseFrontMatter(text) {
  const match = FRONT_MATTER.exec(text)
  if (!match) return { data: {}, body: text, lineOffset: 0 }
  let data = {}
  try {
    data = yaml.load(match[1]) || {}
  } catch {
    // leave data empty; the caller can report a missing title
  }
  return {
    data: typeof data === 'object' ? data : {},
    body: text.slice(match[0].length),
    lineOffset: match[0].split('\n').length - 1,
  }
}

/**
 * A book.yaml value is either a plain value or a map from language code to
 * value, e.g. `title: { th: ..., en: ... }`.
 */
export function localized(value, lang) {
  if (value == null) return undefined
  if (typeof value === 'object' && !Array.isArray(value)) {
    const picked = value[lang] ?? value.default ?? Object.values(value)[0]
    return picked == null ? undefined : String(picked)
  }
  return String(value)
}

const pickTitle = localized

const META_FIELDS = ['subtitle', 'version', 'author', 'organization', 'date']

function pickMeta(source, lang) {
  const meta = {}
  for (const field of META_FIELDS) {
    const value = localized(source?.[field], lang)
    if (value) meta[field] = value
  }
  return meta
}

// Document-level options shared by all languages.
function pickOptions(source) {
  return {
    toc: source?.toc !== false,
    tocDepth: Math.min(Math.max(parseInt(source?.tocDepth, 10) || 3, 1), 4),
    numbering: source?.numbering !== false,
    cover: source?.cover !== false,
    css: typeof source?.css === 'string' ? source.css : undefined,
    // how to treat differences between the languages: warn (default), strict
    // (they fail the build) or off
    parity: ['off', 'strict'].includes(source?.parity) ? source.parity : 'warn',
  }
}

/**
 * @returns {{ defaultLanguage: string,
 *             options: { toc: boolean, tocDepth: number, numbering: boolean, cover: boolean, css?: string, parity: 'warn' | 'strict' | 'off' },
 *             languages: Array<{ code: string, dir?: string, title?: string, meta: Record<string, string>,
 *                                files: string[], chapters: Array<{ name: string, file: string }> }> }}
 */
export function loadProject(compileDir, mainFile, log) {
  const mainPath = resolveInside(compileDir, compileDir, mainFile)
  if (!fs.existsSync(mainPath)) {
    throw new Error(`root file not found: ${mainFile}`)
  }
  const ext = path.extname(mainPath).toLowerCase()

  if (ext === '.yaml' || ext === '.yml') {
    return loadBook(compileDir, mainPath, log)
  }
  return loadSingleFile(compileDir, mainPath)
}

function loadSingleFile(compileDir, mainPath) {
  const text = fs.readFileSync(mainPath, 'utf8')
  const { data, body } = parseFrontMatter(text)
  const code = typeof data.lang === 'string' ? data.lang : 'th'
  const heading = /^#\s+(.+?)\s*$/m.exec(body)
  const options = pickOptions(data)
  // a single file only gets a cover page when it says so in its front matter
  options.cover = data.cover === true || (data.cover !== false && data.title != null)
  return {
    defaultLanguage: code,
    options,
    languages: [
      {
        code,
        title: pickTitle(data.title, code) || heading?.[1],
        meta: pickMeta(data, code),
        files: [mainPath],
        chapters: [{ name: path.basename(mainPath), file: mainPath }],
      },
    ],
  }
}

function loadBook(compileDir, bookPath, log) {
  let book
  try {
    book = yaml.load(fs.readFileSync(bookPath, 'utf8'))
  } catch (err) {
    throw new Error(`cannot parse ${path.basename(bookPath)}: ${err.message}`)
  }
  if (!book || typeof book !== 'object') {
    throw new Error(`${path.basename(bookPath)} is empty`)
  }
  if (!Array.isArray(book.chapters) || book.chapters.length === 0) {
    throw new Error(`${path.basename(bookPath)}: "chapters" must be a non-empty list`)
  }

  const baseDir = path.dirname(bookPath)
  const configured = Array.isArray(book.languages) ? book.languages : null
  const detected = LANGUAGE_DIRS.filter(code =>
    fs.existsSync(path.join(baseDir, code))
  )
  const codes = (configured || (detected.length > 0 ? detected : [null])).map(c =>
    c == null ? (book.defaultLanguage || 'th') : String(c)
  )

  const bookLines = fs.readFileSync(bookPath, 'utf8').split('\n')
  const lineInBook = chapter => {
    const index = bookLines.findIndex(
      l => /^\s*-\s/.test(l) && l.includes(chapter)
    )
    return index >= 0 ? index + 1 : undefined
  }

  const languages = codes.map(code => {
    // chapters live in <code>/ when that folder exists, otherwise next to book.yaml
    const langDir = path.join(baseDir, code)
    const hasDir = fs.existsSync(langDir)
    const dir = hasDir ? langDir : baseDir
    const files = []
    const chapters = []
    for (const chapter of book.chapters) {
      if (typeof chapter !== 'string') {
        throw new Error('"chapters" must contain file names')
      }
      const file = resolveInside(compileDir, dir, chapter)
      if (!fs.existsSync(file)) {
        log.warn(
          `chapter not found for ${code}: ${path.relative(compileDir, file)}`,
          { file: bookPath, line: lineInBook(chapter) }
        )
        continue
      }
      files.push(file)
      chapters.push({ name: chapter, file })
    }
    return {
      code,
      dir: hasDir ? langDir : undefined,
      title: pickTitle(book.title, code),
      meta: pickMeta(book, code),
      files,
      chapters,
    }
  })

  const defaultLanguage =
    book.defaultLanguage && codes.includes(String(book.defaultLanguage))
      ? String(book.defaultLanguage)
      : codes[0]

  return { defaultLanguage, options: pickOptions(book), languages }
}

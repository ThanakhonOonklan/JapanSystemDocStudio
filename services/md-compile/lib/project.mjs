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

export function parseFrontMatter(text) {
  const match = FRONT_MATTER.exec(text)
  if (!match) return { data: {}, body: text }
  let data = {}
  try {
    data = yaml.load(match[1]) || {}
  } catch {
    // leave data empty; the caller can report a missing title
  }
  return { data: typeof data === 'object' ? data : {}, body: text.slice(match[0].length) }
}

function pickTitle(title, lang) {
  if (typeof title === 'string') return title
  if (title && typeof title === 'object') {
    return title[lang] || title.default || Object.values(title)[0]
  }
  return undefined
}

/**
 * @returns {{ title?: string, defaultLanguage: string,
 *             languages: Array<{ code: string, title?: string, files: string[] }> }}
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
  return {
    defaultLanguage: code,
    languages: [
      {
        code,
        title: pickTitle(data.title, code) || heading?.[1],
        files: [mainPath],
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

  const languages = codes.map(code => {
    // chapters live in <code>/ when that folder exists, otherwise next to book.yaml
    const langDir = path.join(baseDir, code)
    const dir = fs.existsSync(langDir) ? langDir : baseDir
    const files = []
    for (const chapter of book.chapters) {
      if (typeof chapter !== 'string') {
        throw new Error('"chapters" must contain file names')
      }
      const file = resolveInside(compileDir, dir, chapter)
      if (!fs.existsSync(file)) {
        log.warn(`[${code}] chapter not found: ${path.relative(compileDir, file)}`)
        continue
      }
      files.push(file)
    }
    return { code, title: pickTitle(book.title, code), files }
  })

  const defaultLanguage =
    book.defaultLanguage && codes.includes(String(book.defaultLanguage))
      ? String(book.defaultLanguage)
      : codes[0]

  return { defaultLanguage, languages }
}

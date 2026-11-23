// Documentation Studio REA: the outline of a whole book.
//
// A Markdown book is a book.yaml listing chapter files (in a folder per
// language, or next to book.yaml); the outline is those files in order, each
// with its headings. This module is pure (no I/O) so it can be tested.

const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/
const ATTRIBUTES = /\s*\{[^}]*\}\s*$/
const FENCE = /^\s{0,3}(```|~~~)/

/**
 * Headings of one Markdown file, like the editor's own outline
 * (frontend/js/features/source-editor/languages/markdown/outline.ts).
 * Front matter is skipped; lines are numbered from 1 in the file.
 *
 * @param {string[]} lines
 * @returns {{ level: number, title: string, line: number }[]}
 */
export function markdownHeadings(lines) {
  const items = []
  let fence = null
  let start = 0
  if (lines[0] != null && /^---\s*$/.test(lines[0])) {
    const end = lines.findIndex((line, i) => i > 0 && /^---\s*$/.test(line))
    if (end > 0) start = end + 1
  }
  for (let i = start; i < lines.length; i++) {
    const text = lines[i]
    const fenceMatch = FENCE.exec(text)
    if (fenceMatch) {
      if (fence === null) fence = fenceMatch[1]
      else if (fence === fenceMatch[1]) fence = null
      continue
    }
    if (fence !== null) continue
    const match = HEADING.exec(text)
    if (!match) continue
    const title = match[2].replace(ATTRIBUTES, '').trim()
    if (title) items.push({ level: match[1].length, title, line: i + 1 })
  }
  return items
}

const unquote = value => {
  const v = value.trim()
  return /^(['"]).*\1$/.test(v) ? v.slice(1, -1) : v
}

/**
 * The few fields of book.yaml the outline needs. Not a YAML parser: it reads
 * the shapes md-compile documents (`chapters:` as a list of file names or
 * `- file: name`, `defaultLanguage:`, `languages: [th, en]`).
 *
 * @param {string} text
 * @returns {{ chapters: { file: string, kind?: string }[], defaultLanguage?: string, languages?: string[] }}
 */
export function parseBookYaml(text) {
  const result = { chapters: [] }
  const lines = text.split(/\r?\n/)
  let inChapters = false
  let current = null
  for (const raw of lines) {
    const line = raw.replace(/\s+#.*$/, '').replace(/^#.*$/, '')
    if (line.trim() === '') continue
    const top = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(line)
    if (top) {
      inChapters = top[1] === 'chapters'
      current = null
      const value = top[2].trim()
      if (top[1] === 'defaultLanguage' && value) {
        result.defaultLanguage = unquote(value)
      } else if (top[1] === 'languages' && value.startsWith('[')) {
        result.languages = value
          .replace(/^\[|\]$/g, '')
          .split(',')
          .map(unquote)
          .filter(Boolean)
      }
      continue
    }
    if (!inChapters) continue
    const item = /^\s*-\s+(.*)$/.exec(line)
    if (item) {
      const value = item[1].trim()
      const keyed = /^file\s*:\s*(.+)$/.exec(value)
      current = { file: unquote(keyed ? keyed[1] : value) }
      result.chapters.push(current)
      continue
    }
    const kind = /^\s+kind\s*:\s*(.+)$/.exec(line)
    if (kind && current) current.kind = unquote(kind[1])
  }
  return result
}

const normalise = p => p.replaceAll('\\', '/').replace(/^\/+/, '')

/**
 * @param {Record<string, string[]>} docs project path -> lines
 * @param {{ language?: string }} [options]
 * @returns {{ source: 'book' | 'files', language?: string,
 *             languages: string[],
 *             files: { file: string, kind?: string,
 *                      headings: { level: number, title: string, line: number }[] }[] }}
 */
export function buildBookOutline(docs, options = {}) {
  const byPath = new Map(Object.entries(docs).map(([p, l]) => [normalise(p), l]))
  const bookPath = ['book.yaml', 'book.yml'].find(p => byPath.has(p))

  if (!bookPath) {
    const files = [...byPath.keys()]
      .filter(p => /\.(md|markdown)$/i.test(p))
      .sort()
      .map(file => ({ file, headings: markdownHeadings(byPath.get(file)) }))
    return { source: 'files', languages: [], files }
  }

  const book = parseBookYaml(byPath.get(bookPath).join('\n'))
  // the language folders that exist, like md-compile detects them
  const detected = ['th', 'en'].filter(code =>
    [...byPath.keys()].some(p => p.startsWith(`${code}/`))
  )
  const languages = book.languages?.length ? book.languages : detected
  const wanted = options.language ?? book.defaultLanguage ?? languages[0]
  const language = languages.includes(wanted) ? wanted : languages[0]
  const dir = language && detected.includes(language) ? `${language}/` : ''

  const files = []
  for (const chapter of book.chapters) {
    const file = normalise(`${dir}${chapter.file}`)
    const lines = byPath.get(file)
    if (!lines) continue
    files.push({
      file,
      ...(chapter.kind ? { kind: chapter.kind } : {}),
      headings: markdownHeadings(lines),
    })
  }
  return { source: 'book', language, languages, files }
}

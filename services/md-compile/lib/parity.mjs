// Compares the structure of the languages of a book.
//
// Every language folder (th/, en/) holds the same chapter files. Headings,
// numbered figures and numbered tables that carry an explicit {#id} are
// matched across languages by that id. Differences are reported where the
// fix has to be made, e.g. a heading that is missing in en/02-install.md is
// reported on that file, near the place it belongs.

import fs from 'node:fs'
import path from 'node:path'

const KIND_LABEL = { heading: 'heading', figure: 'figure', table: 'table' }

function describe(element) {
  return element.kind === 'heading'
    ? `heading level ${element.level}`
    : KIND_LABEL[element.kind]
}

function listMarkdown(dir) {
  const found = []
  const walk = current => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (/\.md$/i.test(entry.name)) {
        found.push(path.relative(dir, full).split(path.sep).join('/'))
      }
    }
  }
  if (dir && fs.existsSync(dir)) walk(dir)
  return found
}

/**
 * @param {object} args
 * @param {Array<{ code: string, dir?: string,
 *                 chapters: Array<{ name: string, file: string }>,
 *                 structure: Array<{ file: string, line?: number, kind: string, level?: number, id: string, explicit: boolean }> }>} args.languages
 * @param {string} args.reference  code of the language the others are compared to
 * @param {string} args.compileDir
 * @param {(message: string, location: { file: string, line?: number }) => void} args.report
 * @returns {number} number of differences reported
 */
export function checkParity({ languages, reference, compileDir, report }) {
  let count = 0
  const emit = (message, location) => {
    count++
    report(message, location)
  }
  const rel = file => path.relative(compileDir, file).split(path.sep).join('/')

  const ref = languages.find(l => l.code === reference)
  if (!ref) return 0

  for (const other of languages) {
    if (other === ref) continue
    compareLanguages(ref, other, emit, rel)
  }
  return count
}

function elementsOf(language, file) {
  return language.structure.filter(element => element.file === file)
}

function compareLanguages(ref, other, emit, rel) {
  // files that exist in one language folder only
  if (ref.dir && other.dir) {
    const refFiles = new Set(listMarkdown(ref.dir))
    const otherFiles = new Set(listMarkdown(other.dir))
    // reported on the file that exists, so that it can be opened from the log
    for (const name of refFiles) {
      if (!otherFiles.has(name)) {
        emit(`no ${other.code} counterpart: ${other.code}/${name} is missing`, {
          file: path.join(ref.dir, name),
          line: 1,
        })
      }
    }
    for (const name of otherFiles) {
      if (!refFiles.has(name)) {
        emit(`no ${ref.code} counterpart: ${ref.code}/${name} is missing`, {
          file: path.join(other.dir, name),
          line: 1,
        })
      }
    }
  }

  const otherByName = new Map(other.chapters.map(c => [c.name, c]))
  for (const chapter of ref.chapters) {
    const counterpart = otherByName.get(chapter.name)
    if (!counterpart) continue // reported when the book was loaded
    compareChapter({
      a: { code: ref.code, name: chapter.name, file: chapter.file, elements: elementsOf(ref, chapter.file) },
      b: { code: other.code, name: chapter.name, file: counterpart.file, elements: elementsOf(other, counterpart.file) },
      emit,
      rel,
    })
  }
}

function compareChapter({ a, b, emit, rel }) {
  const explicitA = a.elements.filter(e => e.explicit)
  const explicitB = b.elements.filter(e => e.explicit)
  const byIdA = new Map(explicitA.map(e => [e.id, e]))
  const byIdB = new Map(explicitB.map(e => [e.id, e]))

  // present in a, missing in b: report in b, after the last element they share
  let anchor
  for (const element of explicitA) {
    const match = byIdB.get(element.id)
    if (match) {
      anchor = match
    } else {
      emit(
        `missing in ${b.code}: ${describe(element)} #${element.id} exists in ${rel(a.file)}`,
        { file: b.file, line: anchor?.line ?? 1 }
      )
    }
  }
  // present in b, missing in a: report in a
  anchor = undefined
  for (const element of explicitB) {
    const match = byIdA.get(element.id)
    if (match) {
      anchor = match
    } else {
      emit(
        `missing in ${a.code}: ${describe(element)} #${element.id} exists in ${rel(b.file)}`,
        { file: a.file, line: anchor?.line ?? 1 }
      )
    }
  }

  // same id but a different kind of element or heading level
  for (const element of explicitB) {
    const match = byIdA.get(element.id)
    if (!match) continue
    if (match.kind !== element.kind || match.level !== element.level) {
      emit(
        `#${element.id} is a ${describe(element)} here but a ${describe(match)} in ${rel(a.file)}`,
        { file: b.file, line: element.line }
      )
    }
  }

  // same elements in a different order
  const sequenceA = explicitA.filter(e => byIdB.has(e.id))
  const sequenceB = explicitB.filter(e => byIdA.has(e.id))
  for (let i = 0; i < sequenceA.length; i++) {
    if (sequenceA[i].id !== sequenceB[i].id) {
      emit(
        `order differs from ${rel(a.file)}: expected #${sequenceA[i].id} here but found #${sequenceB[i].id}`,
        { file: b.file, line: sequenceB[i].line }
      )
      break
    }
  }

  // elements without an id can only be compared by number
  for (const kind of Object.keys(KIND_LABEL)) {
    const countA = a.elements.filter(e => !e.explicit && e.kind === kind).length
    const countB = b.elements.filter(e => !e.explicit && e.kind === kind).length
    if (countA !== countB) {
      const plural = n => `${n} ${kind}${n === 1 ? '' : 's'}`
      emit(
        `${b.code} has ${plural(countB)} without an id but ${a.code} has ${plural(countA)}: add {#id} so they can be matched`,
        { file: b.file, line: 1 }
      )
    }
  }
}

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { Log } from '../lib/log.mjs'
import { loadProject } from '../lib/project.mjs'
import { checkParity } from '../lib/parity.mjs'
import { renderChapters } from '../lib/render.mjs'

const BOOK = 'chapters:\n  - a.md\ndefaultLanguage: th\n'
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>'

// Build a project from { path: text } and return what checkParity reports.
function parityOf(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mdc-parity-'))
  try {
    for (const [name, text] of Object.entries({ 'book.yaml': BOOK, 'assets/x.svg': SVG, ...files })) {
      const file = path.join(dir, name)
      fs.mkdirSync(path.dirname(file), { recursive: true })
      fs.writeFileSync(file, text)
    }
    const log = new Log(dir)
    const project = loadProject(dir, 'book.yaml', log)
    for (const language of project.languages) {
      language.structure = renderChapters({
        files: language.files,
        compileDir: dir,
        log,
        lang: language.code,
      }).structure
    }
    const reports = []
    const count = checkParity({
      languages: project.languages,
      reference: project.defaultLanguage,
      compileDir: dir,
      report: (message, location) => reports.push({ message, ...location, file: path.relative(dir, location.file).split(path.sep).join('/') }),
    })
    return { count, reports, log }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

const SAME = '# A {#a}\n\n## B {#b}\n\n![Pic](../assets/x.svg){#fig-p}\n\n| x |\n|---|\n| 1 |\n\n: Tbl {#tbl-t}\n'

test('matching th and en produce no differences', () => {
  const { count } = parityOf({ 'th/a.md': SAME, 'en/a.md': SAME })
  assert.equal(count, 0)
})

test('a figure missing in en is reported on the en file, after the heading before it', () => {
  const en = '# A {#a}\n\n## B {#b}\n\n| x |\n|---|\n| 1 |\n\n: Tbl {#tbl-t}\n'
  const { reports } = parityOf({ 'th/a.md': SAME, 'en/a.md': en })
  assert.equal(reports.length, 1)
  assert.equal(reports[0].file, 'en/a.md')
  assert.equal(reports[0].line, 3) // the B heading, the last element they share
  assert.match(reports[0].message, /missing in en: figure #fig-p exists in th\/a\.md/)
})

test('an extra heading in en is reported on the th file', () => {
  const en = SAME + '\n## Extra {#extra}\n'
  const { reports } = parityOf({ 'th/a.md': SAME, 'en/a.md': en })
  assert.equal(reports.length, 1)
  assert.equal(reports[0].file, 'th/a.md')
  assert.match(reports[0].message, /missing in th: heading level 2 #extra exists in en\/a\.md/)
})

test('different heading level and different order are reported', () => {
  const th = '# A {#a}\n\n## B {#b}\n\n## C {#c}\n'
  const en = '# A {#a}\n\n## C {#c}\n\n### B {#b}\n'
  const { reports } = parityOf({ 'th/a.md': th, 'en/a.md': en })
  const messages = reports.map(r => r.message).join('\n')
  assert.match(messages, /#b is a heading level 3 here but a heading level 2 in th\/a\.md/)
  assert.match(messages, /order differs from th\/a\.md: expected #b here but found #c/)
  assert.ok(reports.every(r => r.file === 'en/a.md' && r.line > 0))
})

test('headings without ids are compared by number', () => {
  const { reports } = parityOf({
    'th/a.md': '# A\n\n## B\n\n## C\n',
    'en/a.md': '# A\n\n## B\n',
  })
  assert.equal(reports.length, 1)
  assert.match(reports[0].message, /en has 2 headings without an id but th has 3/)
})

test('counts say "1 heading" in the singular', () => {
  const { reports } = parityOf({
    'th/a.md': '# A {#a}\n',
    'en/a.md': '# A {#a}\n\n## B\n',
  })
  assert.match(reports.map(r => r.message).join('\n'), /en has 1 heading without an id but th has 0 headings/)
})

test('a file that exists in one language only is reported', () => {
  const { reports } = parityOf({
    'th/a.md': SAME,
    'en/a.md': SAME,
    'th/notes.md': '# Notes {#notes}\n',
  })
  assert.equal(reports.length, 1)
  // reported on the file that exists
  assert.equal(reports[0].file, 'th/notes.md')
  assert.equal(reports[0].line, 1)
  assert.match(reports[0].message, /no en counterpart: en\/notes\.md is missing/)
})

test('log entries use the shapes the editor log parser understands', () => {
  const log = new Log('/p')
  log.info('Root file: book.yaml')
  log.warn('image not found: x.png', { file: '/p/th/a.md', line: 12 })
  log.warn('something general')
  log.error('broken', { file: 'book.yaml', line: 3 })
  assert.equal(
    log.toString(),
    [
      'Root file: book.yaml',
      '(./th/a.md',
      'LaTeX Warning: image not found: x.png on input line 12.',
      'LaTeX Warning: something general.',
      '(./book.yaml',
      '! broken.',
      'l.3 ',
      '',
      '',
    ].join('\n')
  )
  assert.equal(log.warnings, 2)
  assert.equal(log.errors, 1)
})

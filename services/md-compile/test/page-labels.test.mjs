import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { Log } from '../lib/log.mjs'
import { loadProject } from '../lib/project.mjs'
import { renderChapters } from '../lib/render.mjs'
import { computePageLabels, thaiLetter } from '../lib/page-labels.mjs'
import { discoverFonts, fontFaceCss, parseFontName } from '../lib/fonts.mjs'

const sample = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'kmutnb-sample'
)

test('thai letters count like the report template: ก ข ค ... then กก', () => {
  assert.equal(thaiLetter(1), 'ก')
  assert.equal(thaiLetter(2), 'ข')
  assert.equal(thaiLetter(10), 'ญ')
  assert.equal(thaiLetter(0), '')
  assert.equal(thaiLetter(41), 'ฮ') // the last single letter
  assert.equal(thaiLetter(42), 'กก')
})

test('page labels: none on covers, Thai letters in the front matter, Arabic from chapter 1', () => {
  const pages = [
    { kind: 'cover' },
    { kind: 'cover' },
    { kind: 'front' }, // abstract
    { kind: 'front' },
    { kind: 'chapter', chapterStart: true }, // chapter 1, first page
    { kind: 'chapter' },
    { kind: 'chapter' },
    { kind: 'chapter', chapterStart: true }, // chapter 2, first page
    { kind: 'chapter' },
    { kind: 'back', chapterStart: true }, // bibliography
  ]
  const labels = computePageLabels(pages, { frontStart: 2, mainStart: 1 })
  assert.deepEqual(
    labels.map(l => l.text),
    ['', '', 'ข', 'ค', '', '2', '3', '', '5', '']
  )
  assert.deepEqual(
    labels.map(l => l.position),
    [null, null, 'bottom-center', 'bottom-center', 'top-right', 'top-right', 'top-right', 'top-right', 'top-right', 'top-right']
  )
})

test('font file names give family, weight and style', () => {
  assert.deepEqual(parseFontName('THSarabunNew.ttf'), { family: 'THSarabunNew', weight: 400, style: 'normal' })
  assert.deepEqual(parseFontName('THSarabunNew Bold.ttf'), { family: 'THSarabunNew', weight: 700, style: 'normal' })
  assert.deepEqual(parseFontName('THSarabunNew BoldItalic.ttf'), { family: 'THSarabunNew', weight: 700, style: 'italic' })
  assert.deepEqual(parseFontName('Noto-Italic.otf'), { family: 'Noto', weight: 400, style: 'italic' })
})

test('fonts are found in Font/ and turned into @font-face rules', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mdc-fonts-'))
  try {
    fs.mkdirSync(path.join(dir, 'Font'))
    fs.writeFileSync(path.join(dir, 'Font', 'THSarabunNew.ttf'), '')
    fs.writeFileSync(path.join(dir, 'Font', 'THSarabunNew Bold.ttf'), '')
    fs.writeFileSync(path.join(dir, 'Font', 'readme.txt'), '')
    const fonts = discoverFonts(dir)
    assert.equal(fonts.length, 2)
    const css = fontFaceCss(fonts)
    assert.match(css, /font-family: 'THSarabunNew'/)
    assert.match(css, /font-weight: 700/)
    assert.match(css, /url\('file:\/\/\/[^']*THSarabunNew%20Bold\.ttf'\)/)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('book.yaml: template, kinds per file', () => {
  const log = new Log(sample)
  const project = loadProject(sample, 'book.yaml', log)
  assert.equal(project.template.name, 'kmutnb-project')
  assert.equal(project.options.cover, false) // the template leaves it to the author
  assert.equal(project.options.chapterHeading, 'label-break')
  const kinds = project.languages[0].chapters.map(c => c.kind)
  assert.deepEqual(kinds, ['cover', 'cover', 'front', 'front', 'chapter', 'chapter', 'back'])
})

test('only chapters are numbered, chapter titles get a label line', () => {
  const log = new Log(sample)
  const project = loadProject(sample, 'book.yaml', log)
  const language = project.languages[0]
  const { html, headings } = renderChapters({
    files: language.files,
    kinds: language.kinds,
    compileDir: sample,
    log,
    lang: 'th',
    chapterHeading: project.options.chapterHeading,
  })
  // abstract, contents and bibliography headings are not numbered
  const abstract = headings.find(h => h.text === 'บทคัดย่อ')
  assert.equal(abstract.number, undefined)
  assert.equal(headings.find(h => h.id === 'intro').number, '1')
  assert.equal(headings.find(h => h.id === 'theory').number, '2')
  assert.equal(headings.find(h => h.id === 'general').number, '1.2.1')
  assert.match(html, /<h1 id="intro" data-chapter-start="1" class="chapter-title"><span class="chapter-label">บทที่ 1<\/span><br>บทนำ<\/h1>/)
  assert.match(html, /<section class="chapter" data-kind="front"/)
  // the bibliography starts a part, the abstract does not
  assert.match(html, /<h1[^>]*data-chapter-start="1"[^>]*>บรรณานุกรม<\/h1>/)
  assert.doesNotMatch(html, /<h1[^>]*data-chapter-start[^>]*>บทคัดย่อ/)
  assert.equal(log.warnings, 0)
})

test('a line with only \\newpage becomes a page break', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mdc-newpage-'))
  try {
    const file = path.join(dir, 'a.md')
    fs.writeFileSync(file, 'one\n\n\\newpage\n\ntwo\n')
    const { html } = renderChapters({ files: [file], compileDir: dir, log: new Log(dir) })
    assert.match(html, /<p>one<\/p>\s*<div class="page-break"><\/div>\s*<p>two<\/p>/)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('an unknown template or kind is reported', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mdc-kind-'))
  try {
    fs.writeFileSync(path.join(dir, 'a.md'), '# A\n')
    fs.writeFileSync(path.join(dir, 'book.yaml'), 'template: nope\nchapters: [a.md]\n')
    assert.throws(() => loadProject(dir, 'book.yaml', new Log(dir)), /unknown template "nope"/)
    fs.writeFileSync(path.join(dir, 'book.yaml'), 'chapters:\n  - file: a.md\n    kind: weird\n')
    const log = new Log(dir)
    const project = loadProject(dir, 'book.yaml', log)
    assert.equal(project.languages[0].chapters[0].kind, 'chapter')
    assert.equal(log.warnings, 1)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

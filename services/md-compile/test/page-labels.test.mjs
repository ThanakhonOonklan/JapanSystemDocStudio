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
  'manual-sample'
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

test('user-manual is the default template', () => {
  const log = new Log(sample)
  const project = loadProject(sample, 'book.yaml', log)
  assert.equal(project.template.name, 'user-manual')
  assert.equal(project.options.cover, true)
  assert.equal(project.options.toc, true)
  assert.equal(project.options.chapterHeading, 'label-break')
  assert.equal(project.options.numberSeparator, '-')
  assert.ok(project.template.fontDir)
  assert.ok(
    discoverFonts(project.template.fontDir, { direct: true }).some(
      f => f.family === 'THSarabunNew' && f.weight === 700
    )
  )
})

test('manual pages: "บทที่ N" headings, figures "ภาพที่ 1-1", framed steps and notes', () => {
  const log = new Log(sample)
  const project = loadProject(sample, 'book.yaml', log)
  const language = project.languages.find(l => l.code === 'th')
  const { html } = renderChapters({
    files: language.files,
    kinds: language.kinds,
    compileDir: sample,
    log,
    lang: 'th',
    chapterHeading: project.options.chapterHeading,
    numberSeparator: project.options.numberSeparator,
  })
  assert.match(html, /<span class="chapter-label">บทที่ 1<\/span><br>การเข้าสู่ระบบ<\/h1>/)
  // a figure inside a numbered step keeps its <figure>
  assert.match(html, /<li data-step="1">[\s\S]*<figure id="fig-login" class="figure">[\s\S]*<span class="label">ภาพที่ 1-1<\/span> หน้าเข้าสู่ระบบ<\/figcaption><\/figure>/)
  // Thai text runs into the reference without a space
  assert.match(html, /จาก<a class="xref" href="#fig-login">ภาพที่ 1-1<\/a>/)
  // nested steps continue the parent's number
  assert.match(html, /<li data-step="3.1">ถ้ากรอกถูกต้อง/)
  assert.match(html, /<span class="label">ตารางที่ 1-1<\/span> สิทธิ์ของผู้ใช้แต่ละกลุ่ม/)
  assert.match(html, /<span class="label">ภาพที่ 2-2<\/span> ภาพหน้าจอขนาดเล็ก/)
  assert.match(html, /<img[^>]*width="50%"/)
  assert.match(html, /<aside class="note">\s*<p class="note-title">หมายเหตุ<\/p>\s*<p>ถ้าลืมรหัสผ่าน/)
  assert.equal(log.warnings, 0)
})

test('an unclosed note box ends with its file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mdc-note-'))
  try {
    const file = path.join(dir, 'a.md')
    fs.writeFileSync(file, '::: note\nแรก\n\nสอง\n')
    const { html } = renderChapters({ files: [file], compileDir: dir, log: new Log(dir), lang: 'en' })
    assert.match(html, /<aside class="note">\s*<p class="note-title">Note<\/p>\s*<p>แรก<\/p>\s*<p>สอง<\/p>\s*<\/aside>/)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
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

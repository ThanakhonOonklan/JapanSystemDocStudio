import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { Log } from '../lib/log.mjs'
import { loadProject } from '../lib/project.mjs'
import { renderChapters } from '../lib/render.mjs'
import { renderContents } from '../lib/contents.mjs'

function project(files, book) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mdc-flow-'))
  fs.writeFileSync(path.join(dir, 'book.yaml'), book)
  fs.writeFileSync(path.join(dir, 'x.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>')
  for (const [name, text] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), text)
  }
  return dir
}

const BOOK = `title: คู่มือ
layout: flow
chapterLabel:
  th: ขั้นที่
  en: Step
chapters: [a.md, b.md]
`

const FILES = {
  'a.md': '# ภาพรวม {.unnumbered}\n\n## วิธีอ่าน {#about}\n\nข้อความ\n\n| ก | ข |\n|---|---|\n| 1 | 2 |\n\n: ตารางแรก {#tbl-one}\n',
  'b.md': '# ใบเสนอราคา {#quotation}\n\n## สร้างใบเสนอราคา {#new tag=ทางหลัก}\n\nดู @quotation และ @fig-a\n\n![หน้าสร้าง](x.svg){#fig-a}\n\n1. ปุ่ม “Save”\n\n## ส่ง {#send}\n\n| ก | ข |\n|---|---|\n| 1 | 2 |\n\n: ตารางสอง {#tbl-two}\n\n# ใบสั่งขาย {#so}\n',
}

test('layout: flow reads its defaults from book.yaml', () => {
  const dir = project(FILES, BOOK)
  try {
    const p = loadProject(dir, 'book.yaml', new Log(dir))
    assert.equal(p.options.layout, 'flow')
    assert.equal(p.options.chapterBreak, false)
    assert.equal(p.options.figureNumbers, false)
    assert.equal(p.options.lof, false)
    assert.equal(p.options.chapterHeading, 'inline')
    assert.deepEqual(p.options.chapterLabel, { th: 'ขั้นที่', en: 'Step' })
    // a normal book keeps page breaks and numbered figures
    fs.writeFileSync(path.join(dir, 'book.yaml'), 'title: x\nchapters: [a.md]\n')
    const q = loadProject(dir, 'book.yaml', new Log(dir))
    assert.equal(q.options.layout, 'chapters')
    assert.equal(q.options.figureNumbers, true)
    assert.equal(q.options.chapterBreak, true)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('flow: steps, unnumbered parts, caption without number, tag after the heading', () => {
  const dir = project(FILES, BOOK)
  try {
    const log = new Log(dir)
    const p = loadProject(dir, 'book.yaml', log)
    const language = p.languages[0]
    const { html, headings, figures, tables } = renderChapters({
      files: language.files,
      kinds: language.kinds,
      compileDir: dir,
      log,
      lang: 'th',
      chapterHeading: p.options.chapterHeading,
      chapterLabel: 'ขั้นที่',
      flow: true,
      figureNumbers: false,
    })
    // the overview and its sections have no number, the first step is "ขั้นที่ 1"
    assert.equal(headings.find(h => h.id === 'overview' || h.text === 'ภาพรวม').number, undefined)
    assert.equal(headings.find(h => h.id === 'about').number, undefined)
    assert.equal(headings.find(h => h.id === 'quotation').number, '1')
    assert.equal(headings.find(h => h.id === 'new').number, '1.1')
    assert.equal(headings.find(h => h.id === 'so').number, '2')
    assert.match(html, /<h1[^>]*class="chapter-inline"[^>]*><span class="chapter-label">ขั้นที่ 1<\/span> ใบเสนอราคา<\/h1>/)
    // tag: shown after the heading, not part of the heading text, no attribute left
    assert.match(html, /<h2 id="new"><span class="num">1\.1<\/span> สร้างใบเสนอราคา <span class="heading-tag">ทางหลัก<\/span><\/h2>/)
    assert.equal(headings.find(h => h.id === 'new').text, 'สร้างใบเสนอราคา')
    // figure: caption only, no list of figures entry; references use the caption
    assert.match(html, /<figcaption>หน้าสร้าง<\/figcaption>/)
    assert.equal(figures.length, 0)
    assert.match(html, /<a class="xref" href="#fig-a">หน้าสร้าง<\/a>/)
    assert.match(html, /<a class="xref" href="#quotation">ขั้นที่ 1<\/a>/)
    // tables are numbered 1, 2 through the whole document
    assert.deepEqual(tables.map(t => t.number), ['1', '2'])
    assert.match(html, /<span class="label">ตารางที่ 2<\/span> ตารางสอง/)
    // only the first part hides its page number
    assert.equal((html.match(/data-chapter-start/g) || []).length, 1)
    assert.equal(log.warnings, 0)
    // the contents say "ขั้นที่ 1" and list the unnumbered part without a number
    const contents = renderContents({
      headings, figures, tables, depth: 2, lang: 'th',
      chapterHeading: 'inline', chapterLabel: 'ขั้นที่', lof: false, lot: false,
    })
    assert.match(contents, /<span class="contents-num">ขั้นที่ 1<\/span><span class="contents-text">ใบเสนอราคา/)
    assert.doesNotMatch(contents, /สารบัญภาพ|สารบัญตาราง/)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

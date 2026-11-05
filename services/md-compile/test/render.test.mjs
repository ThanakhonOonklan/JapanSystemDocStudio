import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { Log } from '../lib/log.mjs'
import { renderChapters, renderCover, renderToc } from '../lib/render.mjs'

function withProject(files, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mdc-render-'))
  try {
    const paths = []
    for (const [name, text] of Object.entries(files)) {
      const file = path.join(dir, name)
      fs.mkdirSync(path.dirname(file), { recursive: true })
      fs.writeFileSync(file, text)
      paths.push(file)
    }
    // only Markdown files are chapters
    return fn(dir, paths.filter(file => file.endsWith('.md')))
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>'

test('chapters, sections and subsections are numbered', () => {
  withProject(
    {
      'a.md': '# One\n\n## Two\n\n### Three\n\n## Four\n',
      'b.md': '# Next\n\n## Sub\n',
    },
    (dir, [a, b]) => {
      const log = new Log()
      const { headings } = renderChapters({ files: [a, b], compileDir: dir, log })
      assert.deepEqual(
        headings.map(h => h.number),
        ['1', '1.1', '1.1.1', '1.2', '2', '2.1']
      )
    }
  )
})

test('{.unnumbered} headings get no number and do not shift the others', () => {
  withProject(
    { 'a.md': '# Preface {.unnumbered}\n\n# One\n\n## Two\n' },
    (dir, [a]) => {
      const { headings, html } = renderChapters({
        files: [a],
        compileDir: dir,
        log: new Log(),
      })
      assert.deepEqual(
        headings.map(h => h.number),
        [undefined, '1', '1.1']
      )
      assert.doesNotMatch(html, /<span class="num">0/)
    }
  )
})

test('numbering can be turned off', () => {
  withProject({ 'a.md': '# One\n\n## Two\n' }, (dir, [a]) => {
    const { html } = renderChapters({
      files: [a],
      compileDir: dir,
      log: new Log(),
      numbering: false,
    })
    assert.doesNotMatch(html, /class="num"/)
  })
})

test('figures and tables are numbered per chapter, with captions', () => {
  withProject(
    {
      'img/x.svg': SVG,
      'a.md': [
        '# One',
        '',
        '![First](img/x.svg){#fig-first}',
        '',
        '![Second](img/x.svg)',
        '',
        '| a | b |',
        '|---|---|',
        '| 1 | 2 |',
        '',
        ': Numbers {#tbl-numbers}',
        '',
        '# Two',
        '',
        '![Third](img/x.svg){#fig-third}',
      ].join('\n'),
    },
    (dir, [a]) => {
      const log = new Log()
      const { html } = renderChapters({ files: [a], compileDir: dir, log, lang: 'en' })
      assert.match(html, /<figure id="fig-first" class="figure">/)
      assert.match(html, /Figure 1\.1<\/span> First/)
      assert.match(html, /Figure 1\.2<\/span> Second/)
      assert.match(html, /Figure 2\.1<\/span> Third/)
      assert.match(html, /<table id="tbl-numbers" class="numbered">/)
      assert.match(html, /<caption><span class="label">Table 1\.1<\/span> Numbers<\/caption>/)
      assert.equal(log.warnings, 0)
    }
  )
})

test('captions and labels follow the language', () => {
  withProject(
    {
      'img/x.svg': SVG,
      'a.md': '# บท\n\n![แผนภาพ](img/x.svg){#fig-a}\n\nดู @fig-a\n',
    },
    (dir, [a]) => {
      const { html } = renderChapters({
        files: [a],
        compileDir: dir,
        log: new Log(),
        lang: 'th',
      })
      assert.match(html, /รูปที่ 1\.1<\/span> แผนภาพ/)
      assert.match(html, /<a class="xref" href="#fig-a">รูปที่ 1\.1<\/a>/)
    }
  )
})

test('cross references resolve, including headings and forward references', () => {
  withProject(
    {
      'a.md': '# One {#one}\n\nSee @sec-later and @one. Not an e-mail: me@example.com\n',
      'b.md': '# Two\n\n## Later {#sec-later}\n',
    },
    (dir, [a, b]) => {
      const log = new Log()
      const { html } = renderChapters({ files: [a, b], compileDir: dir, log })
      assert.match(html, /<a class="xref" href="#sec-later">Section 2\.1<\/a>/)
      assert.match(html, /<a class="xref" href="#one">Chapter 1<\/a>/)
      assert.match(html, /me@example\.com/)
      assert.equal(log.warnings, 0)
    }
  )
})

test('unknown prefixed references and duplicate ids are reported', () => {
  withProject(
    { 'a.md': '# One {#same}\n\nSee @fig-missing and @plain.\n\n# Two {#same}\n' },
    (dir, [a]) => {
      const log = new Log()
      const { html } = renderChapters({ files: [a], compileDir: dir, log })
      assert.equal(log.warnings, 2)
      assert.match(log.toString(), /unknown reference @fig-missing/)
      assert.match(log.toString(), /duplicate id "same"/)
      assert.match(html, /@plain/)
    }
  )
})

test('toc lists headings up to the requested depth', () => {
  const headings = [
    { level: 1, id: 'a', number: '1', text: 'One' },
    { level: 2, id: 'b', number: '1.1', text: 'Two & more' },
    { level: 3, id: 'c', number: '1.1.1', text: 'Three' },
  ]
  const toc = renderToc({ headings, depth: 2, lang: 'en' })
  assert.match(toc, /Contents/)
  assert.match(
    toc,
    /<a href="#b"><span class="toc-text"><span class="num">1\.1<\/span> Two &amp; more<\/span><span class="toc-fill"><\/span><\/a>/
  )
  assert.doesNotMatch(toc, /Three/)
  assert.match(renderToc({ headings, depth: 2, lang: 'th' }), /สารบัญ/)
  assert.equal(renderToc({ headings: [], depth: 3, lang: 'en' }), '')
})

test('cover shows only the metadata that is set', () => {
  const cover = renderCover({
    title: 'My <Book>',
    meta: { subtitle: 'Sub', version: '1.0' },
    lang: 'en',
  })
  assert.match(cover, /My &lt;Book&gt;/)
  assert.match(cover, /Version<\/dt><dd>1\.0/)
  assert.doesNotMatch(cover, /Author/)
  assert.equal(renderCover({ title: undefined, meta: {}, lang: 'en' }), '')
})

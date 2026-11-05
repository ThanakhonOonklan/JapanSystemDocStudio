import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { Log } from '../lib/log.mjs'
import { loadProject } from '../lib/project.mjs'
import { renderChapters } from '../lib/render.mjs'
import { isInside, resolveInside } from '../lib/paths.mjs'

const fixture = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'sample-book'
)

test('book.yaml: detects th/ and en/ and the default language', () => {
  const log = new Log()
  const project = loadProject(fixture, 'book.yaml', log)
  assert.equal(project.defaultLanguage, 'th')
  assert.deepEqual(
    project.languages.map(l => l.code),
    ['th', 'en']
  )
  assert.equal(project.languages[0].title, 'คู่มือการใช้งานระบบตัวอย่าง')
  assert.equal(project.languages[1].title, 'Sample System User Manual')
  assert.equal(project.languages[0].files.length, 2)
  assert.equal(log.warnings, 0)
})

test('rendering keeps ids and rewrites project images to file URLs', () => {
  const log = new Log()
  const project = loadProject(fixture, 'book.yaml', log)
  const html = renderChapters({
    files: project.languages[1].files,
    compileDir: fixture,
    log,
  })
  assert.match(html, /<h1 id="intro">Introduction<\/h1>/)
  assert.match(html, /<img[^>]+src="file:[^"]+diagram\.svg"[^>]+id="fig-flow"/)
  assert.equal(log.warnings, 0)
})

test('raw HTML and external images are not passed through', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mdc-test-'))
  try {
    const file = path.join(dir, 'a.md')
    fs.writeFileSync(
      file,
      '<script>alert(1)</script>\n\n![x](https://example.com/x.png)\n\n![y](../../secret.png)\n'
    )
    const log = new Log()
    const html = renderChapters({ files: [file], compileDir: dir, log })
    assert.doesNotMatch(html, /<script>/)
    assert.doesNotMatch(html, /example\.com/)
    assert.equal(log.warnings, 2)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('paths cannot escape the project', () => {
  assert.equal(isInside('/p', '/p/a/b'), true)
  assert.equal(isInside('/p', '/q'), false)
  assert.throws(() => resolveInside('/p', '/p/th', '../../etc/passwd'))
})

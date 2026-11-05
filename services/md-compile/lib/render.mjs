// Markdown -> HTML.
//
// Raw HTML in the Markdown source is not allowed (html: false), so a document
// cannot inject scripts into the page that Chromium renders. Images are
// restricted to files inside the project.

import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import MarkdownIt from 'markdown-it'
import markdownItAttrs from 'markdown-it-attrs'
import { parseFrontMatter } from './project.mjs'
import { isInside } from './paths.mjs'

const URL_SCHEME = /^[a-z][a-z0-9+.-]*:/i
// 1x1 transparent GIF used in place of images that cannot be loaded
const BLANK_IMAGE =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

function createMarkdown() {
  const md = new MarkdownIt({ html: false, linkify: false, typographer: false })
  md.use(markdownItAttrs, {
    allowedAttributes: ['id', 'class', 'width', 'height'],
  })

  md.renderer.rules.image = (tokens, idx, options, env, self) => {
    const token = tokens[idx]
    const src = token.attrGet('src') || ''
    const { compileDir, baseDir, log, file } = env
    const where = path.relative(compileDir, file)

    if (src.startsWith('data:image/')) {
      // inline images are fine
    } else if (URL_SCHEME.test(src) || src.startsWith('//')) {
      log.warn(`${where}: external image is not loaded: ${src}`)
      token.attrSet('src', BLANK_IMAGE)
    } else {
      let absolute
      try {
        absolute = path.resolve(baseDir, decodeURI(src))
      } catch {
        absolute = path.resolve(baseDir, src)
      }
      if (!isInside(compileDir, absolute)) {
        log.warn(`${where}: image outside the project is not loaded: ${src}`)
        token.attrSet('src', BLANK_IMAGE)
      } else if (!fs.existsSync(absolute)) {
        log.warn(`${where}: image not found: ${src}`)
        token.attrSet('src', BLANK_IMAGE)
      } else {
        token.attrSet('src', pathToFileURL(absolute).href)
      }
    }
    return self.renderToken(tokens, idx, options)
  }

  return md
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Render the chapters of one language to an HTML body.
 */
export function renderChapters({ files, compileDir, log }) {
  const md = createMarkdown()
  const parts = []
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8')
    const { body } = parseFrontMatter(source)
    const html = md.render(body, {
      compileDir,
      baseDir: path.dirname(file),
      file,
      log,
    })
    parts.push(
      `<section class="chapter" data-source="${escapeHtml(
        path.relative(compileDir, file)
      )}">\n${html}</section>`
    )
  }
  return parts.join('\n')
}

/**
 * Wrap rendered content into a complete HTML document.
 */
export function buildDocument({ lang, title, body, css }) {
  return `<!doctype html>
<html lang="${escapeHtml(lang)}">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title || '')}</title>
<style>
${css}
</style>
<script>window.PagedConfig = { auto: false }</script>
</head>
<body>
${body}
</body>
</html>
`
}

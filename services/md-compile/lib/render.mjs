// Markdown -> HTML for a book.
//
// On top of plain Markdown this adds:
//   - numbered chapters/sections (1, 1.1, 1.1.1); `{.unnumbered}` opts out
//   - numbered figures: an image alone in its paragraph with alt text
//       ![Caption](assets/a.png){#fig-a}
//   - numbered tables: a paragraph starting with ": " right after a table
//       : Caption {#tbl-b}
//   - cross-references: @fig-a, @tbl-b, @sec-c (or @id of any heading)
//   - note boxes:
//       ::: note
//       text
//       :::
//   - a cover page and a table of contents
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
import { strings } from './i18n.mjs'

const URL_SCHEME = /^[a-z][a-z0-9+.-]*:/i
// 1x1 transparent GIF used in place of images that cannot be loaded
const BLANK_IMAGE =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
const PREFIXED_REF = /^(fig|tbl|sec)-/
// a Thai letter (or mark) followed by one space, at the end of a text run
const THAI_BEFORE_SPACE = /[ก-๛] $/
const REF_START = '\u0001REF:'
const REF_END = '\u0002'

export function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function plainText(inline) {
  let text = ''
  for (const child of inline?.children || []) {
    if (child.type === 'text' || child.type === 'code_inline') {
      text += child.content
    } else if (child.type === 'softbreak') {
      text += ' '
    }
  }
  return text
}

function newState({ lang, numbering, chapterHeading, numberSeparator, log }) {
  return {
    t: strings(lang),
    numbering,
    chapterHeading,
    numberSeparator,
    log,
    chapter: 0,
    section: 0,
    subsection: 0,
    figure: 0,
    table: 0,
    anonymous: 0,
    headings: [], // { level, id, number, text }
    labels: new Map(), // id -> { kind, number, text }
    ids: new Set(),
    // headings, figures and tables in document order, used to compare
    // the structure of different languages
    structure: [], // { file, line, kind, level?, id, explicit }
    refs: [], // { id, file, line } for every @reference in the text
  }
}

// 1-based line in the file of a block token (front matter included)
function lineOf(token, env) {
  return token?.map ? token.map[0] + 1 + env.lineOffset : undefined
}

function claimId(bs, id, env, line) {
  if (bs.ids.has(id)) {
    bs.log.warn(`duplicate id #${id}`, { file: env.file, line })
  }
  bs.ids.add(id)
}

// Number within the current chapter: "2-1" (or "2.1"), or just "1" before
// any chapter.
function localNumber(bs, counter) {
  return bs.chapter > 0
    ? `${bs.chapter}${bs.numberSeparator}${counter}`
    : `${counter}`
}

function htmlInline(StateToken, html) {
  const token = new StateToken('html_inline', '', 0)
  token.content = html
  return token
}

function handleHeading(tokens, i, env, Token) {
  const bs = env.state
  const open = tokens[i]
  const inline = tokens[i + 1]
  const level = Number(open.tag.slice(1))
  const line = lineOf(open, env)

  const classes = (open.attrGet('class') || '').split(/\s+/)
  // only the chapters of the book are numbered, not the cover, front matter,
  // bibliography or appendices
  const numbered =
    bs.numbering &&
    env.kind === 'chapter' &&
    level <= 3 &&
    !classes.includes('unnumbered')

  // the heading of a chapter, appendix or bibliography starts a new part:
  // the page labelling pass hides the page number on its first page
  if (level === 1 && ['chapter', 'appendix', 'back'].includes(env.kind)) {
    open.attrSet('data-chapter-start', '1')
  }

  let number
  if (numbered) {
    if (level === 1) {
      bs.chapter++
      bs.section = 0
      bs.subsection = 0
      bs.figure = 0
      bs.table = 0
    } else if (level === 2) {
      bs.section++
      bs.subsection = 0
    } else {
      bs.subsection++
    }
    number = [bs.chapter, bs.section, bs.subsection]
      .slice(0, level)
      .filter(n => n > 0)
      .join('.')
  }

  let id = open.attrGet('id')
  const explicit = Boolean(id)
  if (!id) {
    id = `sec-auto-${++bs.anonymous}`
    open.attrSet('id', id)
  }
  claimId(bs, id, env, line)
  bs.structure.push({
    file: env.file,
    line,
    kind: 'heading',
    level,
    id,
    explicit,
  })

  const text = plainText(inline)
  if (number && inline) {
    if (level === 1 && bs.chapterHeading === 'label-break') {
      // "บทที่ 1" on one line, the title on the next
      open.attrJoin('class', 'chapter-title')
      inline.children.unshift(
        htmlInline(
          Token,
          `<span class="chapter-label">${escapeHtml(bs.t.chapter)} ${number}</span><br>`
        )
      )
    } else {
      inline.children.unshift(
        htmlInline(Token, `<span class="num">${number}</span> `)
      )
    }
  }
  bs.headings.push({ level, id, number, text })
  bs.labels.set(id, {
    kind: level === 1 ? 'chapter' : 'section',
    number,
    text,
  })
}

function isFigureParagraph(tokens, i) {
  const inline = tokens[i + 1]
  const close = tokens[i + 2]
  if (inline?.type !== 'inline' || close?.type !== 'paragraph_close') {
    return false
  }
  const children = inline.children || []
  return (
    children.length === 1 &&
    children[0].type === 'image' &&
    children[0].content.trim() !== ''
  )
}

function handleFigure(tokens, i, env, Token) {
  const bs = env.state
  const open = tokens[i]
  const inline = tokens[i + 1]
  const close = tokens[i + 2]
  const image = inline.children[0]
  const line = lineOf(open, env)

  let id = image.attrGet('id')
  const explicit = Boolean(id)
  // the id belongs on the <figure>, not on the <img>
  image.attrs = (image.attrs || []).filter(([name]) => name !== 'id')
  if (!id) id = `fig-auto-${++bs.anonymous}`
  claimId(bs, id, env, line)
  bs.structure.push({ file: env.file, line, kind: 'figure', id, explicit })

  const number = localNumber(bs, ++bs.figure)
  const caption = image.content.trim()

  open.type = 'figure_open'
  open.tag = 'figure'
  // in a tight list the paragraph would be hidden, the figure must not be
  open.hidden = false
  open.attrSet('id', id)
  open.attrSet('class', 'figure')
  close.type = 'figure_close'
  close.tag = 'figure'
  close.hidden = false
  inline.children.push(
    htmlInline(
      Token,
      `<figcaption><span class="label">${escapeHtml(bs.t.figure)} ${number}</span> ${escapeHtml(caption)}</figcaption>`
    )
  )
  bs.labels.set(id, { kind: 'figure', number, text: caption })
}

function handleTable(tokens, i, env) {
  const bs = env.state
  const open = tokens[i]

  let depth = 0
  let j = i
  for (; j < tokens.length; j++) {
    if (tokens[j].type === 'table_open') depth++
    if (tokens[j].type === 'table_close' && --depth === 0) break
  }
  const paragraph = tokens[j + 1]
  const inline = tokens[j + 2]
  const paragraphClose = tokens[j + 3]
  if (
    paragraph?.type !== 'paragraph_open' ||
    inline?.type !== 'inline' ||
    paragraphClose?.type !== 'paragraph_close'
  ) {
    return
  }
  const text = plainText(inline)
  if (!/^:\s+\S/.test(text)) return

  const caption = text.replace(/^:\s+/, '').trim()
  let id = paragraph.attrGet('id')
  const explicit = Boolean(id)
  if (!id) id = `tbl-auto-${++bs.anonymous}`
  const line = lineOf(open, env)
  claimId(bs, id, env, line)
  bs.structure.push({ file: env.file, line, kind: 'table', id, explicit })
  const number = localNumber(bs, ++bs.table)

  tokens.splice(j + 1, 3) // the caption paragraph is not rendered on its own
  open.meta = { id, number, caption, label: `${bs.t.table} ${number}` }
  bs.labels.set(id, { kind: 'table', number, text: caption })
}

// Number the items of ordered lists in the HTML ("3", nested "3.1") so the
// stylesheet can print "3)" / "3.1)": Paged.js does not handle nested CSS
// counters.
function numberListItems(tokens) {
  const stack = [] // { ordered, next }
  const path = []
  for (const token of tokens) {
    if (token.type === 'ordered_list_open') {
      const start = parseInt(token.attrGet('start'), 10)
      stack.push({ ordered: true, next: Number.isFinite(start) ? start : 1 })
    } else if (token.type === 'bullet_list_open') {
      stack.push({ ordered: false })
    } else if (token.type === 'ordered_list_close' || token.type === 'bullet_list_close') {
      stack.pop()
    } else if (token.type === 'list_item_open') {
      const list = stack[stack.length - 1]
      if (list?.ordered) {
        const number = list.next++
        // nested ordered lists continue the number of their parent items
        const parents = []
        for (let d = 0; d < stack.length - 1; d++) {
          if (stack[d].ordered && path[d] != null) parents.push(path[d])
        }
        path[stack.length - 1] = number
        token.attrSet('data-step', [...parents, number].join('.'))
      } else {
        path[stack.length - 1] = null
      }
    }
  }
}

// ::: note ... ::: becomes a note box. The content is ordinary Markdown.
function noteBlock(state, startLine, endLine, silent) {
  const lineText = line =>
    state.src.slice(state.bMarks[line] + state.tShift[line], state.eMarks[line])
  if (state.sCount[startLine] - state.blkIndent >= 4) return false
  if (!/^:::\s*note\s*$/i.test(lineText(startLine))) return false
  if (silent) return true

  let next = startLine + 1
  let closed = false
  for (; next < endLine; next++) {
    if (
      state.sCount[next] - state.blkIndent < 4 &&
      /^:::\s*$/.test(lineText(next))
    ) {
      closed = true
      break
    }
  }

  const open = state.push('note_open', 'aside', 1)
  open.attrSet('class', 'note')
  open.map = [startLine, next]
  open.block = true

  const oldParent = state.parentType
  const oldLineMax = state.lineMax
  state.parentType = 'note'
  state.lineMax = next
  state.md.block.tokenize(state, startLine + 1, next)
  state.parentType = oldParent
  state.lineMax = oldLineMax

  const close = state.push('note_close', 'aside', -1)
  close.block = true
  state.line = closed ? next + 1 : next
  return true
}

function createMarkdown() {
  const md = new MarkdownIt({ html: false, linkify: false, typographer: false })
  md.use(markdownItAttrs, {
    allowedAttributes: ['id', 'class', 'width', 'height'],
  })

  md.block.ruler.before('fence', 'note', noteBlock, {
    alt: ['paragraph', 'reference', 'blockquote', 'list'],
  })
  md.renderer.rules.note_open = (tokens, idx, options, env, self) =>
    self.renderToken(tokens, idx, options) +
    `<p class="note-title">${escapeHtml(env.state.t.note)}</p>
`

  // @fig-x / @tbl-x / @sec-x / @heading-id
  md.inline.ruler.push('xref', (state, silent) => {
    const { src, pos } = state
    if (src.charCodeAt(pos) !== 0x40) return false
    if (pos > 0 && /[A-Za-z0-9_.]/.test(src[pos - 1])) return false // e-mail
    const match = /^@([A-Za-z][A-Za-z0-9_-]*)/.exec(src.slice(pos))
    if (!match) return false
    const id = match[1].replace(/[-_]+$/, '')
    if (!silent) {
      const token = state.push('xref', '', 0)
      token.content = id
    }
    state.pos += 1 + id.length
    return true
  })
  md.renderer.rules.xref = (tokens, idx, options, env) => {
    const id = tokens[idx].content
    env.state.refs.push({ id, file: env.file, line: tokens[idx].meta?.line })
    return `${REF_START}${id}${REF_END}`
  }

  md.core.ruler.after('curly_attributes', 'book_structure', state => {
    const { tokens, env } = state
    numberListItems(tokens)
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i]
      if (
        token.type === 'paragraph_open' &&
        tokens[i + 1]?.type === 'inline' &&
        tokens[i + 1].content.trim() === '\\newpage' &&
        tokens[i + 2]?.type === 'paragraph_close'
      ) {
        // a line with only \newpage starts a new page
        const marker = new state.Token('html_block', '', 0)
        marker.content = '<div class="page-break"></div>\n'
        tokens.splice(i, 3, marker)
      } else if (token.type === 'inline') {
        // remember where images and references are, for warnings
        const children = token.children || []
        children.forEach((child, k) => {
          if (child.type === 'image' || child.type === 'xref') {
            child.meta = { line: lineOf(token, env) }
          }
          // Thai has no space between words: "จาก @fig-a" reads "จากภาพที่ 1-1"
          const before = children[k - 1]
          if (
            child.type === 'xref' &&
            before?.type === 'text' &&
            THAI_BEFORE_SPACE.test(before.content)
          ) {
            before.content = before.content.slice(0, -1)
          }
        })
      } else if (token.type === 'heading_open') {
        handleHeading(tokens, i, env, state.Token)
      } else if (token.type === 'paragraph_open' && isFigureParagraph(tokens, i)) {
        handleFigure(tokens, i, env, state.Token)
      } else if (token.type === 'table_open') {
        handleTable(tokens, i, env)
      }
    }
  })

  md.renderer.rules.table_open = (tokens, idx, options, env, self) => {
    const token = tokens[idx]
    if (!token.meta) return self.renderToken(tokens, idx, options)
    token.attrSet('id', token.meta.id)
    token.attrJoin('class', 'numbered')
    return (
      self.renderToken(tokens, idx, options) +
      `<caption><span class="label">${escapeHtml(token.meta.label)}</span> ${escapeHtml(token.meta.caption)}</caption>\n`
    )
  }

  md.renderer.rules.image = (tokens, idx, options, env, self) => {
    const token = tokens[idx]
    const src = token.attrGet('src') || ''
    const { compileDir, baseDir, log, file } = env
    const location = { file, line: token.meta?.line }

    if (src.startsWith('data:image/')) {
      // inline images are fine
    } else if (URL_SCHEME.test(src) || src.startsWith('//')) {
      log.warn(`external image is not loaded: ${src}`, location)
      token.attrSet('src', BLANK_IMAGE)
    } else {
      let absolute
      try {
        absolute = path.resolve(baseDir, decodeURI(src))
      } catch {
        absolute = path.resolve(baseDir, src)
      }
      if (!isInside(compileDir, absolute)) {
        log.warn(`image outside the project is not loaded: ${src}`, location)
        token.attrSet('src', BLANK_IMAGE)
      } else if (!fs.existsSync(absolute)) {
        log.warn(`image not found: ${src}`, location)
        token.attrSet('src', BLANK_IMAGE)
      } else {
        token.attrSet('src', pathToFileURL(absolute).href)
      }
    }
    return self.renderToken(tokens, idx, options)
  }

  return md
}

function referenceText(label, t) {
  if (!label.number) return label.text
  const kind = { figure: t.figure, table: t.table, chapter: t.chapter }[label.kind]
  return `${kind || t.section} ${label.number}`
}

function resolveReferences(html, bs) {
  for (const ref of bs.refs) {
    if (!bs.labels.has(ref.id) && PREFIXED_REF.test(ref.id)) {
      bs.log.warn(`unknown reference @${ref.id}`, ref)
    }
  }
  const pattern = new RegExp(`${REF_START}([^${REF_END}]+)${REF_END}`, 'g')
  return html.replace(pattern, (_match, id) => {
    const label = bs.labels.get(id)
    if (!label) return `@${id}`
    return `<a class="xref" href="#${id}">${escapeHtml(referenceText(label, bs.t))}</a>`
  })
}

/**
 * Render the chapters of one language.
 *
 * @returns {{ html: string,
 *             headings: Array<{ level: number, id: string, number?: string, text: string }>,
 *             structure: Array<{ file: string, line?: number, kind: 'heading' | 'figure' | 'table', level?: number, id: string, explicit: boolean }> }}
 */
export function renderChapters({
  files,
  compileDir,
  log,
  lang = 'en',
  numbering = true,
  chapterHeading = 'number',
  numberSeparator = '.',
  kinds = new Map(),
}) {
  const md = createMarkdown()
  const state = newState({ lang, numbering, chapterHeading, numberSeparator, log })
  const parts = []
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8')
    const { body, lineOffset } = parseFrontMatter(source)
    const kind = kinds.get(file) ?? 'chapter'
    const html = md.render(body, {
      compileDir,
      baseDir: path.dirname(file),
      file,
      kind,
      lineOffset,
      log,
      state,
    })
    parts.push(
      `<section class="chapter" data-kind="${escapeHtml(kind)}" data-source="${escapeHtml(
        path.relative(compileDir, file)
      )}">\n${html}</section>`
    )
  }
  return {
    html: resolveReferences(parts.join('\n'), state),
    headings: state.headings,
    structure: state.structure,
  }
}

/**
 * Table of contents (page numbers are filled in by Paged.js).
 */
export function renderToc({ headings, depth, lang }) {
  const t = strings(lang)
  const items = headings
    .filter(h => h.level <= depth)
    .map(
      h =>
        // the dotted filler is drawn by CSS; the page number comes from
        // target-counter() on the link's ::after
        `<li class="toc-${h.level}"><a href="#${escapeHtml(h.id)}"><span class="toc-text">${
          h.number ? `<span class="num">${escapeHtml(h.number)}</span> ` : ''
        }${escapeHtml(h.text)}</span><span class="toc-fill"></span></a></li>`
    )
  if (items.length === 0) return ''
  return `<nav class="toc" data-kind="front">
<h2 class="toc-title">${escapeHtml(t.contents)}</h2>
<ul>
${items.join('\n')}
</ul>
</nav>`
}

/**
 * Wrap rendered content into a complete HTML document.
 */
export function buildDocument({ lang, title, cover, toc, body, css }) {
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
${cover || ''}
${toc || ''}
${body}
</body>
</html>
`
}

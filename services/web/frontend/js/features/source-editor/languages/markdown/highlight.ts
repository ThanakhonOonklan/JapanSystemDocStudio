// Documentation Studio REA: colours for Markdown in the editor, in the style
// of VS Code (Dark+ / Light+).
//
//   # headings               blue, bold, normal size, no underline
//   ![caption](path)         caption orange, path brown
//   # ** [ ] ( ) | - 1.      Markdown marks dimmed (grey)
//   @fig-id                  reference, purple; red wavy underline when the
//                            id is not defined in this file
//   {#id width=60%}          attributes, grey
//   ::: note / ::: / \newpage  purple
//   : table caption          teal

import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags } from '@lezer/highlight'
import { RangeSetBuilder, Extension } from '@codemirror/state'
import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
} from '@codemirror/view'
import { labelsInDoc } from './completions'

const HEADINGS = [
  tags.heading1,
  tags.heading2,
  tags.heading3,
  tags.heading4,
  tags.heading5,
  tags.heading6,
]

// Tokens get our own class names; the colours are set in the theme below
// with selectors that are more specific than the editor themes' .tok-* rules,
// so they apply in every editor theme.
const markdownClasses = HighlightStyle.define([
  { tag: HEADINGS, class: 'ol-md-heading' },
  { tag: tags.link, class: 'ol-md-link' },
  { tag: tags.url, class: 'ol-md-url' },
  { tag: tags.processingInstruction, class: 'ol-md-mark' },
  { tag: tags.emphasis, class: 'ol-md-em' },
  { tag: tags.strong, class: 'ol-md-strong' },
  { tag: tags.strikethrough, class: 'ol-md-strike' },
  { tag: tags.monospace, class: 'ol-md-code' },
])

// ---- syntax of the book template, not known to the Markdown parser ----------

const attrMark = Decoration.mark({ class: 'ol-md-attr' })
const refMark = Decoration.mark({ class: 'ol-md-ref' })
const brokenRefMark = Decoration.mark({
  class: 'ol-md-ref ol-md-ref-missing',
  attributes: { title: 'ไม่พบ id นี้ในไฟล์ / id not found in this file' },
})
const directiveMark = Decoration.mark({ class: 'ol-md-directive' })
const captionMark = Decoration.mark({ class: 'ol-md-caption' })

const ATTRS = /\{[#.][^}\n]*\}/g
const REF = /@([A-Za-z][A-Za-z0-9_-]*)/g
const DIRECTIVE = /^\s{0,3}(:::\s*[A-Za-z]*\s*|\\newpage\s*)$/
const CAPTION = /^\s{0,3}:\s+\S/
const FENCE = /^\s{0,3}(```|~~~)/

function buildDecorations(view: EditorView, known: Set<string>): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  const { doc } = view.state
  // which lines are inside fenced code (nothing is decorated there)
  let fence: string | null = null
  const fencedLines = new Set<number>()
  for (let n = 1; n <= doc.lines; n++) {
    const fenceMatch = FENCE.exec(doc.line(n).text)
    if (fenceMatch) {
      fencedLines.add(n)
      if (fence === null) fence = fenceMatch[1]
      else if (fence === fenceMatch[1]) fence = null
    } else if (fence !== null) {
      fencedLines.add(n)
    }
  }

  for (const { from, to } of view.visibleRanges) {
    let pos = from
    while (pos <= to) {
      const line = doc.lineAt(pos)
      if (!fencedLines.has(line.number)) {
        const text = line.text
        const marks: Array<{ from: number; to: number; deco: Decoration }> = []
        if (DIRECTIVE.test(text)) {
          marks.push({ from: line.from, to: line.to, deco: directiveMark })
        } else {
          if (CAPTION.test(text)) {
            const end = text.search(/\s*\{[#.]/)
            marks.push({
              from: line.from,
              to: line.from + (end >= 0 ? end : text.length),
              deco: captionMark,
            })
          }
          for (const m of text.matchAll(ATTRS)) {
            marks.push({
              from: line.from + m.index!,
              to: line.from + m.index! + m[0].length,
              deco: attrMark,
            })
          }
          for (const m of text.matchAll(REF)) {
            const before = text[m.index! - 1]
            // name@example.com is an e-mail address, not a reference
            if (before && /[A-Za-z0-9_.]/.test(before)) continue
            const id = m[1].replace(/[-_]+$/, '')
            marks.push({
              from: line.from + m.index!,
              to: line.from + m.index! + 1 + id.length,
              deco: known.has(id) ? refMark : brokenRefMark,
            })
          }
        }
        marks
          .sort((a, b) => a.from - b.from || a.to - b.to)
          .forEach(mark => builder.add(mark.from, mark.to, mark.deco))
      }
      pos = line.to + 1
    }
  }
  return builder.finish()
}

const bookSyntax = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    known: Set<string>

    constructor(view: EditorView) {
      this.known = new Set(labelsInDoc(view.state.doc).map(l => l.id))
      this.decorations = buildDecorations(view, this.known)
    }

    update(update: ViewUpdate) {
      if (update.docChanged) {
        this.known = new Set(labelsInDoc(update.state.doc).map(l => l.id))
      }
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildDecorations(update.view, this.known)
      }
    }
  },
  { decorations: v => v.decorations }
)

const colours = EditorView.baseTheme({
  // VS Code Dark+
  '&dark .cm-line .ol-md-heading': { color: '#569cd6' },
  '&dark .cm-line .ol-md-link': { color: '#ce9178' },
  '&dark .cm-line .ol-md-url': { color: '#c8a26b' },
  '&dark .cm-line .ol-md-mark': { color: '#7f848e' },
  '&dark .cm-line .ol-md-code': { color: '#6a9955' },
  // VS Code Light+
  '&light .cm-line .ol-md-heading': { color: '#0451a5' },
  '&light .cm-line .ol-md-link': { color: '#a31515' },
  '&light .cm-line .ol-md-url': { color: '#8b5a2b' },
  '&light .cm-line .ol-md-mark': { color: '#9aa0a6' },
  '&light .cm-line .ol-md-code': { color: '#098658' },
  '.cm-line .ol-md-heading': { fontWeight: 'bold', textDecoration: 'none' },
  '.cm-line .ol-md-em': { fontStyle: 'italic' },
  '.cm-line .ol-md-strong': { fontWeight: 'bold' },
  '.cm-line .ol-md-strike': { textDecoration: 'line-through' },
})

const bookSyntaxTheme = EditorView.baseTheme({
  '&dark .cm-line .ol-md-attr': { color: '#808080' },
  '&light .cm-line .ol-md-attr': { color: '#8c8c8c' },
  '&dark .cm-line .ol-md-ref, &dark .cm-line .ol-md-directive': { color: '#c586c0' },
  '&light .cm-line .ol-md-ref, &light .cm-line .ol-md-directive': { color: '#af00db' },
  '.ol-md-directive': { fontWeight: 'bold' },
  '&dark .cm-line .ol-md-caption': { color: '#4ec9b0' },
  '&light .cm-line .ol-md-caption': { color: '#267f99' },
  '.ol-md-ref-missing': {
    textDecoration: 'underline wavy #f14c4c',
    textUnderlineOffset: '3px',
  },
})

export const markdownColours = (): Extension => [
  syntaxHighlighting(markdownClasses),
  colours,
  bookSyntax,
  bookSyntaxTheme,
]

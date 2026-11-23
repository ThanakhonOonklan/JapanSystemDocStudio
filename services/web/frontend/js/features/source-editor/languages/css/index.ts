// Documentation Studio REA: colours for style.css (and other CSS files).
//
// A small stream highlighter, enough for the book stylesheet:
//   selectors, @rules     blue
//   property:             light blue
//   values                orange (text) / green (numbers, colours)
//   /* comment */         green, italic

import {
  HighlightStyle,
  LanguageSupport,
  StreamLanguage,
  StringStream,
  syntaxHighlighting,
} from '@codemirror/language'
import { tags } from '@lezer/highlight'
import { EditorView } from '@codemirror/view'

type State = { inComment: boolean; depth: number; inValue: boolean }

const cssLanguage = StreamLanguage.define<State>({
  name: 'css',
  startState: () => ({ inComment: false, depth: 0, inValue: false }),
  token(stream: StringStream, state: State) {
    if (state.inComment) {
      if (stream.skipTo('*/')) {
        stream.match('*/')
        state.inComment = false
      } else {
        stream.skipToEnd()
      }
      return 'comment'
    }
    if (stream.eatSpace()) return null
    if (stream.match('/*')) {
      if (stream.skipTo('*/')) stream.match('*/')
      else {
        state.inComment = true
        stream.skipToEnd()
      }
      return 'comment'
    }
    const ch = stream.peek()
    if (ch === '{') {
      stream.next()
      state.depth++
      state.inValue = false
      return 'punctuation'
    }
    if (ch === '}') {
      stream.next()
      state.depth = Math.max(0, state.depth - 1)
      state.inValue = false
      return 'punctuation'
    }
    if (ch === ';') {
      stream.next()
      state.inValue = false
      return 'punctuation'
    }
    if (ch === '"' || ch === "'") {
      stream.next()
      let escaped = false
      let c: string | void
      while ((c = stream.next()) != null) {
        if (c === ch && !escaped) break
        escaped = !escaped && c === '\\'
      }
      return 'string'
    }
    if (ch === '@') {
      stream.match(/^@[\w-]+/)
      return 'keyword'
    }
    if (state.depth > 0 && !state.inValue) {
      // property name inside a block
      if (stream.match(/^[\w-]+(?=\s*:)/)) return 'propertyName'
      if (stream.match(':')) {
        state.inValue = true
        return 'punctuation'
      }
    }
    if (state.inValue) {
      if (stream.match(/^#[0-9a-fA-F]{3,8}\b/)) return 'number'
      if (stream.match(/^-?(\d+\.?\d*|\.\d+)(%|[a-zA-Z]+)?/)) return 'number'
      if (stream.match(/^!important/)) return 'keyword'
      if (stream.match(/^[\w-]+(?=\()/)) return 'atom'
      if (stream.match(/^[\w-]+/)) return 'string'
      stream.next()
      return null
    }
    // selector (outside a block, or nested selector)
    if (stream.match(/^[.#]?[\w-]+/)) return 'typeName'
    stream.next()
    return 'punctuation'
  },
  languageData: {
    commentTokens: { block: { open: '/*', close: '*/' } },
  },
})

// own class names + specific selectors, so the colours win over the editor
// themes' .tok-* rules (see yaml/index.ts)
const cssClasses = HighlightStyle.define([
  { tag: tags.typeName, class: 'ol-css-selector' },
  { tag: tags.keyword, class: 'ol-css-at' },
  { tag: tags.propertyName, class: 'ol-css-prop' },
  { tag: tags.string, class: 'ol-css-value' },
  { tag: tags.atom, class: 'ol-css-fn' },
  { tag: tags.number, class: 'ol-css-number' },
  { tag: tags.comment, class: 'ol-css-comment' },
  { tag: tags.punctuation, class: 'ol-css-mark' },
])

const colours = EditorView.baseTheme({
  '&dark .cm-line .ol-css-selector': { color: '#d7ba7d' },
  '&dark .cm-line .ol-css-at': { color: '#c586c0' },
  '&dark .cm-line .ol-css-prop': { color: '#9cdcfe' },
  '&dark .cm-line .ol-css-value': { color: '#ce9178' },
  '&dark .cm-line .ol-css-fn': { color: '#dcdcaa' },
  '&dark .cm-line .ol-css-number': { color: '#b5cea8' },
  '&dark .cm-line .ol-css-comment': { color: '#6a9955' },
  '&dark .cm-line .ol-css-mark': { color: '#7f848e' },
  '&light .cm-line .ol-css-selector': { color: '#800000' },
  '&light .cm-line .ol-css-at': { color: '#af00db' },
  '&light .cm-line .ol-css-prop': { color: '#0451a5' },
  '&light .cm-line .ol-css-value': { color: '#a31515' },
  '&light .cm-line .ol-css-fn': { color: '#795e26' },
  '&light .cm-line .ol-css-number': { color: '#098658' },
  '&light .cm-line .ol-css-comment': { color: '#008000' },
  '&light .cm-line .ol-css-mark': { color: '#9aa0a6' },
  '.cm-line .ol-css-comment': { fontStyle: 'italic' },
})

export const css = () =>
  new LanguageSupport(cssLanguage, [syntaxHighlighting(cssClasses), colours])

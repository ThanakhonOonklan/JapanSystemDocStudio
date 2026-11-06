// Documentation Studio REA: colours for book.yaml (and other YAML files).
//
// A small line-based highlighter, enough for configuration files:
//   key:            blue
//   values          orange (text) / green (numbers, true, false, null)
//   "#1a8ad6"       quoted strings, orange
//   # comment       grey
//   - list items    the dash is dimmed

import {
  HighlightStyle,
  LanguageSupport,
  StreamLanguage,
  StringStream,
  syntaxHighlighting,
} from '@codemirror/language'
import { tags } from '@lezer/highlight'
import { EditorView } from '@codemirror/view'

type State = { afterKey: boolean }

const yamlLanguage = StreamLanguage.define<State>({
  name: 'yaml',
  startState: () => ({ afterKey: false }),
  token(stream: StringStream, state: State) {
    if (stream.sol()) state.afterKey = false
    if (stream.eatSpace()) return null

    // comment: # at the start of a line or after a space
    if (stream.peek() === '#') {
      stream.skipToEnd()
      return 'comment'
    }
    // list item dash
    if (!state.afterKey && stream.match(/^-(?=\s|$)/)) {
      return 'punctuation'
    }
    // key:
    if (!state.afterKey && stream.match(/^[^\s#:'"][^:#]*?(?=:(\s|$))/)) {
      return 'propertyName'
    }
    if (stream.match(/^:(?=\s|$)/)) {
      state.afterKey = true
      return 'punctuation'
    }
    // quoted string
    const quote = stream.peek()
    if (quote === '"' || quote === "'") {
      stream.next()
      let escaped = false
      let ch: string | void
      while ((ch = stream.next()) != null) {
        if (ch === quote && !escaped) break
        escaped = !escaped && ch === '\\' && quote === '"'
      }
      return 'string'
    }
    if (stream.match(/^[[\]{},|>]/)) return 'punctuation'
    // a plain value up to a comment
    if (stream.match(/^(true|false|null|~)(?=\s*(#|$))/i)) return 'atom'
    if (stream.match(/^-?\d+(\.\d+)?(?=\s*(#|$))/)) return 'number'
    stream.match(/^[^#]*?(?=\s+#|$)/) || stream.next()
    return 'string'
  },
  languageData: {
    commentTokens: { line: '#' },
  },
})

// own class names + specific selectors, so the colours win over the editor
// themes' .tok-* rules (see markdown/highlight.ts)
const yamlClasses = HighlightStyle.define([
  { tag: tags.propertyName, class: 'ol-yaml-key' },
  { tag: tags.string, class: 'ol-yaml-string' },
  { tag: [tags.number, tags.atom], class: 'ol-yaml-number' },
  { tag: tags.comment, class: 'ol-yaml-comment' },
  { tag: tags.punctuation, class: 'ol-yaml-mark' },
])

const colours = EditorView.baseTheme({
  '&dark .cm-line .ol-yaml-key': { color: '#569cd6' },
  '&dark .cm-line .ol-yaml-string': { color: '#ce9178' },
  '&dark .cm-line .ol-yaml-number': { color: '#b5cea8' },
  '&dark .cm-line .ol-yaml-comment': { color: '#6a9955' },
  '&dark .cm-line .ol-yaml-mark': { color: '#7f848e' },
  '&light .cm-line .ol-yaml-key': { color: '#0451a5' },
  '&light .cm-line .ol-yaml-string': { color: '#a31515' },
  '&light .cm-line .ol-yaml-number': { color: '#098658' },
  '&light .cm-line .ol-yaml-comment': { color: '#008000' },
  '&light .cm-line .ol-yaml-mark': { color: '#9aa0a6' },
  '.cm-line .ol-yaml-comment': { fontStyle: 'italic' },
})

export const yaml = () =>
  new LanguageSupport(yamlLanguage, [syntaxHighlighting(yamlClasses), colours])

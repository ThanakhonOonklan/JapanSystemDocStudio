// Documentation Studio REA: autocomplete for Markdown books.
//
//   @         ids of the headings, figures and tables of the current file,
//             for cross-references such as @fig-flow
//   /         snippets for the patterns the book template understands
//             (figure, table with caption, headings with an id, code, note)

import {
  CompletionContext,
  CompletionResult,
  Completion,
  snippetCompletion,
} from '@codemirror/autocomplete'
import type { Text } from '@codemirror/state'

const ID_IN_LINE = /\{#([A-Za-z0-9_-]+)[^}]*\}/
const FENCE = /^\s{0,3}(```|~~~)/

type Label = { id: string; kind: 'figure' | 'table' | 'section'; text: string }

/** Ids defined with {#id} in the document, outside fenced code blocks. */
export function labelsInDoc(doc: Text): Label[] {
  const labels: Label[] = []
  let fence: string | null = null
  for (let number = 1; number <= doc.lines; number++) {
    const text = doc.line(number).text
    const fenceMatch = FENCE.exec(text)
    if (fenceMatch) {
      if (fence === null) fence = fenceMatch[1]
      else if (fence === fenceMatch[1]) fence = null
      continue
    }
    if (fence !== null) continue
    const match = ID_IN_LINE.exec(text)
    if (!match) continue
    const id = match[1]
    const kind = id.startsWith('fig-')
      ? 'figure'
      : id.startsWith('tbl-')
        ? 'table'
        : 'section'
    labels.push({
      id,
      kind,
      text: text.replace(ID_IN_LINE, '').replace(/^#+\s*|^[!:]\s*/, '').trim(),
    })
  }
  return labels
}

/** `@` followed by an id of this file. */
export function referenceCompletions(
  context: CompletionContext
): CompletionResult | null {
  const word = context.matchBefore(/@[A-Za-z0-9_-]*/)
  if (!word) return null
  // "name@example.com" is an e-mail address, not a reference
  if (word.from > 0 && /[A-Za-z0-9_.]/.test(context.state.sliceDoc(word.from - 1, word.from))) {
    return null
  }
  const options: Completion[] = labelsInDoc(context.state.doc).map(label => ({
    label: label.id,
    type: label.kind === 'section' ? 'label' : label.kind,
    detail: label.text.slice(0, 40),
  }))
  if (options.length === 0) return null
  return {
    from: word.from + 1, // keep the @
    options,
    validFor: /^[A-Za-z0-9_-]*$/,
  }
}

const SNIPPETS: Completion[] = [
  snippetCompletion(
    '![${caption}](../assets/${name}.png){#fig-${id} width=60%}',
    { label: '/figure', detail: 'numbered figure', type: 'snippet', boost: 3 }
  ),
  snippetCompletion(
    '| ${Column 1} | ${Column 2} |\n|---|---|\n| ${} | ${} |\n\n: ${Caption} {#tbl-${id}}',
    { label: '/table', detail: 'numbered table', type: 'snippet', boost: 2 }
  ),
  snippetCompletion('# ${Title} {#${id}}', {
    label: '/h1',
    detail: 'chapter heading with id',
    type: 'snippet',
  }),
  snippetCompletion('## ${Title} {#${id}}', {
    label: '/h2',
    detail: 'section heading with id',
    type: 'snippet',
  }),
  snippetCompletion('### ${Title} {#${id}}', {
    label: '/h3',
    detail: 'subsection heading with id',
    type: 'snippet',
  }),
  snippetCompletion('```${language}\n${}\n```', {
    label: '/code',
    detail: 'code block',
    type: 'snippet',
  }),
  snippetCompletion('> ${Note}', {
    label: '/note',
    detail: 'quote or note',
    type: 'snippet',
  }),
]

/** `/` at the start of a line. */
export function snippetCompletions(
  context: CompletionContext
): CompletionResult | null {
  const word = context.matchBefore(/\/[a-z0-9]*/)
  if (!word) return null
  const line = context.state.doc.lineAt(word.from)
  if (context.state.sliceDoc(line.from, word.from).trim() !== '') return null
  return {
    from: word.from,
    options: SNIPPETS,
    validFor: /^\/[a-z0-9]*$/,
  }
}

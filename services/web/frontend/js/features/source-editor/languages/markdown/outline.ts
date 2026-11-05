// File outline for Markdown documents: the headings, with the {#id} and
// {.class} attributes of the book syntax removed from the title.

import type { Text } from '@codemirror/state'

export type MarkdownOutlineItem = {
  level: number
  title: string
  line: number
}

const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/
const ATTRIBUTES = /\s*\{[^}]*\}\s*$/
const FENCE = /^\s{0,3}(```|~~~)/

export function markdownOutline(doc: Text): MarkdownOutlineItem[] {
  const items: MarkdownOutlineItem[] = []
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
    const match = HEADING.exec(text)
    if (!match) continue
    const title = match[2].replace(ATTRIBUTES, '').trim()
    if (title) items.push({ level: match[1].length, title, line: number })
  }
  return items
}

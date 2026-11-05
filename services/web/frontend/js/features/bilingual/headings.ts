// Find Markdown headings that carry an {#id}, so that the same section can
// be located in the Thai and the English file.
//
//   ## Installation {#install}

import type { Text } from '@codemirror/state'

export type HeadingAnchor = { id: string; line: number }

const HEADING_WITH_ID = /^#{1,6}\s.*\{#([A-Za-z0-9_-]+)[^}]*\}\s*$/
const FENCE = /^\s{0,3}(```|~~~)/

const cache = new WeakMap<Text, HeadingAnchor[]>()

/**
 * All headings with an id, in document order. Lines inside fenced code
 * blocks are ignored (they are examples, not headings).
 */
export function headingAnchors(doc: Text): HeadingAnchor[] {
  const cached = cache.get(doc)
  if (cached) return cached

  const anchors: HeadingAnchor[] = []
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
    const match = HEADING_WITH_ID.exec(text)
    if (match) anchors.push({ id: match[1], line: number })
  }
  cache.set(doc, anchors)
  return anchors
}

/** The last heading at or above `line`, or null before the first heading. */
export function anchorAtLine(doc: Text, line: number): HeadingAnchor | null {
  let found: HeadingAnchor | null = null
  for (const anchor of headingAnchors(doc)) {
    if (anchor.line > line) break
    found = anchor
  }
  return found
}

export function findAnchor(doc: Text, id: string): HeadingAnchor | null {
  return headingAnchors(doc).find(anchor => anchor.id === id) ?? null
}

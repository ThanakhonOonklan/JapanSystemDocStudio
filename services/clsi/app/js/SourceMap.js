// Click-to-source for Markdown books (see services/md-compile/lib/source-map.mjs).
//
// md-compile writes output.sourcemap.json next to the PDF: for every page the
// blocks of the Markdown files with their position in PDF points from the top
// left corner of the page. These functions answer the same two questions as
// `synctex edit` and `synctex view`, in the same shapes:
//
//   findCode(map, page, h, v)   -> [{ file, line, column }]
//   findPdf(map, file, line)    -> [{ page, h, v, width, height }]
//
// The browser draws the highlight of a PDF position with a vertical offset of
// 10 points (a quirk that suits SyncTeX baselines), so `v` is the top of the
// block plus 10.

import fs from 'node:fs/promises'
import Path from 'node:path'

const HIGHLIGHT_V_OFFSET = 10

/**
 * @param {string} directory folder holding the build output
 * @returns {Promise<object|null>} the map, or null when the build has none
 */
export async function readSourceMap(directory) {
  let text
  try {
    text = await fs.readFile(Path.join(directory, 'output.sourcemap.json'), 'utf8')
  } catch (err) {
    if (err.code === 'ENOENT') return null
    throw err
  }
  const map = JSON.parse(text)
  return map && map.version === 1 && Array.isArray(map.pages) ? map : null
}

/** "./th//a.md" and "/th/a.md" -> "th/a.md" */
export function normaliseFile(file) {
  return Path.posix.normalize(String(file).replace(/\\/g, '/')).replace(/^(\.\/|\/)+/, '')
}

const area = b => b.w * b.h
const distance = (value, from, to) =>
  value < from ? from - value : value > to ? value - to : 0

/**
 * The block under a point of the PDF: the smallest one that contains it, or,
 * for a click in a margin or between blocks, the nearest one.
 */
export function findCode(map, page, h, v) {
  const pageEntry = map.pages.find(p => p.page === page)
  if (!pageEntry || pageEntry.blocks.length === 0) return []

  let best = null
  let bestScore = Infinity
  for (const block of pageEntry.blocks) {
    const dy = distance(v, block.y, block.y + block.h)
    const dx = distance(h, block.x, block.x + block.w)
    // inside: score by area (smaller = more specific); outside: by distance,
    // always worse than any block that contains the point
    const score =
      dx === 0 && dy === 0 ? area(block) / 1e6 : 1 + dy * 1000 + dx + area(block) / 1e9
    if (score < bestScore) {
      best = block
      bestScore = score
    }
  }

  let line = best.first
  const lines = best.last - best.first + 1
  // a block of several source lines (code, a long list): take the line in the
  // same relative height
  if (lines > 1 && best.h > 0 && ['pre', 'code'].includes(best.tag)) {
    const fraction = Math.min(Math.max((v - best.y) / best.h, 0), 0.999)
    line = best.first + Math.floor(fraction * lines)
  }
  return [{ file: best.file, line, column: 0 }]
}

/**
 * Where a line of a file is in the PDF: the innermost block that covers the
 * line (it can be split over several pages), or the block just before it when
 * the line is blank.
 */
export function findPdf(map, file, line) {
  const wanted = normaliseFile(file)
  const candidates = []
  for (const pageEntry of map.pages) {
    for (const block of pageEntry.blocks) {
      if (normaliseFile(block.file) === wanted) {
        candidates.push({ page: pageEntry.page, block })
      }
    }
  }
  if (candidates.length === 0) return []

  let chosen = candidates.filter(
    c => c.block.first <= line && line <= c.block.last
  )
  if (chosen.length === 0) {
    // a blank line or a line that renders nothing: the closest block before it
    const before = candidates.filter(c => c.block.last < line)
    const pool = before.length > 0 ? before : candidates
    const nearest = pool.reduce((a, b) =>
      Math.abs(line - a.block.last) <= Math.abs(line - b.block.last) ? a : b
    )
    chosen = pool.filter(c => c.block.last === nearest.block.last)
  }

  // innermost: fewest source lines, then smallest on the page
  const span = c => c.block.last - c.block.first
  const minSpan = Math.min(...chosen.map(span))
  chosen = chosen.filter(c => span(c) === minSpan)
  const smallest = chosen.reduce((a, b) => (area(a.block) <= area(b.block) ? a : b))
  // all pieces of that element (the same tag and source range on other pages)
  return chosen
    .filter(
      c =>
        c.block.tag === smallest.block.tag &&
        c.block.first === smallest.block.first &&
        c.block.last === smallest.block.last
    )
    .map(({ page, block }) => ({
      page,
      h: block.x,
      v: block.y + HIGHLIGHT_V_OFFSET,
      width: block.w,
      height: block.h,
    }))
}

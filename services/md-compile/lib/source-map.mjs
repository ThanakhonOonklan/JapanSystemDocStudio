// Source map between the Markdown files and the PDF (click in the PDF -> go to
// the line, "go to PDF location" from the editor).
//
// After layout, every block that carries data-src="file:first-last" (see
// render.mjs) is measured on its page. The result is written next to the PDF:
//
//   output.sourcemap.json
//   { "version": 1,
//     "pages": [ { "page": 1, "width": 595.28, "height": 841.89,
//                  "blocks": [ { "file": "th/01-intro.md", "first": 4, "last": 4,
//                                "tag": "h1", "x": 113, "y": 108, "w": 380, "h": 28 } ] } ] }
//
// All lengths are PDF points (1/72 inch) from the top left corner of the page,
// like SyncTeX uses. clsi (services/clsi/app/js/SourceMap.js) answers the sync
// requests from this file when it exists.

import fs from 'node:fs/promises'

// CSS pixels (96 per inch) -> PDF points (72 per inch)
const PX_TO_PT = 0.75

/** "th/01-intro.md:15-17" -> { file, first, last } */
export function parseSrc(src) {
  const match = /^(.*):(\d+)-(\d+)$/.exec(src)
  if (!match) return null
  return { file: match[1], first: Number(match[2]), last: Number(match[3]) }
}

const round = n => Math.round(n * 100) / 100

/**
 * Measure all blocks of the laid out document.
 * `page` is a Playwright page showing the Paged.js output.
 */
export async function collectSourceMap(page) {
  const pages = await page.evaluate(() =>
    [...document.querySelectorAll('.pagedjs_page')].map((pg, index) => {
      const box = pg.getBoundingClientRect()
      const blocks = []
      for (const el of pg.querySelectorAll('.pagedjs_page_content [data-src]')) {
        const r = el.getBoundingClientRect()
        if (r.width <= 0 || r.height <= 0) continue
        blocks.push({
          src: el.getAttribute('data-src'),
          tag: el.tagName.toLowerCase(),
          x: r.left - box.left,
          y: r.top - box.top,
          w: r.width,
          h: r.height,
        })
      }
      return { page: index + 1, width: box.width, height: box.height, blocks }
    })
  )
  return {
    version: 1,
    pages: pages.map(p => ({
      page: p.page,
      width: round(p.width * PX_TO_PT),
      height: round(p.height * PX_TO_PT),
      blocks: p.blocks.flatMap(b => {
        const src = parseSrc(b.src ?? '')
        if (!src) return []
        return [
          {
            ...src,
            tag: b.tag,
            x: round(b.x * PX_TO_PT),
            y: round(b.y * PX_TO_PT),
            w: round(b.w * PX_TO_PT),
            h: round(b.h * PX_TO_PT),
          },
        ]
      }),
    })),
  }
}

export async function writeSourceMap(page, file) {
  const map = await collectSourceMap(page)
  await fs.writeFile(file, JSON.stringify(map))
  return map.pages.reduce((n, p) => n + p.blocks.length, 0)
}

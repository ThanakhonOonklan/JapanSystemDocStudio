import Path from 'node:path'
import fs from 'node:fs/promises'
import os from 'node:os'
import { expect, describe, beforeEach, it } from 'vitest'

const MODULE_PATH = Path.join(import.meta.dirname, '../../../app/js/SourceMap')

const block = (file, first, last, tag, x, y, w, h) => ({
  file,
  first,
  last,
  tag,
  x,
  y,
  w,
  h,
})

// page 1: a heading, a list with one item holding a figure, a code block;
// page 2: the rest of the code block (split over the page break)
const map = {
  version: 1,
  pages: [
    {
      page: 1,
      width: 595.28,
      height: 841.89,
      blocks: [
        block('th/a.md', 1, 1, 'h1', 100, 100, 400, 30),
        block('th/a.md', 3, 6, 'li', 100, 150, 400, 300),
        block('th/a.md', 3, 3, 'p', 100, 150, 400, 20),
        block('th/a.md', 5, 5, 'figure', 100, 180, 400, 250),
        block('th/a.md', 8, 11, 'pre', 100, 500, 400, 100),
        block('en/a.md', 1, 1, 'h1', 100, 650, 400, 30),
      ],
    },
    {
      page: 2,
      width: 595.28,
      height: 841.89,
      blocks: [block('th/a.md', 8, 11, 'pre', 100, 100, 400, 40)],
    },
  ],
}

describe('SourceMap', function () {
  beforeEach(async function (ctx) {
    ctx.SourceMap = await import(MODULE_PATH)
  })

  describe('findCode (click in the PDF)', function () {
    it('returns the smallest block under the point', function (ctx) {
      // inside the figure, which is inside the list item
      expect(ctx.SourceMap.findCode(map, 1, 200, 300)).toEqual([
        { file: 'th/a.md', line: 5, column: 0 },
      ])
      // on the step text: the paragraph, not the list item
      expect(ctx.SourceMap.findCode(map, 1, 200, 160)).toEqual([
        { file: 'th/a.md', line: 3, column: 0 },
      ])
    })

    it('takes the nearest block for a click in the margin', function (ctx) {
      expect(ctx.SourceMap.findCode(map, 1, 20, 115)).toEqual([
        { file: 'th/a.md', line: 1, column: 0 },
      ])
      // between the heading (ends at 130) and the list (starts at 150)
      expect(ctx.SourceMap.findCode(map, 1, 200, 133)[0].line).toBe(1)
    })

    it('picks the line inside a code block by height', function (ctx) {
      // block 8-11 spans y 500..600, 4 lines of 25 each
      expect(ctx.SourceMap.findCode(map, 1, 200, 505)[0].line).toBe(8)
      expect(ctx.SourceMap.findCode(map, 1, 200, 560)[0].line).toBe(10)
      expect(ctx.SourceMap.findCode(map, 1, 200, 599)[0].line).toBe(11)
    })

    it('returns nothing for a page without blocks', function (ctx) {
      expect(ctx.SourceMap.findCode(map, 9, 100, 100)).toEqual([])
      expect(
        ctx.SourceMap.findCode({ version: 1, pages: [{ page: 1, blocks: [] }] }, 1, 1, 1)
      ).toEqual([])
    })
  })

  describe('findPdf (go to PDF location)', function () {
    it('finds the innermost block of the line, highlight offset included', function (ctx) {
      expect(ctx.SourceMap.findPdf(map, 'th/a.md', 5)).toEqual([
        { page: 1, h: 100, v: 190, width: 400, height: 250 },
      ])
      expect(ctx.SourceMap.findPdf(map, 'th/a.md', 3)).toEqual([
        { page: 1, h: 100, v: 160, width: 400, height: 20 },
      ])
    })

    it('returns every piece of a block split over pages', function (ctx) {
      const positions = ctx.SourceMap.findPdf(map, 'th/a.md', 9)
      expect(positions.map(p => p.page)).toEqual([1, 2])
    })

    it('uses the block before a blank line', function (ctx) {
      // line 2 is blank: the heading (line 1) is the closest block before it
      expect(ctx.SourceMap.findPdf(map, 'th/a.md', 2)[0]).toMatchObject({
        page: 1,
        v: 110,
      })
    })

    it('accepts the path spellings the editor produces', function (ctx) {
      for (const file of ['./th/a.md', '/th/a.md', 'th/./a.md', 'th\\a.md']) {
        expect(ctx.SourceMap.findPdf(map, file, 1)).toHaveLength(1)
      }
    })

    it('does not mix up files, and ignores unknown ones', function (ctx) {
      expect(ctx.SourceMap.findPdf(map, 'en/a.md', 1)[0].v).toBe(660)
      expect(ctx.SourceMap.findPdf(map, 'nope.md', 1)).toEqual([])
    })
  })

  describe('readSourceMap', function () {
    it('reads the map, and returns null when there is none or it is not ours', async function (ctx) {
      const dir = await fs.mkdtemp(Path.join(os.tmpdir(), 'sourcemap-'))
      try {
        expect(await ctx.SourceMap.readSourceMap(dir)).toBeNull()
        await fs.writeFile(Path.join(dir, 'output.sourcemap.json'), JSON.stringify(map))
        expect((await ctx.SourceMap.readSourceMap(dir)).pages).toHaveLength(2)
        await fs.writeFile(Path.join(dir, 'output.sourcemap.json'), '{"version":2}')
        expect(await ctx.SourceMap.readSourceMap(dir)).toBeNull()
      } finally {
        await fs.rm(dir, { recursive: true, force: true })
      }
    })
  })
})

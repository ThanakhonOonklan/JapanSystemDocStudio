import { describe, it, expect } from 'vitest'
import {
  buildBookOutline,
  markdownHeadings,
  parseBookYaml,
} from '../../../../app/src/Features/BookOutline/BookOutline.mjs'

describe('BookOutline', function () {
  describe('markdownHeadings', function () {
    it('skips front matter and fenced code, strips attributes', function () {
      const lines = ['---', 'a: 1', '---', '# One', '```', '# no', '```', '## Two {#x}']
      expect(markdownHeadings(lines)).toEqual([
        { level: 1, title: 'One', line: 4 },
        { level: 2, title: 'Two', line: 8 },
      ])
    })
  })

  describe('parseBookYaml', function () {
    it('reads chapters, default language and languages', function () {
      const book = parseBookYaml(
        'title:\n  th: x\ndefaultLanguage: en\nlanguages: [th, "en"]\nchapters:\n  - 01.md # note\n  - file: 02.md\n    kind: appendix\n'
      )
      expect(book.defaultLanguage).toBe('en')
      expect(book.languages).toEqual(['th', 'en'])
      expect(book.chapters).toEqual([{ file: '01.md' }, { file: '02.md', kind: 'appendix' }])
    })
  })

  describe('buildBookOutline', function () {
    const docs = {
      '/book.yaml': ['defaultLanguage: th', 'chapters:', '  - 01-a.md', '  - 02-b.md'],
      '/th/01-a.md': ['# One', '## Two'],
      '/th/02-b.md': ['# B'],
      '/en/01-a.md': ['# E'],
    }

    it('lists the chapters of the default language in order', function () {
      const outline = buildBookOutline(docs)
      expect(outline.source).toBe('book')
      expect(outline.language).toBe('th')
      expect(outline.files.map(f => f.file)).toEqual(['th/01-a.md', 'th/02-b.md'])
    })

    it('honours the requested language and skips missing files', function () {
      const outline = buildBookOutline(docs, { language: 'en' })
      expect(outline.files.map(f => f.file)).toEqual(['en/01-a.md'])
    })

    it('reads a block-style languages list and any language folder', function () {
      const outline = buildBookOutline({
        '/book.yaml': [
          'defaultLanguage: ja   # comment',
          'languages:',
          '  - th',
          '  - ja',
          'chapters:',
          '  - 01.md',
        ],
        '/th/01.md': ['# ก'],
        '/ja/01.md': ['# 日本'],
      })
      expect(outline.languages).toEqual(['th', 'ja'])
      expect(outline.language).toBe('ja')
      expect(outline.files.map(f => f.file)).toEqual(['ja/01.md'])
    })

    it('follows defaultLanguage even when the languages list leaves it out', function () {
      const outline = buildBookOutline({
        '/book.yaml': [
          'defaultLanguage: en',
          'languages: [th]',
          'chapters:',
          '  - a.md',
        ],
        '/th/a.md': ['# ก'],
        '/en/a.md': ['# A'],
      })
      expect(outline.language).toBe('en')
      expect(outline.files.map(f => f.file)).toEqual(['en/a.md'])
    })

    it('ignores defaultLanguage when its folder has none of the chapters', function () {
      const outline = buildBookOutline({
        '/book.yaml': [
          'defaultLanguage: en',
          'languages: [th]',
          'chapters:',
          '  - a.md',
        ],
        '/th/a.md': ['# ก'],
        '/en/leftover.md': ['# x'],
      })
      expect(outline.language).toBe('th')
      expect(outline.files.map(f => f.file)).toEqual(['th/a.md'])
    })

    it('falls back to the Markdown files when there is no book.yaml', function () {
      const outline = buildBookOutline({ '/z.md': ['# Z'], '/a.md': ['# A'] })
      expect(outline.source).toBe('files')
      expect(outline.files.map(f => f.file)).toEqual(['a.md', 'z.md'])
    })
  })
})

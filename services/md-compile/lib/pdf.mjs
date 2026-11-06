// HTML -> PDF using Chromium (playwright-core) and Paged.js for pagination.

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from 'playwright-core'
import { computePageLabels } from './page-labels.mjs'

// pagedjs restricts its "exports" map, so locate the browser bundle by path.
const PAGED_POLYFILL = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'node_modules',
  'pagedjs',
  'dist',
  'paged.polyfill.js'
)

/**
 * Render each job to a PDF.
 *
 * @param {Array<{ htmlPath: string, pdfPath: string, label: string }>} jobs
 * @param {import('./log.mjs').Log} log
 * @param {{ timeoutMs: number }} options
 */
export async function renderPdfs(jobs, log, { timeoutMs }) {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  })
  try {
    for (const job of jobs) {
      await renderOne(browser, job, log, timeoutMs)
    }
  } finally {
    await browser.close()
  }
}

/**
 * Write the page numbers of templates that have their own rules: ask the page
 * which part of the book each page belongs to, compute the labels, and put
 * them into the margin boxes. Then fill in the contents pages (the page of
 * every entry) and repeat their title, "(ต่อ)" and column header on the
 * pages after the first.
 */
async function applyPageLabels(page, config) {
  const pages = await page.evaluate(() =>
    [...document.querySelectorAll('.pagedjs_page')].map(pg => {
      const content = pg.querySelector('.pagedjs_page_content')
      return {
        kind: content.querySelector('[data-kind]')?.dataset.kind ?? 'chapter',
        chapterStart: Boolean(content.querySelector('[data-chapter-start]')),
      }
    })
  )
  const labels = computePageLabels(pages, config)
  await page.evaluate(labels => {
    const allPages = [...document.querySelectorAll('.pagedjs_page')]
    const boxes = {
      'top-right': '.pagedjs_margin-top-right',
      'bottom-center': '.pagedjs_margin-bottom-center',
    }
    allPages.forEach((pg, index) => {
      for (const [position, selector] of Object.entries(boxes)) {
        const box = pg.querySelector(`${selector} .pagedjs_margin-content`)
        if (box) {
          box.textContent =
            labels[index].position === position ? labels[index].text : ''
        }
      }
    })

    // the page of each contents entry
    const pageOf = id => {
      const target = document.getElementById(id)
      const pg = target?.closest('.pagedjs_page')
      return pg ? allPages.indexOf(pg) : -1
    }
    for (const span of document.querySelectorAll('.contents-page[data-target]')) {
      const index = pageOf(span.dataset.target)
      span.textContent = index >= 0 ? labels[index].number : ''
    }

    // pages after the first of a contents section: draw the title with
    // "(ต่อ)" and the column header in the space the stylesheet keeps free
    // above the text (.contents-continued)
    const seen = new Set()
    for (const pg of allPages) {
      const fragment = pg.querySelector('.pagedjs_page_content [data-contents]')
      if (!fragment) continue
      const kind = fragment.dataset.contents
      if (!seen.has(kind)) {
        seen.add(kind)
        continue
      }
      const area = pg.querySelector('.pagedjs_area')
      if (!area) continue
      const header = document.createElement('div')
      header.className = `contents-continued contents-${kind}`
      const title = document.createElement('div')
      title.className = 'contents-title'
      title.textContent = `${fragment.dataset.title}  ${fragment.dataset.continued}`
      const head = document.createElement('div')
      head.className = 'contents-head'
      for (const text of [fragment.dataset.headLeft, fragment.dataset.headRight]) {
        const span = document.createElement('span')
        span.textContent = text || ''
        head.appendChild(span)
      }
      header.append(title, head)
      area.style.position = 'relative'
      area.appendChild(header)
    }
  }, labels)
}

/**
 * Find pages that end with something that belongs to what follows: a heading,
 * or the line that introduces a list, a screenshot or a table. They are
 * reported in the log so the author can fix the text.
 *
 * @returns {Promise<Array<{ page: number, kind: string, text: string }>>}
 */
export async function findStrandedEnds(page) {
  return await page.evaluate(() => {
    const issues = []
    const pages = [...document.querySelectorAll('.pagedjs_page')]
    pages.forEach((pg, index) => {
      const content = pg.querySelector('.pagedjs_page_content')
      if (!content) return
      const blocks = [...content.querySelectorAll('h1,h2,h3,h4,p,li,figure,table,pre')]
        // the contents pages are drawn by the page decorator
        .filter(el => !el.closest('.contents'))
      const last = blocks[blocks.length - 1]
      if (!last) return
      const text = (last.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 50)
      if (/^H[1-4]$/.test(last.tagName)) {
        issues.push({ page: index + 1, kind: 'heading', text })
      } else if (last.classList.contains('keep-with-next')) {
        issues.push({ page: index + 1, kind: 'introduction', text })
      }
    })
    return issues
  })
}

async function renderOne(
  browser,
  { htmlPath, pdfPath, label, pageLabels },
  log,
  timeoutMs
) {
  const context = await browser.newContext({ javaScriptEnabled: true })
  try {
    // The document cannot reach the network (it has no raw HTML anyway).
    await context.route(/^(https?|ftp|wss?):/i, route => route.abort())

    const page = await context.newPage()
    page.setDefaultTimeout(timeoutMs)
    page.on('pageerror', err => log.warn(`[${label}] page error: ${err.message}`))

    await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'load' })
    await page.evaluate(() => document.fonts.ready)
    await page.addScriptTag({ path: PAGED_POLYFILL })

    const pages = await page.evaluate(async () => {
      const flow = await window.PagedPolyfill.preview()
      return flow.total
    })
    log.info(`[${label}] laid out ${pages} pages`)

    if (pageLabels) {
      await applyPageLabels(page, pageLabels)
      log.info(`[${label}] page numbers written`)
    }

    for (const issue of await findStrandedEnds(page)) {
      log.warn(
        `[${label}] page ${issue.page} of the PDF ends with the ${issue.kind} "${issue.text}", the content it introduces is on the next page`
      )
    }

    await page.pdf({
      path: pdfPath,
      preferCSSPageSize: true,
      printBackground: true,
    })

    const { size } = await fs.stat(pdfPath)
    log.info(`[${label}] wrote ${pdfPath.split(/[\\/]/).pop()}, ${size} bytes`)
  } finally {
    await context.close()
  }
}

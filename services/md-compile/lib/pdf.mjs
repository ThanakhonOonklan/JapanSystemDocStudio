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
 * them into the margin boxes.
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
    const boxes = {
      'top-right': '.pagedjs_margin-top-right',
      'bottom-center': '.pagedjs_margin-bottom-center',
    }
    document.querySelectorAll('.pagedjs_page').forEach((pg, index) => {
      for (const [position, selector] of Object.entries(boxes)) {
        const box = pg.querySelector(`${selector} .pagedjs_margin-content`)
        if (box) {
          box.textContent =
            labels[index].position === position ? labels[index].text : ''
        }
      }
    })
  }, labels)
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

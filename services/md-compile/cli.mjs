#!/usr/bin/env node
// Documentation Studio REA: compile a Markdown project to PDF.
//
//   node cli.mjs <compileDir> <rootFile>
//
// Called by clsi (LatexRunner) instead of latexmk when the root file is
// Markdown or a book.yaml. Writes, inside <compileDir>:
//   output.pdf       the default language
//   output-<lang>.pdf  one per language when the book has several
//   output.log       messages shown in the log panel
//
// Exit code 0 = PDF written, 1 = compile failed (see output.log).

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Log } from './lib/log.mjs'
import { loadProject } from './lib/project.mjs'
import {
  buildDocument,
  renderChapters,
  renderCover,
  renderToc,
} from './lib/render.mjs'
import { renderPdfs } from './lib/pdf.mjs'
import { checkParity } from './lib/parity.mjs'
import { discoverFonts, fontFaceCss, fontFamilies } from './lib/fonts.mjs'
import { isInside } from './lib/paths.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const VERSION = JSON.parse(
  fs.readFileSync(path.join(here, 'package.json'), 'utf8')
).version
const TIMEOUT_MS = parseInt(process.env.MDC_TIMEOUT_MS || '150000', 10)

// Optional project stylesheet (book.yaml: `css: assets/custom.css`) applied
// after the default template.
function readCustomCss(compileDir, cssPath, log) {
  if (!cssPath) return ''
  const file = path.resolve(compileDir, cssPath)
  if (!isInside(compileDir, file) || !fs.existsSync(file)) {
    log.warn(`css file not found: ${cssPath}`)
    return ''
  }
  return '\n' + fs.readFileSync(file, 'utf8')
}

async function main() {
  const [compileDirArg, mainFile] = process.argv.slice(2)
  if (!compileDirArg || !mainFile) {
    console.error('usage: cli.mjs <compileDir> <rootFile>')
    return 2
  }
  const compileDir = path.resolve(compileDirArg)
  const log = new Log(compileDir)
  log.info(`Documentation Studio markdown compiler ${VERSION}`)
  log.info(`Root file: ${mainFile}`)

  // never leave a stale PDF from an earlier run behind
  for (const entry of fs.readdirSync(compileDir)) {
    if (/^output(-[A-Za-z-]+)?\.pdf$/.test(entry)) {
      fs.rmSync(path.join(compileDir, entry), { force: true })
    }
  }

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mdc-'))
  try {
    const project = loadProject(compileDir, mainFile, log)
    const { template } = project
    const templateCss = fs.readFileSync(template.css, 'utf8')
    const customCss = readCustomCss(compileDir, project.options.css, log)

    // fonts shipped with the template, then the project's own Font/ folder
    // (declared later, so a project font of the same name wins)
    const templateFonts = template.fontDir
      ? discoverFonts(template.fontDir, { direct: true })
      : []
    const projectFonts = discoverFonts(
      path.dirname(path.resolve(compileDir, mainFile))
    )
    if (projectFonts.length > 0) {
      log.info(`Fonts from the project: ${fontFamilies(projectFonts).join(', ')}`)
    }
    const fonts = [...templateFonts, ...projectFonts]
    for (const family of template.fonts) {
      if (!fontFamilies(fonts).includes(family)) {
        log.warn(
          `font ${family} was not found, a substitute font is used`
        )
      }
    }
    const css = fontFaceCss(fonts) + '\n' + templateCss

    const pageLabels = template.pageLabels
      ? { ...template.pageLabels, ...project.options.pageLabels }
      : null

    const jobs = []
    for (const language of project.languages) {
      if (language.files.length === 0) {
        log.error(`no chapters to build for ${language.code}`)
        continue
      }
      log.info(`[${language.code}] ${language.files.length} files`)
      const {
        html: body,
        headings,
        structure,
      } = renderChapters({
        files: language.files,
        compileDir,
        log,
        lang: language.code,
        numbering: project.options.numbering,
        chapterHeading: project.options.chapterHeading,
        numberSeparator: project.options.numberSeparator,
        kinds: language.kinds,
      })
      language.structure = structure
      const cover = project.options.cover
        ? renderCover({
            title: language.title,
            meta: language.meta,
            lang: language.code,
          })
        : ''
      const toc = project.options.toc
        ? renderToc({
            headings,
            depth: project.options.tocDepth,
            lang: language.code,
          })
        : ''
      const htmlPath = path.join(tmp, `${language.code}.html`)
      fs.writeFileSync(
        htmlPath,
        buildDocument({
          lang: language.code,
          title: language.title,
          cover,
          toc,
          body,
          css: css + customCss,
        })
      )
      // several languages: one PDF each, and output.pdf is a copy of the default
      const multiple = project.languages.length > 1
      jobs.push({
        htmlPath,
        pdfPath: path.join(
          compileDir,
          multiple ? `output-${language.code}.pdf` : 'output.pdf'
        ),
        label: language.code,
        pageLabels,
      })
    }

    // do the th/en versions have the same headings, figures and tables?
    if (project.options.parity !== 'off' && project.languages.length > 1) {
      const strict = project.options.parity === 'strict'
      const differences = checkParity({
        languages: project.languages.filter(l => l.structure),
        reference: project.defaultLanguage,
        compileDir,
        report: (message, location) =>
          strict ? log.error(message, location) : log.warn(message, location),
      })
      log.info(
        differences === 0
          ? 'Languages have the same structure.'
          : `Languages differ in ${differences} ${differences === 1 ? 'place' : 'places'}.`
      )
    }

    if (log.errors > 0 || jobs.length === 0) {
      throw new Error('the build was stopped because of the errors above')
    }
    await renderPdfs(jobs, log, { timeoutMs: TIMEOUT_MS })

    if (project.languages.length > 1) {
      const defaultPdf = path.join(
        compileDir,
        `output-${project.defaultLanguage}.pdf`
      )
      fs.copyFileSync(defaultPdf, path.join(compileDir, 'output.pdf'))
      log.info(`output.pdf is a copy of output-${project.defaultLanguage}.pdf`)
    }
    log.info('Done.')
    return 0
  } catch (err) {
    log.error(err.message)
    return 1
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
    await log.write(compileDir)
    process.stdout.write(log.toString())
  }
}

process.exitCode = await main()

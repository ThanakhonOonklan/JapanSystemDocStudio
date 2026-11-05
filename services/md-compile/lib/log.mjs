// Collects messages and writes them to output.log.
//
// The editor's log panel parses output.log with the LaTeX log parser, so
// warnings and errors are written in the shapes that parser understands.
// That gives them an entry in the Warnings/Errors lists and, when a file and
// line are known, a link to the place in the source:
//
//   (./th/02-install.md
//   LaTeX Warning: message on input line 12.
//
//   (./th/02-install.md
//   ! message.
//   l.12
//
// Keep parentheses out of messages: the parser treats "(" followed by a path
// as the start of a file.

import fs from 'node:fs/promises'
import path from 'node:path'

const LOG_WRAP_LIMIT = 79 // the parser joins lines that are exactly this long

export class Log {
  /**
   * @param {string} [compileDir] used to show locations relative to the project
   */
  constructor(compileDir) {
    this.compileDir = compileDir
    this.entries = []
    this.errors = 0
    this.warnings = 0
  }

  info(message) {
    this.entries.push({ type: 'info', message })
  }

  /**
   * @param {string} message
   * @param {{ file?: string, line?: number }} [location]
   */
  warn(message, location = {}) {
    this.warnings++
    this.entries.push({ type: 'warning', message, ...this.#locate(location) })
  }

  error(message, location = {}) {
    this.errors++
    this.entries.push({ type: 'error', message, ...this.#locate(location) })
  }

  #locate({ file, line } = {}) {
    if (!file) return {}
    const relative =
      this.compileDir && path.isAbsolute(file)
        ? path.relative(this.compileDir, file)
        : file
    return { file: relative.split(path.sep).join('/'), line }
  }

  toString() {
    const lines = []
    for (const entry of this.entries) {
      if (entry.type === 'info') {
        lines.push(entry.message)
        continue
      }
      if (entry.file) lines.push(`(./${entry.file}`)
      if (entry.type === 'warning') {
        const where = entry.line ? ` on input line ${entry.line}` : ''
        lines.push(`LaTeX Warning: ${entry.message}${where}.`)
      } else {
        lines.push(`! ${entry.message}.`, `l.${entry.line || 0} `, '')
      }
    }
    return (
      lines.map(l => (l.length === LOG_WRAP_LIMIT ? l + ' ' : l)).join('\n') +
      '\n'
    )
  }

  async write(compileDir) {
    await fs.writeFile(path.join(compileDir, 'output.log'), this.toString())
  }
}

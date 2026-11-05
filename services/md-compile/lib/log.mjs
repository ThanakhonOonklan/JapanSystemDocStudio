// Collects messages and writes them to output.log (shown in the log panel).

import fs from 'node:fs/promises'
import path from 'node:path'

export class Log {
  constructor() {
    this.lines = []
    this.errors = 0
    this.warnings = 0
  }

  info(message) {
    this.lines.push(message)
  }

  warn(message) {
    this.warnings++
    this.lines.push(`Warning: ${message}`)
  }

  error(message) {
    this.errors++
    this.lines.push(`Error: ${message}`)
  }

  toString() {
    return this.lines.join('\n') + '\n'
  }

  async write(compileDir) {
    await fs.writeFile(path.join(compileDir, 'output.log'), this.toString())
  }
}

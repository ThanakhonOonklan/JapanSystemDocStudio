// Documentation Studio REA: a book keeps one folder per language
// (th/ and en/) with the same file names in each. These helpers map a file
// to its counterpart in the other language.

export const LANGUAGE_FOLDERS = ['th', 'en'] as const

export type CounterpartInfo = {
  /** language folder of the file being edited, e.g. "th" */
  language: string
  /** language folder of the counterpart, e.g. "en" */
  counterpartLanguage: string
  /** path of the counterpart file, e.g. "en/01-intro.md" */
  path: string
}

/**
 * "th/01-intro.md" -> { language: "th", counterpartLanguage: "en", path: "en/01-intro.md" }
 * Returns null for files that are not inside a language folder.
 */
export function counterpartOf(path: string): CounterpartInfo | null {
  const [first, ...rest] = path.split('/')
  const index = (LANGUAGE_FOLDERS as readonly string[]).indexOf(first)
  if (index === -1 || rest.length === 0) {
    return null
  }
  const counterpartLanguage =
    LANGUAGE_FOLDERS[(index + 1) % LANGUAGE_FOLDERS.length]
  return {
    language: first,
    counterpartLanguage,
    path: [counterpartLanguage, ...rest].join('/'),
  }
}

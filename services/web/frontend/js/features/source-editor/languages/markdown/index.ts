import { markdown as markdownLanguage } from '@codemirror/lang-markdown'
import { shortcuts } from './shortcuts'
import { referenceCompletions, snippetCompletions } from './completions'
import { languages } from '../index'
import { Strikethrough, Table } from '@lezer/markdown'
import { Math } from './math'
import { LanguageSupport } from '@codemirror/language'
import { markdownColours } from './highlight'

export const markdown = () => {
  const { language, support } = markdownLanguage({
    codeLanguages: languages,
    extensions: [Strikethrough, Table, Math],
  })

  return new LanguageSupport(language, [
    support,
    shortcuts(),
    markdownColours(),
    // Documentation Studio REA: @references and /snippets
    language.data.of({ autocomplete: referenceCompletions }),
    language.data.of({ autocomplete: snippetCompletions }),
  ])
}

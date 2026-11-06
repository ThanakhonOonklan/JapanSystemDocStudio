// The cover page of a user manual.
//
// book.yaml (every text can be a plain value or a map per language):
//
//   title:
//     th: คู่มือการใช้งาน
//     en: User Manual
//   cover:
//     logo: images/logo.png              # above the organisation name
//     organization: Refrigerator Factory
//     subtitle: USER MANUAL              # under the title
//     system:                            # name of the system, bold
//       th: ระบบบริหารจัดการโรงงาน
//     description:                       # one line, or a list of lines
//       th:
//         - ใบเสนอราคา ใบสั่งผลิต สต็อก จัดซื้อ และบัญชี
//     preparedBy: Japan System           # under "จัดทำโดย"
//     background: images/cover-bg.png    # full-page image behind the text
//   theme:
//     primary: "#1a8ad6"                 # colour of the title, rule and author
//
// `subtitle`, `organization` and `author` at the top level of book.yaml are
// used when the cover does not set its own.

import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { isInside } from './paths.mjs'
import { strings } from './i18n.mjs'
import { escapeHtml } from './render.mjs'

const DEFAULT_PRIMARY = '#1a8ad6'
const COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i

function pick(value, lang) {
  if (value == null) return undefined
  if (typeof value === 'object' && !Array.isArray(value)) {
    return value[lang] ?? value.default ?? Object.values(value)[0]
  }
  return value
}

function text(value, lang) {
  const picked = pick(value, lang)
  if (picked == null || Array.isArray(picked)) return undefined
  const result = String(picked).trim()
  return result || undefined
}

function lines(value, lang) {
  const picked = pick(value, lang)
  if (picked == null) return []
  const list = Array.isArray(picked) ? picked : String(picked).split('\n')
  return list.map(line => String(line).trim()).filter(Boolean)
}

// an image of the project, as a file URL; missing or outside -> warning
function image(value, { compileDir, baseDir, log, field }) {
  if (typeof value !== 'string' || value.trim() === '') return undefined
  const file = path.resolve(baseDir, value.trim())
  if (!isInside(compileDir, file)) {
    log?.warn(`cover ${field} is outside the project: ${value}`)
    return undefined
  }
  if (!fs.existsSync(file)) {
    log?.warn(`cover ${field} not found: ${value}`)
    return undefined
  }
  return pathToFileURL(file).href
}

/**
 * Collect what the cover shows for one language.
 *
 * @param {object} source book.yaml (or the front matter of a single file)
 * @param {string} lang
 * @param {{ title?: string, compileDir: string, baseDir: string, log?: object }} context
 */
export function pickCover(source, lang, { title, compileDir, baseDir, log }) {
  const cover =
    source?.cover && typeof source.cover === 'object' ? source.cover : {}
  const primary = text(source?.theme?.primary, lang)
  if (primary && !COLOR.test(primary)) {
    log?.warn(`theme.primary must be a colour like "#1a8ad6": ${primary}`)
  }
  const context = { compileDir, baseDir, log }
  return {
    title: text(cover.title, lang) ?? title,
    subtitle: text(cover.subtitle ?? source?.subtitle, lang),
    organization: text(cover.organization ?? source?.organization, lang),
    system: text(cover.system, lang),
    description: lines(cover.description, lang),
    preparedBy: text(cover.preparedBy ?? source?.author, lang),
    logo: image(pick(cover.logo, lang), { ...context, field: 'logo' }),
    background: image(pick(cover.background, lang), {
      ...context,
      field: 'background',
    }),
    primary: primary && COLOR.test(primary) ? primary : DEFAULT_PRIMARY,
  }
}

/**
 * Cover page HTML. Empty when there is nothing to show.
 */
export function renderCover({ cover, lang }) {
  if (!cover?.title) return ''
  const t = strings(lang)
  const part = (cls, content) =>
    content ? `<p class="${cls}">${escapeHtml(content)}</p>` : ''
  const description = cover.description
    .map(line => part('cover-description', line))
    .join('\n')
  return `<section class="cover" data-kind="cover" style="--primary: ${cover.primary}">
${cover.background ? `<img class="cover-background" src="${escapeHtml(cover.background)}" alt="">` : ''}
<div class="cover-top">
${cover.logo ? `<img class="cover-logo" src="${escapeHtml(cover.logo)}" alt="">` : ''}
${part('cover-organization', cover.organization)}
</div>
<div class="cover-heading">
<h1 class="cover-title">${escapeHtml(cover.title)}</h1>
${part('cover-subtitle', cover.subtitle)}
</div>
<div class="cover-system">
${part('cover-system-name', cover.system)}
${description}
</div>
<div class="cover-rule"></div>
${
  cover.preparedBy
    ? `<div class="cover-bottom">
${part('cover-prepared-label', t.preparedBy)}
${part('cover-prepared-by', cover.preparedBy)}
</div>`
    : ''
}
</section>`
}

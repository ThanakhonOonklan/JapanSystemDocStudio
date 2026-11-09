import type {
  FooterItem,
  FooterMetadata,
} from '@/shared/components/types/footer-metadata'
import OLRow from '@/shared/components/ol/ol-row'
import OLCol from '@/shared/components/ol/ol-col'
import LanguagePicker from '@/shared/components/language-picker'
import getMeta from '@/utils/meta.ts'
import React from 'react'

function FooterItemLi({
  text,
  translatedText,
  url: href,
  class: className,
  label,
}: FooterItem) {
  const textToDisplay = translatedText || text

  if (!href) {
    return <li dangerouslySetInnerHTML={{ __html: textToDisplay }} />
  }

  const linkProps = {
    href,
    className,
    'aria-label': label,
  }

  return (
    <li>
      <a {...linkProps}>{textToDisplay}</a>
    </li>
  )
}

function Separator() {
  return (
    <li role="separator" className="text-muted">
      <strong>|</strong>
    </li>
  )
}

function ThinFooter({
  showPoweredBy,
  subdomainLang,
  leftItems,
  rightItems,
}: FooterMetadata) {
  const { env } = getMeta('ol-ExposedSettings')
  const showLanguagePicker = Boolean(
    subdomainLang && Object.keys(subdomainLang).length > 1
  )

  const hasCustomLeftNav = Boolean(leftItems && leftItems.length > 0)

  return (
    <footer className="site-footer">
      <div className="site-footer-content d-print-none">
        <OLRow>
          <ul className="site-footer-items col-lg-9">
            {showPoweredBy ? (
              <>
                <li>
                  {/* year of Server Pro release, static */}© 2026{' '}
                  Japan System
                </li>
                {showLanguagePicker || hasCustomLeftNav ? <Separator /> : null}
              </>
            ) : null}
            {showLanguagePicker ? (
              <>
                <li>
                  <LanguagePicker showHeader />
                </li>
                {hasCustomLeftNav ? <Separator /> : null}
              </>
            ) : null}
            {leftItems?.map(item => (
              <FooterItemLi key={item.text} {...item} />
            ))}
          </ul>
          <ul className="site-footer-items col-lg-3 text-end">
            {rightItems?.map(item => (
              <FooterItemLi key={item.text} {...item} />
            ))}
          </ul>
        </OLRow>
        {env === 'server-ce' && (
          <OLRow>
            <OLCol lg={12}>
              <p className="copyright-notice">
                This software is provided "AS IS", without warranty of any kind. Licensed under the GNU Affero General Public License v3.0.
              </p>
            </OLCol>
          </OLRow>
        )}
      </div>
    </footer>
  )
}

export default ThinFooter

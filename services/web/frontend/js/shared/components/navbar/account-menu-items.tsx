import { OLDropdownItem } from '@/shared/components/ol/ol-dropdown-menu'
import { useTranslation } from 'react-i18next'
import getMeta from '@/utils/meta'
import type { NavbarSessionUser } from '@/shared/components/types/navbar'
import DropdownListItem from '@/shared/components/dropdown/dropdown-list-item'
import NavDropdownDivider from './nav-dropdown-divider'
import ThemeToggle from '@/features/project-list/components/sidebar/theme-toggle'

export function AccountMenuItems({
  sessionUser,
  showSubscriptionLink,
  showThemeToggle = false,
}: {
  sessionUser: NavbarSessionUser
  showSubscriptionLink: boolean
  showThemeToggle?: boolean
}) {
  const { t } = useTranslation()
  const hasOverallThemes = Boolean(getMeta('ol-overallThemes'))
  const hasLoginHeader = Boolean(getMeta('ol-ExposedSettings')?.hasLoginHeader)

  return (
    <>
      <OLDropdownItem as="li" disabled role="menuitem">
        {sessionUser.email}
      </OLDropdownItem>
      <NavDropdownDivider />
      {showThemeToggle && hasOverallThemes && (
        <DropdownListItem>
          <ThemeToggle />
        </DropdownListItem>
      )}
      {hasLoginHeader && (
        <li role="none">
          {/* ends this session and goes to the login proxy's sign-out page */}
          <form method="POST" action="/logout">
            <input type="hidden" name="_csrf" value={getMeta('ol-csrfToken')} />
            <OLDropdownItem as="button" type="submit">
              {t('log_out')}
            </OLDropdownItem>
          </form>
        </li>
      )}
    </>
  )
}

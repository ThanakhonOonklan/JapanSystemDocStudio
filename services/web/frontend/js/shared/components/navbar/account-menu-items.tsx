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
    </>
  )
}

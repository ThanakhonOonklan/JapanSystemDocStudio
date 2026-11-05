import { useTranslation } from 'react-i18next'
import { ActivePage } from '../../util/navigation-state'

// Documentation Studio REA: there is a single list of projects, so the
// navigation dropdown is just a heading.
function NavigationDropdown({ activePage }: { activePage: ActivePage }) {
  const { t } = useTranslation()
  return (
    <h2 className="h3 ps-0 mb-0 text-truncate">
      {activePage === 'library' ? t('library') : t('all_projects')}
    </h2>
  )
}

export default NavigationDropdown

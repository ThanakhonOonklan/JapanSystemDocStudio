import { JSXElementConstructor } from 'react'
import { useTranslation } from 'react-i18next'
import classnames from 'classnames'
import SidebarFilters from './sidebar-filters'
import AddAffiliation, { useAddAffiliation } from '../add-affiliation'
import { usePersistedResize } from '@/shared/hooks/use-resize'
import { useScrolled } from '@/features/project-list/components/sidebar/use-scroll'
import { SurveyWidgetDsNav } from '@/features/project-list/components/survey-widget-ds-nav'
import { SidebarLowerSection } from '@/shared/components/sidebar/sidebar-lower-section'
import { DsNavOverleafLogo } from '@/shared/components/sidebar/ds-nav-overleaf-logo'
import importOverleafModules from '../../../../../macros/import-overleaf-module.macro'
import { ActivePage } from '../../util/navigation-state'

function SidebarDsNav({ activePage }: { activePage: ActivePage }) {
  const { t } = useTranslation()
  const { show: showAddAffiliationWidget } = useAddAffiliation()
  const [dsNavLibraryLinkModule] = importOverleafModules('dsNavLibraryLink')
  const DsNavLibraryLink: JSXElementConstructor<{
    active?: boolean
    inLibrary?: boolean
  }> = dsNavLibraryLinkModule?.import.default
  const { mousePos, getHandleProps, getTargetProps } = usePersistedResize({
    name: 'project-sidebar',
  })
  const { containerRef, scrolledUp } = useScrolled()

  return (
    <div
      className="project-list-sidebar-wrapper-react d-none d-md-flex"
      {...getTargetProps({
        style: {
          ...(mousePos?.x && { flexBasis: `${mousePos.x}px` }),
        },
      })}
    >
      {activePage === 'library' && <DsNavOverleafLogo />}
      <nav
        className="flex-grow flex-shrink"
        aria-label={t('project_categories_tags')}
      >
        <div
          className="project-list-sidebar-scroll"
          ref={containerRef}
          data-testid="project-list-sidebar-scroll"
        >
          <SidebarFilters activePage={activePage} />
          {showAddAffiliationWidget && <hr />}
          <AddAffiliation />
        </div>
      </nav>
      <div
        className={classnames(
          'ds-nav-sidebar-lower',
          scrolledUp && 'show-shadow'
        )}
      >
        <SidebarLowerSection showThemeToggle>
          {DsNavLibraryLink && (
            <DsNavLibraryLink
              active={activePage === 'library'}
              inLibrary={activePage === 'library'}
            />
          )}
          <div className="project-list-sidebar-survey-wrapper">
            <SurveyWidgetDsNav />
          </div>
        </SidebarLowerSection>
      </div>
      <div
        {...getHandleProps({
          style: {
            position: 'absolute',
            zIndex: 1,
            top: 0,
            right: '-2px',
            height: '100%',
            width: '4px',
          },
        })}
      />
    </div>
  )
}

export default SidebarDsNav

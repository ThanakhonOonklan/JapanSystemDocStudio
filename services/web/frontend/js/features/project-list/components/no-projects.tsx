import { useTranslation } from 'react-i18next'
import MaterialIcon from '@/shared/components/material-icon'
import NewProjectButton from '@/features/project-list/components/new-project-button'

type NoProjectsProps = {
  showNewProjectButton?: boolean
  // kept so callers can still say which list is empty
  activeSection?: string
}

function NoProjects({ showNewProjectButton }: NoProjectsProps) {
  const { t } = useTranslation()

  return (
    <div className="project-ds-empty-project-list">
      <div className="project-ds-empty-project-list-inner">
        <div className="project-ds-empty-project-list-icon">
          <MaterialIcon type="find_in_page" unfilled />
        </div>
        <div className="d-flex flex-column gap-1">
          <div className="project-ds-empty-project-list-title">
            {t('no_projects_yet')}
          </div>
          <div className="project-ds-empty-project-list-description">
            {t('projects_you_create_will_appear_here')}
          </div>
        </div>
        {showNewProjectButton && (
          <div className="text-center">
            <NewProjectButton
              id="new-project-button-no-projects"
              showAddAffiliationWidget
            />
          </div>
        )}
      </div>
    </div>
  )
}

export default NoProjects

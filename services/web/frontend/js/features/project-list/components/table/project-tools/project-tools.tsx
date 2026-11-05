import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { useProjectListContext } from '../../../context/project-list-context'
import DownloadProjectsButton from './buttons/download-projects-button'
import ProjectToolsMoreDropdownButton from './buttons/project-tools-more-dropdown-button'
import DeleteProjectsButton from './buttons/delete-projects-button'
import OLButtonToolbar from '@/shared/components/ol/ol-button-toolbar'
import OLButtonGroup from '@/shared/components/ol/ol-button-group'

function ProjectTools() {
  const { t } = useTranslation()
  const { selectedProjects } = useProjectListContext()

  return (
    <OLButtonToolbar aria-label={t('toolbar_selected_projects')}>
      <OLButtonGroup
        aria-label={t('toolbar_selected_projects_management_actions')}
      >
        <DownloadProjectsButton />
        <DeleteProjectsButton />
      </OLButtonGroup>

      {selectedProjects.length === 1 && <ProjectToolsMoreDropdownButton />}
    </OLButtonToolbar>
  )
}

export default memo(ProjectTools)

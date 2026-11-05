import { useTranslation } from 'react-i18next'
import {
  OLDropdown,
  OLDropdownItem,
  OLDropdownMenu,
  OLDropdownToggle,
} from '@/shared/components/ol/ol-dropdown-menu'
import CopyProjectButton from '../table/cells/action-buttons/copy-project-button'
import DownloadProjectButton from '../table/cells/action-buttons/download-project-button'
import DeleteProjectButton from '../table/cells/action-buttons/delete-project-button'
import { Project } from '../../../../../../types/project/dashboard/api'
import CompileAndDownloadProjectPDFButton from '../table/cells/action-buttons/compile-and-download-project-pdf-button'
import RenameProjectButton from '../table/cells/action-buttons/rename-project-button'
import MaterialIcon from '@/shared/components/material-icon'
import OLSpinner from '@/shared/components/ol/ol-spinner'

type ActionDropdownProps = {
  project: Project
}

function ActionsDropdown({ project }: ActionDropdownProps) {
  const { t } = useTranslation()

  return (
    <OLDropdown align="end">
      <OLDropdownToggle
        id={`project-actions-dropdown-toggle-btn-${project.id}`}
        bsPrefix="dropdown-table-button-toggle"
      >
        <MaterialIcon type="more_vert" accessibilityLabel={t('actions')} />
      </OLDropdownToggle>
      <OLDropdownMenu flip={false}>
        <RenameProjectButton project={project}>
          {(text, handleOpenModal) => (
            <li role="none">
              <OLDropdownItem
                as="button"
                tabIndex={-1}
                onClick={handleOpenModal}
                leadingIcon="edit"
              >
                {text}
              </OLDropdownItem>
            </li>
          )}
        </RenameProjectButton>
        <CopyProjectButton project={project}>
          {(text, handleOpenModal) => (
            <li role="none">
              <OLDropdownItem
                as="button"
                tabIndex={-1}
                onClick={handleOpenModal}
                leadingIcon="file_copy"
              >
                {text}
              </OLDropdownItem>
            </li>
          )}
        </CopyProjectButton>
        <DownloadProjectButton project={project}>
          {(text, downloadProject) => (
            <li role="none">
              <OLDropdownItem
                as="button"
                tabIndex={-1}
                onClick={downloadProject}
                leadingIcon="download"
              >
                {text}
              </OLDropdownItem>
            </li>
          )}
        </DownloadProjectButton>
        <CompileAndDownloadProjectPDFButton project={project}>
          {(text, pendingCompile, downloadProject) => (
            <li role="none">
              <OLDropdownItem
                as="button"
                tabIndex={-1}
                onClick={e => {
                  e.stopPropagation()
                  downloadProject()
                }}
                leadingIcon={
                  pendingCompile ? (
                    <OLSpinner
                      size="sm"
                      className="dropdown-item-leading-icon spinner"
                    />
                  ) : (
                    'picture_as_pdf'
                  )
                }
              >
                {text}
              </OLDropdownItem>
            </li>
          )}
        </CompileAndDownloadProjectPDFButton>
        <DeleteProjectButton project={project}>
          {(text, handleOpenModal) => (
            <li role="none">
              <OLDropdownItem
                as="button"
                tabIndex={-1}
                onClick={handleOpenModal}
                leadingIcon="block"
              >
                {text}
              </OLDropdownItem>
            </li>
          )}
        </DeleteProjectButton>
      </OLDropdownMenu>
    </OLDropdown>
  )
}

export default ActionsDropdown

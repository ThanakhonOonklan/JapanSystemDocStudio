import { memo, useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import DropdownMenuItem from '@/shared/components/dropdown/dropdown-menu-item'
import CloneProjectModal from '../../../../../clone-project-modal/components/clone-project-modal'
import useIsMounted from '../../../../../../shared/hooks/use-is-mounted'
import { useProjectListContext } from '../../../../context/project-list-context'
import * as eventTracking from '../../../../../../infrastructure/event-tracking'
import { ClonedProject } from '../../../../../../../../types/project/dashboard/api'
import { isSmallDevice } from '../../../../../../infrastructure/event-tracking'

function CopyProjectMenuItem() {
  const {
    addClonedProjectToViewData,
    toggleSelectedProject,
    selectedProjects,
  } = useProjectListContext()
  const { t } = useTranslation()
  const [showModal, setShowModal] = useState(false)
  const isMounted = useIsMounted()

  const handleOpenModal = useCallback(() => {
    setShowModal(true)
  }, [])

  const handleCloseModal = useCallback(() => {
    if (isMounted.current) {
      setShowModal(false)
    }
  }, [isMounted])

  const handleAfterCloned = useCallback(
    (clonedProject: ClonedProject) => {
      const project = selectedProjects[0]
      eventTracking.sendMB('project-list-page-interaction', {
        action: 'clone',
        projectId: project.id,
        isSmallDevice,
      })
      addClonedProjectToViewData(clonedProject)
      toggleSelectedProject(project.id, false)

      if (isMounted.current) {
        setShowModal(false)
      }
    },
    [
      isMounted,
      selectedProjects,
      addClonedProjectToViewData,
        toggleSelectedProject,
    ]
  )

  if (selectedProjects.length !== 1) return null

  if (selectedProjects[0].archived || selectedProjects[0].trashed) return null

  return (
    <>
      <DropdownMenuItem onClick={handleOpenModal} as="button" tabIndex={-1}>
        {t('make_a_copy')}
      </DropdownMenuItem>
      <CloneProjectModal
        show={showModal}
        handleHide={handleCloseModal}
        handleAfterCloned={handleAfterCloned}
        projectId={selectedProjects[0].id}
        projectName={selectedProjects[0].name}
      />
    </>
  )
}

export default memo(CopyProjectMenuItem)

import { OLModal } from '@/shared/components/ol/ol-modal'
import ModalContentNewProjectForm from './modal-content-new-project-form'
import { useFeatureFlag } from '@/shared/context/split-test-context'

type ExampleProjectModalProps = {
  onHide: () => void
}

function ExampleProjectModal({ onHide }: ExampleProjectModalProps) {
  const themed = useFeatureFlag('themed-modals')

  return (
    <OLModal
      show
      animation
      onHide={onHide}
      id="example-project-modal"
      backdrop="static"
      themed={themed}
      className="project-list-modal"
    >
      <ModalContentNewProjectForm
        onCancel={onHide}
        template="example"
       
      />
    </OLModal>
  )
}

export default ExampleProjectModal

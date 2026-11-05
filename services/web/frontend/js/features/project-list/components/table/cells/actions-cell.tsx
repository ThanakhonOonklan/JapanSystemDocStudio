import { Project } from '../../../../../../../types/project/dashboard/api'
import { CopyProjectButtonTooltip } from './action-buttons/copy-project-button'
import { DownloadProjectButtonTooltip } from './action-buttons/download-project-button'
import { DeleteProjectButtonTooltip } from './action-buttons/delete-project-button'
import { CompileAndDownloadProjectPDFButtonTooltip } from './action-buttons/compile-and-download-project-pdf-button'

type ActionsCellProps = {
  project: Project
}

export default function ActionsCell({ project }: ActionsCellProps) {
  return (
    <>
      <CopyProjectButtonTooltip project={project} />
      <DownloadProjectButtonTooltip project={project} />
      <CompileAndDownloadProjectPDFButtonTooltip project={project} />
      <DeleteProjectButtonTooltip project={project} />
    </>
  )
}

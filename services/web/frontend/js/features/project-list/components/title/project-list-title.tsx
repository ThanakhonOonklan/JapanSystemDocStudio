import { useTranslation } from 'react-i18next'
import classnames from 'classnames'

function ProjectListTitle({
  className,
}: {
  className?: string
}) {
  const { t } = useTranslation()

  return (
    <h1
      id="main-content"
      tabIndex={-1}
      className={classnames('project-list-title', className)}
    >
      {t('all_projects')}
    </h1>
  )
}

export default ProjectListTitle

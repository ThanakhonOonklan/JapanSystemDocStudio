import { FC, memo, useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import MaterialIcon from '@/shared/components/material-icon'
import { useOutlineContext } from '@/features/ide-react/context/outline-context'
import { useEditorOpenDocContext } from '@/features/ide-react/context/editor-open-doc-context'
import { useEditorManagerContext } from '@/features/ide-react/context/editor-manager-context'
import { useFileTreePathContext } from '@/features/file-tree/contexts/file-tree-path'
import { useFileTreeData } from '@/shared/context/file-tree-data-context'
import { useProjectContext } from '@/shared/context/project-context'
import { getJSON } from '@/infrastructure/fetch-json'
import { nestOutline } from '@/features/source-editor/utils/tree-operations/outline'
import { debugConsole } from '@/utils/debugging'
import withErrorBoundary from '@/infrastructure/error-boundary'
import OutlineList from './outline-list'

type BookHeading = { level: number; title: string; line: number }
type BookFile = { file: string; kind?: string; headings: BookHeading[] }
type BookOutlineData = {
  source: 'book' | 'files'
  language?: string
  languages: string[]
  files: BookFile[]
}

const isMarkdownName = (name: string | null | undefined) =>
  !!name && /\.(md|markdown)$/i.test(name)

// the outline of the whole book (server: BookOutline feature), in chapter
// order; the file being edited uses the live outline of the editor instead
const BookOutlineTree: FC = () => {
  const { t } = useTranslation()
  const { projectId } = useProjectContext()
  const { flatOutline, highlightedLine, jumpToLine } = useOutlineContext()
  const { currentDocumentId, openDocName } = useEditorOpenDocContext()
  const { openDocWithId } = useEditorManagerContext()
  const { pathInFolder, findEntityByPath } = useFileTreePathContext()
  const { fileTreeData } = useFileTreeData()
  const [data, setData] = useState<BookOutlineData | null>(null)

  const openPath = currentDocumentId ? pathInFolder(currentDocumentId) : null

  // reload when the project's files change or another file is opened (the
  // server flushes the editor's changes first, so earlier edits are included)
  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      getJSON<BookOutlineData>(`/project/${projectId}/outline`, {
        signal: controller.signal,
      })
        .then(setData)
        .catch(error => {
          if (!controller.signal.aborted) {
            debugConsole.error('Could not load the book outline', error)
          }
        })
    }, 400)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [projectId, fileTreeData, openPath])

  const openAt = useCallback(
    (file: string, line: number, syncToPdf: boolean) => {
      if (file === openPath) {
        jumpToLine(line, syncToPdf)
        return
      }
      const found = findEntityByPath(file)
      if (found?.type === 'doc') {
        openDocWithId(found.entity._id, {
          gotoLine: line,
          gotoColumn: 0,
          syncToPdf,
        }).catch(error => debugConsole.error('Could not open file', error))
      }
    },
    [openPath, jumpToLine, findEntityByPath, openDocWithId]
  )

  const files = useMemo(
    () =>
      (data?.files ?? []).map(file => {
        const isOpen = file.file === openPath
        const headings =
          isOpen && flatOutline && !flatOutline.partial
            ? flatOutline.items
            : file.headings
        return { ...file, isOpen, outline: nestOutline(headings) }
      }),
    [data, openPath, flatOutline]
  )

  if (!data) {
    return null
  }

  return (
    <div>
      {openDocName && !isMarkdownName(openDocName) && (
        <div className="outline-body-no-elements">
          {t('outline_file_has_no_structure')}
        </div>
      )}
      {files.length === 0 && (
        <div className="outline-body-no-elements">{t('outline_no_chapters')}</div>
      )}
      {files.map(file => (
        <div key={file.file} className="book-outline-file">
          <button
            type="button"
            className="book-outline-file-name"
            onClick={() => openAt(file.file, 1, false)}
            title={file.file}
          >
            <MaterialIcon type="description" />
            <span>{file.file.split('/').pop()}</span>
          </button>
          {file.outline.length > 0 && (
            <OutlineList
              outline={file.outline}
              jumpToLine={(line, syncToPdf) =>
                openAt(file.file, line, syncToPdf)
              }
              isRoot
              highlightedLine={file.isOpen ? highlightedLine : undefined}
              containsHighlightedLine={file.isOpen}
            />
          )}
        </div>
      ))}
    </div>
  )
}

export const OutlineContainer: FC = memo(() => {
  const { t } = useTranslation()
  const { outlineExpanded, toggleOutlineExpanded } = useOutlineContext()

  return (
    <div className="outline-container">
      <div className="outline-pane">
        <div className="outline-header">
          <button
            className="outline-header-expand-collapse-btn"
            onClick={toggleOutlineExpanded}
            aria-label={outlineExpanded ? t('hide_outline') : t('show_outline')}
          >
            <MaterialIcon
              type={
                outlineExpanded ? 'keyboard_arrow_down' : 'keyboard_arrow_right'
              }
              className="outline-caret-icon"
            />
            <h4 className="outline-header-name">{t('file_outline')}</h4>
          </button>
        </div>
        {outlineExpanded && (
          <div className="outline-body">
            <BookOutlineTree />
          </div>
        )}
      </div>
    </div>
  )
})
OutlineContainer.displayName = 'OutlineContainer'

export default withErrorBoundary(OutlineContainer)

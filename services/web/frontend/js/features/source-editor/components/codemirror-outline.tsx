import { useCodeMirrorStateContext } from './codemirror-context'
import React, { useEffect } from 'react'
import { documentOutline } from '../languages/latex/document-outline'
import { ProjectionStatus } from '../utils/tree-operations/projection'
import useDebounce from '../../../shared/hooks/use-debounce'
import { useOutlineContext } from '@/features/ide-react/context/outline-context'
import { useEditorOpenDocContext } from '@/features/ide-react/context/editor-open-doc-context'
import { markdownOutline } from '../languages/markdown/outline'

export const CodemirrorOutline = React.memo(function CodemirrorOutline() {
  const { setFlatOutline } = useOutlineContext()

  const state = useCodeMirrorStateContext()
  const debouncedState = useDebounce(state, 100)
  const outlineResult = debouncedState.field(documentOutline, false)
  const { openDocName } = useEditorOpenDocContext()
  const isMarkdown = /\.(md|markdown)$/i.test(openDocName ?? '')

  // when the outline projection changes, calculate the flat outline
  useEffect(() => {
    if (isMarkdown) {
      // Documentation Studio REA: Markdown headings
      setFlatOutline({
        items: markdownOutline(debouncedState.doc),
        partial: false,
      })
    } else if (
      outlineResult &&
      outlineResult.status !== ProjectionStatus.Pending
    ) {
      // We have a (potentially partial) outline.
      setFlatOutline({
        items: outlineResult.items.map(element => ({
          level: element.level,
          title: element.title,
          line: element.line,
        })),
        partial: outlineResult?.status === ProjectionStatus.Partial,
      })
    } else {
      setFlatOutline(undefined)
    }
  }, [outlineResult, setFlatOutline, isMarkdown, debouncedState])

  return null
})

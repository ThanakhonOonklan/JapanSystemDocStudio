import { EditorLoadingPane } from '@/features/ide-react/components/editor/editor-loading-pane'
import { useEditorOpenDocContext } from '@/features/ide-react/context/editor-open-doc-context'
import { useFileTreeOpenContext } from '@/features/ide-react/context/file-tree-open-context'
import classNames from 'classnames'
import SourceEditor from '@/features/source-editor/components/source-editor'
import { Panel, PanelGroup } from 'react-resizable-panels'
import { VerticalResizeHandle } from '@/features/ide-react/components/resize/vertical-resize-handle'
import { FC, Suspense } from 'react'
import { FullSizeLoadingSpinner } from '@/shared/components/loading-spinner'
import SymbolPalettePane from '@/features/ide-react/components/editor/symbol-palette-pane'
import { useEditorPropertiesContext } from '@/features/ide-react/context/editor-properties-context'
import { isSplitTestEnabled } from '@/utils/splitTestUtils'
import importOverleafModules from '../../../../../macros/import-overleaf-module.macro'
import { useFeatureFlag } from '@/shared/context/split-test-context.tsx'
import { HorizontalResizeHandle } from '@/features/ide-react/components/resize/horizontal-resize-handle'
import { CounterpartPane } from '@/features/bilingual/counterpart-pane'
import { useBilingualEnabled } from '@/features/bilingual/bilingual-store'

const [pythonRunnerModule] = importOverleafModules('pythonRunner') as {
  import: { PythonEditorSplit: FC }
}[]

export const Editor = () => {
  const { opening, errorState, showSymbolPalette } =
    useEditorPropertiesContext()
  const { selectedEntityCount, openEntity } = useFileTreeOpenContext()
  const { currentDocumentId, currentDocument } = useEditorOpenDocContext()

  const drawEnabled = useFeatureFlag('symbol-recognition')
  const bilingual = useBilingualEnabled()

  if (!currentDocumentId) {
    return null
  }

  const isLoading = Boolean(
    (!currentDocument || opening) && !errorState && currentDocumentId
  )

  const isPythonDocument =
    openEntity?.type === 'doc' &&
    openEntity.entity.name.toLowerCase().endsWith('.py')

  return (
    <div
      className={classNames('ide-redesign-editor-content', {
        hidden: openEntity?.type !== 'doc' || selectedEntityCount !== 1,
      })}
    >
      <PanelGroup
        autoSaveId="ide-redesign-editor-symbol-palette"
        direction="vertical"
      >
        <Panel
          id="ide-redesign-panel-source-editor"
          order={1}
          className="ide-redesign-editor-panel"
        >
          {/* Documentation Studio REA: optional Thai/English side-by-side.
              The main editor always sits in the first panel, so switching
              the translation view on or off does not remount it. */}
          <PanelGroup
            autoSaveId="docstudio-bilingual-editor"
            direction="horizontal"
          >
            <Panel
              id="docstudio-bilingual-main"
              order={1}
              minSize={25}
              style={{ position: 'relative' }}
            >
              {pythonRunnerModule &&
              isPythonDocument &&
              isSplitTestEnabled('overleaf-code') ? (
                <pythonRunnerModule.import.PythonEditorSplit />
              ) : (
                <SourceEditor />
              )}
              {isLoading && <EditorLoadingPane />}
            </Panel>
            {bilingual && (
              <>
                <HorizontalResizeHandle id="docstudio-bilingual-handle" />
                <Panel id="docstudio-bilingual-counterpart" order={2} minSize={25}>
                  <CounterpartPane />
                </Panel>
              </>
            )}
          </PanelGroup>
        </Panel>
        {showSymbolPalette && (
          <>
            <VerticalResizeHandle id="ide-redesign-editor-symbol-palette" />
            <Panel
              id="ide-redesign-panel-symbol-palette"
              order={2}
              defaultSize={drawEnabled ? 50 : 25}
              minSize={10}
              maxSize={50}
            >
              <Suspense fallback={<FullSizeLoadingSpinner delay={500} />}>
                <SymbolPalettePane />
              </Suspense>
            </Panel>
          </>
        )}
      </PanelGroup>
    </div>
  )
}

import {
  OLDropdownDivider,
  OLDropdownHeader,
  OLDropdownItem,
} from '@/shared/components/ol/ol-dropdown-menu'
import { MenuBar } from '@/shared/components/menu-bar/menu-bar'
import { MenuBarDropdown } from '@/shared/components/menu-bar/menu-bar-dropdown'
import { MenuBarOption } from '@/shared/components/menu-bar/menu-bar-option'
import { useTranslation } from 'react-i18next'
import ChangeLayoutOptions from './change-layout-options'
import { ElementType, useCallback, useMemo, useState } from 'react'
import { useCommandProvider } from '@/features/ide-react/hooks/use-command-provider'
import CommandDropdown, {
  CommandSection,
  MenuSectionStructure,
  MenuStructure,
} from './command-dropdown'
import useIsNetworkStalled from '@/features/ide-react/hooks/use-is-network-stalled'
import WordCountModal from '@/features/word-count-modal/components/word-count-modal'
import { isSplitTestEnabled } from '@/utils/splitTestUtils'
import { useDetachCompileContext as useCompileContext } from '@/shared/context/detach-compile-context'
import { useProjectSettingsContext } from '@/features/ide-settings/context/project-settings-context'
import getMeta from '@/utils/meta'
import EditorCloneProjectModalWrapper from '@/features/clone-project-modal/components/editor-clone-project-modal-wrapper'
import useOpenProject from '@/shared/hooks/use-open-project'
import importOverleafModules from '../../../../../macros/import-overleaf-module.macro'

const menubarExtraComponents = importOverleafModules(
  'menubarExtraComponents'
) as {
  import: { default: ElementType }
}[]

const insertMenuSections = importOverleafModules('insertMenuSections') as {
  import: { default: MenuSectionStructure[] }
}[]

export const ToolbarMenuBar = () => {
  const { t } = useTranslation()

  const { pdfUrl } = useCompileContext()
  const wordCountEnabled = pdfUrl || isSplitTestEnabled('word-count-client')
  const isDisabledDueToNetworkStall = useIsNetworkStalled()
  const [showWordCountModal, setShowWordCountModal] = useState(false)
  const [showCloneProjectModal, setShowCloneProjectModal] = useState(false)
  const openProject = useOpenProject()

  const anonymous = getMeta('ol-anonymous')

  useCommandProvider(
    () => [
      {
        type: 'command',
        label: t('word_count_lower'),
        disabled: !wordCountEnabled,
        handler: () => {
          setShowWordCountModal(true)
        },
        id: 'word_count',
      },
      {
        type: 'command',
        label: t('make_a_copy'),
        disabled: anonymous || isDisabledDueToNetworkStall,
        handler: () => {
          setShowCloneProjectModal(true)
        },
        id: 'copy_project',
      },
    ],
    [t, wordCountEnabled, anonymous, isDisabledDueToNetworkStall]
  )
  const fileMenuStructure: MenuStructure = useMemo(
    () => [
      {
        id: 'file-file-tree',
        children: ['new_file', 'new_folder', 'upload_file', 'copy_project'],
      },
      { id: 'submit', children: ['submit-project', 'manage-template'] },
      {
        id: 'file-download',
        children: [
          {
            id: 'file-download-group',
            title: t('download'),
            children: [
              'download-as-source-zip',
              'download-pdf',
              'export-as-docx',
              'export-as-markdown',
              'export-as-html',
            ],
          },
        ],
      },
      {
        id: 'settings',
        children: ['open-settings'],
      },
    ],
    [t]
  )

  const editMenuStructure: MenuStructure = useMemo(
    () => [
      {
        id: 'edit-undo-redo',
        children: ['undo', 'redo'],
      },
      {
        id: 'edit-search',
        children: ['find', 'select-all'],
      },
    ],
    []
  )

  const insertMenuStructure: MenuStructure = useMemo(
    () => [
      {
        id: 'insert-latex',
        children: [
          {
            id: 'insert-math-group',
            title: t('math'),
            children: ['insert-inline-math', 'insert-display-math'],
          },
          'insert-symbol',
          {
            id: 'insert-figure-group',
            title: t('figure'),
            children: [
              'insert-figure-from-computer',
              'insert-figure-from-project-files',
              'insert-figure-from-another-project',
              'insert-figure-from-url',
            ],
          },
          'insert-table',
          'insert-citation',
          'insert-link',
          'insert-cross-reference',
        ],
      },
      {
        id: 'insert-comment',
        children: ['comment'],
      },
      ...insertMenuSections.flatMap(
        ({ import: { default: sections } }) => sections
      ),
    ],
    [t]
  )

  const formatMenuStructure: MenuStructure = useMemo(
    () => [
      {
        id: 'format-text',
        children: ['format-bold', 'format-italics'],
      },
      {
        id: 'format-list',
        children: [
          'format-bullet-list',
          'format-numbered-list',
          'format-increase-indentation',
          'format-decrease-indentation',
        ],
      },
      {
        id: 'format-paragraph',
        title: t('paragraph_styles'),
        children: [
          'format-style-normal',
          'format-style-section',
          'format-style-subsection',
          'format-style-subsubsection',
          'format-style-paragraph',
          'format-style-subparagraph',
        ],
      },
    ],
    [t]
  )

  const pdfControlsMenuSectionStructure: MenuSectionStructure = useMemo(
    () => ({
      title: t('pdf_preview'),
      id: 'pdf-controls',
      children: [
        'view-pdf-presentation-mode',
        {
          id: 'pdf-zoom-control-group',
          title: t('pdf_zoom'),
          children: [
            'view-pdf-zoom-in',
            'view-pdf-zoom-out',
            'view-pdf-fit-width',
            'view-pdf-fit-height',
          ],
        },
      ],
    }),
    [t]
  )

  const commandPaletteMenuSectionStructure: MenuSectionStructure = useMemo(
    () => ({
      id: 'command-palette-group',
      children: ['command-palette'],
    }),
    []
  )

  const { editorTabs, setEditorTabs } = useProjectSettingsContext()

  const toggleEditorTabs = useCallback(() => {
    setEditorTabs(!editorTabs)
  }, [setEditorTabs, editorTabs])


  return (
    <>
      <MenuBar
        className="ide-redesign-toolbar-menu-bar"
        id="toolbar-menu-bar-item"
      >
        <CommandDropdown menu={fileMenuStructure} title={t('file')} id="file" />
        <CommandDropdown menu={editMenuStructure} title={t('edit')} id="edit" />
        <CommandDropdown
          menu={insertMenuStructure}
          title={t('insert')}
          id="insert"
        />
        <MenuBarDropdown
          title={t('view')}
          id="view"
          className="ide-redesign-toolbar-dropdown-toggle-subdued ide-redesign-toolbar-button-subdued"
        >
          <ChangeLayoutOptions />
          <OLDropdownDivider />
          <OLDropdownHeader>{t('editor_settings')}</OLDropdownHeader>
          <MenuBarOption
            eventKey="show_editor_tabs"
            title={t('show_editor_tabs')}
            leadingIcon={
              editorTabs ? 'check' : <OLDropdownItem.EmptyLeadingIcon />
            }
            onClick={toggleEditorTabs}
          />
          <CommandSection
            section={commandPaletteMenuSectionStructure}
            includeDivider
          />
          <CommandSection
            section={pdfControlsMenuSectionStructure}
            includeDivider
          />
        </MenuBarDropdown>
        <CommandDropdown
          menu={formatMenuStructure}
          title={t('format')}
          id="format"
        />
      </MenuBar>
      <WordCountModal
        show={showWordCountModal}
        handleHide={() => setShowWordCountModal(false)}
      />
      <EditorCloneProjectModalWrapper
        show={showCloneProjectModal}
        handleHide={() => setShowCloneProjectModal(false)}
        openProject={openProject}
      />
      {menubarExtraComponents.map(
        ({ import: { default: Component } }, index) => (
          <Component key={index} />
        )
      )}
    </>
  )
}

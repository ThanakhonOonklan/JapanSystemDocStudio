// Documentation Studio REA: a second, live editor showing the same file in
// the other language (th/x.md next to en/x.md).
//
// It joins the counterpart document through the same real-time layer as the
// main editor (OpenDocuments / DocumentContainer + the `realtime` extension),
// so edits made here are saved and shared like any other edit. Both editors
// scroll to the same section: sections are matched by their {#id}.

import { FC, useEffect, useRef, useState } from 'react'
import { EditorState } from '@codemirror/state'
import {
  EditorView,
  drawSelection,
  highlightActiveLine,
  keymap,
  lineNumbers,
} from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { useEditorManagerContext } from '@/features/ide-react/context/editor-manager-context'
import { useEditorOpenDocContext } from '@/features/ide-react/context/editor-open-doc-context'
import { useEditorViewContext } from '@/features/ide-react/context/editor-view-context'
import { useFileTreePathContext } from '@/features/file-tree/contexts/file-tree-path'
import { useUserSettingsContext } from '@/shared/context/user-settings-context'
import { useActiveOverallTheme } from '@/shared/hooks/use-active-overall-theme'
import { theme } from '@/features/source-editor/extensions/theme'
import { realtime } from '@/features/source-editor/extensions/realtime'
import { debugConsole } from '@/utils/debugging'
import { counterpartOf } from './language-pairs'
import { anchorAtLine, findAnchor } from './headings'
import {
  setBilingualEnabled,
  setBilingualSyncScroll,
  useBilingualSyncScroll,
} from './bilingual-store'

type Status = 'idle' | 'loading' | 'ready' | 'error'

const LANGUAGE_NAMES: Record<string, string> = { th: 'ไทย', en: 'English' }

/** Id of the section shown at the top of an editor. */
function topAnchorId(view: EditorView): string | null {
  const top = view.scrollDOM.scrollTop - view.documentPadding.top
  const block = view.lineBlockAtHeight(Math.max(top, 0))
  const line = view.state.doc.lineAt(block.from).number
  return anchorAtLine(view.state.doc, line)?.id ?? null
}

function scrollToAnchor(view: EditorView, id: string) {
  const anchor = findAnchor(view.state.doc, id)
  if (!anchor) return
  view.dispatch({
    effects: EditorView.scrollIntoView(view.state.doc.line(anchor.line).from, {
      y: 'start',
      yMargin: 0,
    }),
  })
}

export const CounterpartPane: FC = () => {
  const { openDocs } = useEditorManagerContext()
  const { currentDocumentId } = useEditorOpenDocContext()
  const { pathInFolder, findEntityByPath } = useFileTreePathContext()
  const { view: mainView } = useEditorViewContext()
  const { userSettings } = useUserSettingsContext()
  const activeOverallTheme = useActiveOverallTheme()
  const syncScroll = useBilingualSyncScroll()

  const mainPath = currentDocumentId ? pathInFolder(currentDocumentId) : null
  const pair = mainPath ? counterpartOf(mainPath) : null
  const found = pair ? findEntityByPath(pair.path) : null
  const counterpartId =
    found?.type === 'doc' && found.entity._id !== currentDocumentId
      ? (found.entity._id as string)
      : null

  const containerRef = useRef<HTMLDivElement>(null)
  const [paneView, setPaneView] = useState<EditorView | null>(null)
  const [status, setStatus] = useState<Status>('idle')

  // keep the theme options in a ref: the editor is created once per document
  const themeRef = useRef({
    fontSize: userSettings.fontSize,
    fontFamily: userSettings.fontFamily,
    lineHeight: userSettings.lineHeight,
    activeOverallTheme,
  })
  themeRef.current = {
    fontSize: userSettings.fontSize,
    fontFamily: userSettings.fontFamily,
    lineHeight: userSettings.lineHeight,
    activeOverallTheme,
  }

  // Join the counterpart document and show it in a CodeMirror view.
  useEffect(() => {
    if (!counterpartId || !containerRef.current) {
      setStatus('idle')
      return
    }
    const parent = containerRef.current
    const container = openDocs.getDocument(counterpartId)
    if (!container) {
      setStatus('error')
      return
    }

    let cancelled = false
    let view: EditorView | null = null
    setStatus('loading')

    const onError = (error: unknown) => {
      debugConsole.error('[bilingual] counterpart document error', error)
      if (!cancelled) setStatus('error')
    }
    container.on('error', onError)

    container.join(error => {
      if (cancelled) {
        container.leaveAndCleanUp()
        return
      }
      const snapshot = container.getSnapshot()
      if (error || typeof snapshot !== 'string') {
        onError(error ?? new Error('counterpart document has no text'))
        return
      }
      view = new EditorView({
        parent,
        state: EditorState.create({
          doc: snapshot,
          extensions: [
            lineNumbers(),
            history(),
            drawSelection(),
            highlightActiveLine(),
            EditorView.lineWrapping,
            keymap.of([...defaultKeymap, ...historyKeymap]),
            markdown(),
            theme(themeRef.current),
            // connects edits to the shared document, like the main editor
            realtime({ currentDoc: container }, onError),
          ],
        }),
      })
      setPaneView(view)
      setStatus('ready')
    })

    return () => {
      cancelled = true
      container.off('error', onError)
      setPaneView(null)
      if (view) {
        view.destroy()
        // flushes pending edits, then leaves the document
        container.leaveAndCleanUp()
      }
    }
  }, [counterpartId, openDocs])

  // Scroll both editors to the same section. Only the editor the user is
  // working in drives the other one, so they cannot trigger each other.
  useEffect(() => {
    if (!mainView || !paneView || !syncScroll) return

    let active: 'main' | 'pane' = 'main'
    const lastAnchor: Record<'main' | 'pane', string | null> = {
      main: null,
      pane: null,
    }
    const views = { main: mainView, pane: paneView }
    const cleanups: Array<() => void> = []

    const follow = (source: 'main' | 'pane') => {
      if (active !== source) return
      const target = source === 'main' ? 'pane' : 'main'
      const id = topAnchorId(views[source])
      if (id === lastAnchor[source]) return
      lastAnchor[source] = id
      if (id) scrollToAnchor(views[target], id)
    }

    for (const side of ['main', 'pane'] as const) {
      const view = views[side]
      const activate = () => {
        active = side
      }
      let frame = 0
      const onScroll = () => {
        cancelAnimationFrame(frame)
        frame = requestAnimationFrame(() => follow(side))
      }
      // whichever editor the user last touched (pointer, wheel, keys, focus)
      // is the one that drives the other
      const activation = [
        'pointerenter',
        'pointerdown',
        'focusin',
        'wheel',
        'keydown',
      ]
      for (const type of activation) {
        view.dom.addEventListener(type, activate, { passive: true })
      }
      view.scrollDOM.addEventListener('scroll', onScroll, { passive: true })
      cleanups.push(() => {
        cancelAnimationFrame(frame)
        for (const type of activation) {
          view.dom.removeEventListener(type, activate)
        }
        view.scrollDOM.removeEventListener('scroll', onScroll)
      })
    }

    // line the pane up with the main editor when it opens
    const initial = topAnchorId(mainView)
    if (initial) scrollToAnchor(paneView, initial)

    return () => cleanups.forEach(cleanup => cleanup())
  }, [mainView, paneView, syncScroll, mainPath])

  const label = pair
    ? `${LANGUAGE_NAMES[pair.counterpartLanguage] ?? pair.counterpartLanguage} · ${pair.path}`
    : ''

  let message: string | null = null
  if (!pair) {
    message =
      'Open a file inside the th/ or en/ folder to edit it next to its translation.'
  } else if (!counterpartId) {
    message = `There is no ${pair.path} yet. Create it with the same name in the ${pair.counterpartLanguage}/ folder.`
  } else if (status === 'error') {
    message = `Could not open ${pair.path}.`
  }

  return (
    <div className="bilingual-pane" style={paneStyle}>
      <div style={headerStyle}>
        <span style={{ fontWeight: 600 }}>{label || 'Translation'}</span>
        <span style={{ flex: 1 }} />
        <label style={{ fontWeight: 400, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={syncScroll}
            onChange={event => setBilingualSyncScroll(event.target.checked)}
          />{' '}
          Sync scroll
        </label>
        <button
          type="button"
          style={closeStyle}
          onClick={() => setBilingualEnabled(false)}
          aria-label="Close translation view"
          title="Close translation view"
        >
          ×
        </button>
      </div>
      {message && <div style={messageStyle}>{message}</div>}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
          display: message ? 'none' : 'block',
        }}
      />
    </div>
  )
}

const paneStyle = {
  display: 'flex',
  flexDirection: 'column' as const,
  height: '100%',
  borderLeft: '1px solid var(--border-primary, rgba(128, 128, 128, 0.4))',
}

const headerStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '4px 10px',
  fontSize: 12,
  borderBottom: '1px solid var(--border-primary, rgba(128, 128, 128, 0.4))',
}

const closeStyle = {
  background: 'none',
  border: 0,
  color: 'inherit',
  fontSize: 18,
  lineHeight: 1,
  cursor: 'pointer',
}

const messageStyle = {
  padding: 16,
  fontSize: 13,
  opacity: 0.85,
}

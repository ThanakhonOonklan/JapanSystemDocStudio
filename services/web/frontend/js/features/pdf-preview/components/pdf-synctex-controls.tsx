import { memo } from 'react'
import { useDetachCompileContext as useCompileContext } from '../../../shared/context/detach-compile-context'
import { useLayoutContext } from '../../../shared/context/layout-context'
import { useTranslation } from 'react-i18next'
import useSynctex from '../hooks/use-synctex'
import { useCommandProvider } from '@/features/ide-react/hooks/use-command-provider'

// Documentation Studio: the two arrow buttons between the editor and the PDF
// were removed. What is left registers the "go to ... location" commands (menu
// and command palette); clicking the PDF and the outline still jump too.
function GoToCodeCommand({
  syncToCode,
  syncToCodeInFlight,
}: {
  syncToCode: ({ visualOffset }: { visualOffset: number }) => void
  syncToCodeInFlight: boolean
}) {
  const { t } = useTranslation()
  useCommandProvider(
    () => [
      {
        id: 'synctex-sync-to-code',
        handler: () => {
          syncToCode({ visualOffset: 72 })
        },
        disabled: syncToCodeInFlight,
        label: t('go_to_pdf_location_in_code_action'),
      },
    ],
    [t, syncToCode, syncToCodeInFlight]
  )
  return null
}

function GoToPdfCommand({
  syncToPdf,
  syncToPdfInFlight,
  canSyncToPdf,
}: {
  syncToPdf: () => void
  syncToPdfInFlight: boolean
  canSyncToPdf: boolean
}) {
  const { t } = useTranslation()
  useCommandProvider(
    () => [
      {
        id: 'synctex-sync-to-pdf',
        handler: () => {
          syncToPdf()
        },
        label: t('go_to_code_location_in_pdf'),
        disabled: syncToPdfInFlight || !canSyncToPdf,
      },
    ],
    [t, syncToPdf, syncToPdfInFlight, canSyncToPdf]
  )
  return null
}

function PdfSynctexControls() {
  const { detachRole } = useLayoutContext()
  const { pdfUrl, pdfViewer, position } = useCompileContext()
  const {
    syncToCode,
    syncToPdf,
    syncToCodeInFlight,
    syncToPdfInFlight,
    canSyncToPdf,
  } = useSynctex()

  if (!position) {
    return null
  }

  if (!pdfUrl || pdfViewer === 'native') {
    return null
  }

  if (detachRole === 'detacher') {
    return (
      <GoToPdfCommand
        syncToPdf={syncToPdf}
        syncToPdfInFlight={syncToPdfInFlight}
        canSyncToPdf={canSyncToPdf}
      />
    )
  } else if (detachRole === 'detached') {
    return (
      <GoToCodeCommand
        syncToCode={syncToCode}
        syncToCodeInFlight={syncToCodeInFlight}
      />
    )
  } else {
    return (
      <>
        <GoToPdfCommand
          syncToPdf={syncToPdf}
          syncToPdfInFlight={syncToPdfInFlight}
          canSyncToPdf={canSyncToPdf}
        />
        <GoToCodeCommand
          syncToCode={syncToCode}
          syncToCodeInFlight={syncToCodeInFlight}
        />
      </>
    )
  }
}

export default memo(PdfSynctexControls)

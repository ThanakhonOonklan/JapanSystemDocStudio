import { useTranslation } from 'react-i18next'
import { ToolbarMenuBar } from './menu-bar'
import { ToolbarProjectTitle } from './project-title'
import ChangeLayoutButton from './change-layout-button'
import { useLayoutContext } from '@/shared/context/layout-context'
import { useCallback } from 'react'
import * as eventTracking from '../../../../infrastructure/event-tracking'
import { ToolbarLogos } from './logos'
import { useEditorContext } from '@/shared/context/editor-context'
import importOverleafModules from '../../../../../macros/import-overleaf-module.macro'
import UpgradeButton from './upgrade-button'
import getMeta from '@/utils/meta'
import { useIdeReactContext } from '@/features/ide-react/context/ide-react-context'
import { useFeatureFlag } from '@/shared/context/split-test-context'
import useIsNetworkStalled from '@/features/ide-react/hooks/use-is-network-stalled'
import OLIconButton from '@/shared/components/ol/ol-icon-button'
import OLTooltip from '@/shared/components/ol/ol-tooltip'
import OfflineIndicator from './offline-indicator'

const [publishModalModules] = importOverleafModules('publishModalToolbarButton')
const SubmitProjectButton = publishModalModules?.import.default

export const Toolbar = () => {
  const { view, focusMode, setFocusMode, pdfLayout, setView } =
    useLayoutContext()
  const { cobranding } = useEditorContext()
  const { permissionsLevel } = useIdeReactContext()
  const showUpgradePrompt = getMeta('ol-showUpgradePrompt')
  const improvedFlakyConnections = useFeatureFlag(
    'intermittent-connection-improvements'
  )
  const { t } = useTranslation()

  const isOfflineDueToNetworkStall = useIsNetworkStalled()
  const shouldDisplaySubmitButton =
    (permissionsLevel === 'owner' || permissionsLevel === 'readAndWrite') &&
    SubmitProjectButton

  const handleExitFocusMode = useCallback(() => {
    setFocusMode(false)
    eventTracking.sendMB('focus-mode-exit')
  }, [setFocusMode])

  const handleSwitchView = useCallback(() => {
    const newView = view === 'pdf' ? 'editor' : 'pdf'
    setView(newView)
    eventTracking.sendMB('focus-mode-switch-view', { view: newView })
  }, [view, setView])

  if (focusMode) {
    const showViewSwitcher = pdfLayout === 'flat'
    const switchTooltip =
      view === 'pdf' ? t('switch_to_editor') : t('switch_to_pdf')
    const switchIcon = view === 'pdf' ? 'edit' : 'picture_as_pdf'

    return (
      <nav className="ide-redesign-toolbar" aria-label={t('project_actions')}>
        <div className="ide-redesign-toolbar-menu">
          <ToolbarLogos cobranding={cobranding} />
        </div>
        <ToolbarProjectTitle />
        <div className="ide-redesign-toolbar-actions-wrapper">
          {improvedFlakyConnections && (
            <OfflineIndicator isOffline={isOfflineDueToNetworkStall} />
          )}
          <div className="ide-redesign-toolbar-actions">
            {showViewSwitcher && (
              <div className="ide-redesign-toolbar-button-container">
                <OLTooltip
                  id="tooltip-switch-view"
                  description={switchTooltip}
                  overlayProps={{ delay: 0, placement: 'bottom' }}
                >
                  <OLIconButton
                    icon={switchIcon}
                    className="ide-redesign-toolbar-button-subdued ide-redesign-toolbar-button-icon"
                    onClick={handleSwitchView}
                    accessibilityLabel={switchTooltip}
                  />
                </OLTooltip>
              </div>
            )}
            <ChangeLayoutButton />
            <div className="ide-redesign-toolbar-button-container">
              <OLTooltip
                id="tooltip-exit-focus-mode"
                description={t('exit_focus_mode')}
                overlayProps={{ delay: 0, placement: 'bottom' }}
              >
                <OLIconButton
                  icon="close_fullscreen"
                  className="ide-redesign-toolbar-button-subdued ide-redesign-toolbar-button-icon"
                  onClick={handleExitFocusMode}
                  accessibilityLabel={t('exit_focus_mode')}
                />
              </OLTooltip>
            </div>
          </div>
        </div>
      </nav>
    )
  }

  return (
    <nav className="ide-redesign-toolbar" aria-label={t('project_actions')}>
      <div className="ide-redesign-toolbar-menu">
        <ToolbarLogos cobranding={cobranding} />
        <ToolbarMenuBar />
        {showUpgradePrompt && <UpgradeButton />}
      </div>
      <ToolbarProjectTitle />
      <div className="ide-redesign-toolbar-actions-wrapper">
        {improvedFlakyConnections && (
          <OfflineIndicator isOffline={isOfflineDueToNetworkStall} />
        )}
        {/* Documentation Studio REA: single-user, so no online users, access
            requests or sharing here */}
        <div className="ide-redesign-toolbar-actions">
          <ChangeLayoutButton />
          {shouldDisplaySubmitButton && cobranding && (
            <SubmitProjectButton cobranding={cobranding} />
          )}
        </div>
      </div>
    </nav>
  )
}

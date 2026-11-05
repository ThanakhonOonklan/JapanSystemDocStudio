import {
  createContext,
  FC,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react'
import { useLayoutContext } from '@/shared/context/layout-context'
import PreviewTabsSetting from '@/features/ide-settings/components/editor-settings/preview-tabs-setting'
import PDFViewerSetting from '@/features/ide-settings/components/editor-settings/pdf-viewer-setting'
import importOverleafModules from '../../../../macros/import-overleaf-module.macro'
import { useTranslation } from 'react-i18next'
import OverallThemeSetting from '@/features/ide-settings/components/appearance-settings/overall-theme-setting'
import FontSizeSetting from '@/features/ide-settings/components/appearance-settings/font-size-setting'
import LineHeightSetting from '@/features/ide-settings/components/appearance-settings/line-height-setting'
import FontFamilySetting from '@/features/ide-settings/components/appearance-settings/font-family-setting'

import { useProjectSettingsContext } from '@/features/ide-settings/context/project-settings-context'
import { useFeatureFlag } from '@/shared/context/split-test-context'
import getMeta from '@/utils/meta'
import type {
  SettingsEntry,
  SettingsSection,
  SettingsSectionHook,
} from '@/features/ide-settings/context/types'
import EditorTabsSetting from '../components/editor-settings/editor-tabs-setting'
import FloatingMenuSetting from '../components/editor-settings/floating-menu-setting'
import useEventListener from '@/shared/hooks/use-event-listener'


const editorTabExtraSectionHooks: SettingsSectionHook[] = importOverleafModules(
  'settingsModalEditorTabSections'
)
  .map((m: any) => m?.import?.default)
  .filter((h: unknown): h is SettingsSectionHook => typeof h === 'function')

    .map((m: any) => m?.import?.default)
    .filter((h: unknown): h is SettingsSectionHook => typeof h === 'function')

const useSlotSections = (hooks: SettingsSectionHook[]): SettingsSection[] =>
  hooks.map(hook => hook()).filter((s): s is SettingsSection => s != null)

type SettingsModalState = {
  show: boolean
  setShow: (shown: boolean) => void
  activeTab: string | null | undefined
  setActiveTab: (tab: string | null | undefined) => void
  settingsTabs: SettingsEntry[]
  settingToTabMap: Map<string, string>
  settingToFocus?: string
}

export const SettingsModalContext = createContext<
  SettingsModalState | undefined
>(undefined)

export const SettingsModalProvider: FC<React.PropsWithChildren> = ({
  children,
}) => {
  const { t } = useTranslation()
  const { overallTheme, floatingMenu } = useProjectSettingsContext()
  const [settingToFocus, setSettingToFocus] = useState<string | undefined>(
    undefined
  )

  useEventListener(
    'ui.focus-setting',
    useCallback((event: CustomEvent<string | undefined>) => {
      setSettingToFocus(event.detail)
    }, [])
  )

  const { settingsShown, setSettingsShown } = useLayoutContext()

  const hasToolbarMigration = useFeatureFlag('writefull-toolbar-migration')

  const editorTabExtraSections = useSlotSections(editorTabExtraSectionHooks)

  const allSettingsTabs: SettingsEntry[] = useMemo(
    () => [
      {
        key: 'editor',
        title: t('editor'),
        icon: 'code',
        sections: [
          {
            key: 'general',
            settings: [
              {
                key: 'editorTabs',
                component: <EditorTabsSetting />,
              },
              {
                key: 'previewTabs',
                component: <PreviewTabsSetting />,
              },
              {
                key: 'pdfViewer',
                component: <PDFViewerSetting />,
              },
              {
                key: 'floating-menu',
                component: <FloatingMenuSetting />,
                hidden: !hasToolbarMigration && floatingMenu,
              },
            ],
          },
          ...editorTabExtraSections,
        ],
      },
      {
        key: 'appearance',
        title: t('appearance'),
        icon: 'brush',
        sections: [
          {
            key: 'general',
            settings: [
              {
                key: 'overallTheme',
                component: <OverallThemeSetting />,
              },
              {
                key: 'fontSize',
                component: <FontSizeSetting />,
              },
              {
                key: 'fontFamily',
                component: <FontFamilySetting />,
              },
              {
                key: 'lineHeight',
                component: <LineHeightSetting />,
              },
            ],
          },
        ],
      },
    ],
    [
      t,
      overallTheme,
      editorTabExtraSections,
      hasToolbarMigration,
      floatingMenu,
    ]
  )

  const settingsTabs = useMemo(
    () => allSettingsTabs.filter(tab => !tab.hidden),
    [allSettingsTabs]
  )

  const settingToTabMap = useMemo(() => {
    const map = new Map<string, string>()
    settingsTabs
      .filter(t => 'sections' in t)
      .forEach(tab => {
        tab.sections.forEach(section => {
          section.settings.forEach(setting => {
            map.set(setting.key, tab.key)
          })
        })
      })
    return map
  }, [settingsTabs])

  const [activeTab, setActiveTab] = useState<string | null | undefined>(
    settingsTabs[0]?.key
  )

  const value = useMemo(
    () => ({
      show: settingsShown,
      setShow: setSettingsShown,
      activeTab,
      setActiveTab,
      settingsTabs,
      settingToTabMap,
      settingToFocus,
    }),
    [
      settingsShown,
      setSettingsShown,
      activeTab,
      setActiveTab,
      settingsTabs,
      settingToTabMap,
      settingToFocus,
    ]
  )

  return (
    <SettingsModalContext.Provider value={value}>
      {children}
    </SettingsModalContext.Provider>
  )
}

export const useSettingsModalContext = () => {
  const value = useContext(SettingsModalContext)

  if (!value) {
    throw new Error(
      `useSettingsModalContext is only available inside SettingsModalProvider`
    )
  }

  return value
}

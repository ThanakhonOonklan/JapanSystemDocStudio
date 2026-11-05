import { ChangeEvent, FC, memo, useCallback, useId } from 'react'
import OLTooltip from '@/shared/components/ol/ol-tooltip'
import { sendMB } from '../../../infrastructure/event-tracking'
import { useTranslation } from 'react-i18next'
import { useEditorOpenDocContext } from '@/features/ide-react/context/editor-open-doc-context'
import { useEditorPropertiesContext } from '@/features/ide-react/context/editor-properties-context'
import { getFileExtension } from '../utils/file'
import { isVisualEditorAvailable } from '../utils/visual-editor'
import {
  setBilingualEnabled,
  useBilingualEnabled,
} from '@/features/bilingual/bilingual-store'

function EditorSwitch() {
  const { t } = useTranslation()
  const { showVisual: visual, setShowVisual: setVisual } =
    useEditorPropertiesContext()
  const { openDocName } = useEditorOpenDocContext()
  const inputId = useId()

  const richTextAvailable = openDocName
    ? isVisualEditorAvailable(openDocName)
    : false
  const extension = getFileExtension(openDocName || '') ?? ''

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const editorType = event.target.value

      switch (editorType) {
        case 'cm6':
          setVisual(false)
          break

        case 'rich-text':
          setVisual(true)
          break
      }

      sendMB('editor-switch-change', { editorType, extension })
    },
    [extension, setVisual]
  )

  return (
    <div
      className="editor-toggle-switch"
      aria-label={t('toolbar_code_visual_editor_switch')}
      style={{ display: 'flex', alignItems: 'center', gap: 8 }}
    >
      <BilingualToggle />
      <form>
        <fieldset className="toggle-switch">
          <legend className="visually-hidden">Editor mode.</legend>

          <input
            type="radio"
            name="editor"
            value="cm6"
            id={inputId}
            className="toggle-switch-input"
            checked={!richTextAvailable || !visual}
            onChange={handleChange}
          />
          <label htmlFor={inputId} className="toggle-switch-label">
            <span>{t('code')}</span>
          </label>

          <RichTextToggle
            checked={richTextAvailable && visual}
            disabled={!richTextAvailable}
            handleChange={handleChange}
          />
        </fieldset>
      </form>
    </div>
  )
}

// Documentation Studio REA: show the Thai and English versions side by side.
const BilingualToggle: FC = () => {
  const on = useBilingualEnabled()
  return (
    <button
      type="button"
      aria-pressed={on}
      title="Edit the Thai and English versions side by side"
      onClick={() => setBilingualEnabled(!on)}
      style={{
        font: 'inherit',
        fontSize: 12,
        padding: '2px 8px',
        borderRadius: 4,
        cursor: 'pointer',
        color: 'inherit',
        border: '1px solid currentColor',
        background: on ? 'rgba(128, 128, 128, 0.35)' : 'transparent',
        whiteSpace: 'nowrap',
      }}
    >
      TH | EN
    </button>
  )
}

const RichTextToggle: FC<{
  checked: boolean
  disabled: boolean
  handleChange: (event: ChangeEvent<HTMLInputElement>) => void
}> = ({ checked, disabled, handleChange }) => {
  const { t } = useTranslation()
  const inputId = useId()

  const toggle = (
    <span>
      <input
        type="radio"
        name="editor"
        value="rich-text"
        id={inputId}
        className="toggle-switch-input"
        checked={checked}
        onChange={handleChange}
        disabled={disabled}
      />
      <label htmlFor={inputId} className="toggle-switch-label">
        <span>{t('visual')}</span>
      </label>
    </span>
  )

  if (disabled) {
    return (
      <OLTooltip
        description={t('visual_editor_does_not_support_this_file_type')}
        id="rich-text-toggle-tooltip"
        overlayProps={{ placement: 'bottom' }}
        tooltipProps={{ className: 'tooltip-wide' }}
      >
        {toggle}
      </OLTooltip>
    )
  }

  return (
    <OLTooltip
      id="rich-text-toggle-tooltip"
      description={t('toolbar_change_editor_mode')}
      overlayProps={{ placement: 'bottom' }}
      tooltipProps={{ className: 'tooltip-wide' }}
    >
      {toggle}
    </OLTooltip>
  )
}

export default memo(EditorSwitch)

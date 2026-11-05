import { FC, memo } from 'react'
import {
  setBilingualEnabled,
  useBilingualEnabled,
} from '@/features/bilingual/bilingual-store'

// Documentation Studio REA: this used to switch between the LaTeX "Code" and
// "Visual" editors. Documents are Markdown now, so the only switch left is
// the one that shows the Thai and English versions side by side.
function EditorSwitch() {
  return (
    <div className="editor-toggle-switch">
      <BilingualToggle />
    </div>
  )
}

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

export default memo(EditorSwitch)

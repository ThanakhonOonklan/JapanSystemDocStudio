// Documentation Studio: the LaTeX visual editor has been removed. These are
// the few pieces other extensions still use: the editor is always in source
// mode, and `sourceOnly` simply applies its extension.
import {
  Compartment,
  EditorState,
  Extension,
  StateEffect,
  StateField,
  TransactionSpec,
} from '@codemirror/state'
import { EditorView } from '@codemirror/view'

export const toggleVisualEffect = StateEffect.define<boolean>()

const visualState = StateField.define<boolean>({
  create() {
    return false
  },
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(toggleVisualEffect)) {
        return effect.value
      }
    }
    return value
  },
})

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const visual = (docName: string, showVisual: boolean): Extension => [
  visualState.init(() => false),
]

export const isVisual = (view: EditorView) =>
  view.state.field(visualState, false) || false

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const setVisual = (showVisual: boolean): TransactionSpec => ({
  effects: [toggleVisualEffect.of(false)],
})

// Loads `extension` only while the editor is in a particular mode, reacting to
// mode switches via `toggleVisualEffect`.
const modeOnly = (
  activeWhenVisual: boolean,
  visual: boolean,
  extension: Extension
) => {
  const conf = new Compartment()
  const configure = (visual: boolean) =>
    visual === activeWhenVisual ? extension : []
  return [
    conf.of(configure(visual)),
    EditorState.transactionExtender.of(tr => {
      for (const effect of tr.effects) {
        if (effect.is(toggleVisualEffect)) {
          return {
            effects: conf.reconfigure(configure(effect.value)),
          }
        }
      }
      return null
    }),
  ]
}

export const visualOnly = (visual: boolean, extension: Extension) =>
  modeOnly(true, visual, extension)

export const sourceOnly = (visual: boolean, extension: Extension) =>
  modeOnly(false, visual, extension)

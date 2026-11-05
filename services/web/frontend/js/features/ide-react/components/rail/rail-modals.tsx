import { FC } from 'react'
import {
  RailModalKey,
  useRailContext,
} from '@/features/ide-react/context/rail-context'
import importOverleafModules from '../../../../../macros/import-overleaf-module.macro'

type RailModalEntry = {
  key: RailModalKey
  modalComponentFunction: FC<{ show: boolean }>
}

const moduleRailModals = (
  importOverleafModules('railModals') as {
    import: { default: RailModalEntry }
    path: string
  }[]
).map(({ import: { default: entry } }) => entry)

const RAIL_MODALS: RailModalEntry[] = [
  ...moduleRailModals,
]

export default function RailModals() {
  const { activeModal } = useRailContext()

  return RAIL_MODALS.map(({ key, modalComponentFunction: Component }) => (
    <Component key={key} show={activeModal === key} />
  ))
}

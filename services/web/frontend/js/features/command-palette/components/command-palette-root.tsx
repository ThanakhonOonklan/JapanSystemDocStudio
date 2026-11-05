import { useCallback, useState } from 'react'
import useCommandPaletteTriggers from '../hooks/use-command-palette-triggers'
import CommandPaletteBody from './command-palette-body'
import { useCommandProvider } from '@/features/ide-react/hooks/use-command-provider'
import { useTranslation } from 'react-i18next'

const CommandPaletteRoot = () => {
  const [show, setShow] = useState(false)
  const { t } = useTranslation()

  useCommandPaletteTriggers(setShow)
  const onHide = useCallback(() => setShow(false), [setShow])

  useCommandProvider(
    () => [
      {
        id: 'command-palette',
        label: t('command_palette'),
        handler: () => setShow(true),
      },
    ],
    [t, setShow]
  )

  if (!show) {
    return null
  }

  return <CommandPaletteBody show={show} onHide={onHide} />
}

export default CommandPaletteRoot

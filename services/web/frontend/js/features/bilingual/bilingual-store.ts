// Whether the Thai/English side-by-side view is on, remembered in the
// browser. A tiny external store so that the toolbar button and the editor
// layout can share it without a new React context.

import { useSyncExternalStore } from 'react'

const ENABLED_KEY = 'docstudio.bilingual.enabled'
const SYNC_KEY = 'docstudio.bilingual.syncScroll'

type Flag = { key: string; value: boolean; listeners: Set<() => void> }

function createFlag(key: string, defaultValue: boolean): Flag {
  let value = defaultValue
  try {
    const stored = window.localStorage.getItem(key)
    if (stored !== null) value = stored === 'true'
  } catch {
    // storage can be unavailable (private window, blocked site data)
  }
  return { key, value, listeners: new Set() }
}

const enabledFlag = createFlag(ENABLED_KEY, false)
const syncFlag = createFlag(SYNC_KEY, true)

function setFlag(flag: Flag, value: boolean) {
  if (flag.value === value) return
  flag.value = value
  try {
    window.localStorage.setItem(flag.key, String(value))
  } catch {
    // ignore
  }
  flag.listeners.forEach(listener => listener())
}

function useFlag(flag: Flag): boolean {
  return useSyncExternalStore(
    listener => {
      flag.listeners.add(listener)
      return () => flag.listeners.delete(listener)
    },
    () => flag.value
  )
}

export const useBilingualEnabled = () => useFlag(enabledFlag)
export const setBilingualEnabled = (value: boolean) =>
  setFlag(enabledFlag, value)

export const useBilingualSyncScroll = () => useFlag(syncFlag)
export const setBilingualSyncScroll = (value: boolean) =>
  setFlag(syncFlag, value)

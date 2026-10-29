import { createContext, useContext, type Dispatch } from 'react'
import type { AppData } from './data'
import type { StoreAction } from './reducer'

export interface StoreValue {
  data: AppData
  dispatch: Dispatch<StoreAction>
  /** True when the last save failed (storage blocked or full). */
  saveFailed: boolean
}

export const StoreContext = createContext<StoreValue | null>(null)

export function useStore(): StoreValue {
  const value = useContext(StoreContext)
  if (!value) throw new Error('useStore must be used inside StoreProvider')
  return value
}

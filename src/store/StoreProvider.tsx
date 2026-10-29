import { useCallback, useRef, useState, type ReactNode } from 'react'
import { loadData, saveData, type AppData } from './data'
import { storeReducer, type StoreAction } from './reducer'
import { StoreContext } from './context'

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(() => loadData())
  const [saveFailed, setSaveFailed] = useState(false)
  const latest = useRef(data)

  // Saves as part of each change, so every update is persisted exactly once.
  const dispatch = useCallback((action: StoreAction) => {
    const next = storeReducer(latest.current, action)
    latest.current = next
    setData(next)
    setSaveFailed(!saveData(next))
  }, [])

  return <StoreContext.Provider value={{ data, dispatch, saveFailed }}>{children}</StoreContext.Provider>
}

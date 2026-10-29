import { createContext, useContext } from 'react'
import type { GameSetup, GameState, ManagerAction, RecordedAction } from '../../sim/game'

export type AdvanceMode = 'pa' | 'half' | 'end'

export interface LiveGameValue {
  game: GameState | null
  /** User moves made so far, for replay. */
  actions: RecordedAction[]
  /** Id in 記録 once the finished game has been saved. */
  savedId: string | null
  /** Changes whenever the mutable game state changes, so consumers re-render. */
  version: number
  start: (setup: GameSetup) => void
  advance: (mode: AdvanceMode) => void
  act: (action: ManagerAction) => void
  discard: () => void
}

export const LiveGameContext = createContext<LiveGameValue | null>(null)

export function useLiveGame(): LiveGameValue {
  const value = useContext(LiveGameContext)
  if (!value) throw new Error('useLiveGame must be used inside LiveGameProvider')
  return value
}

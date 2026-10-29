import { useState, type ReactNode } from 'react'
import {
  advance as advanceGame,
  applyManagerAction,
  createGame,
  type GameSetup,
  type GameState,
  type ManagerAction,
  type RecordedAction,
} from '../../sim/game'
import { useStore } from '../../store/context'
import { newId, type SavedGame } from '../../store/data'
import { LiveGameContext, type AdvanceMode } from './liveGameContext'

interface Session {
  /** Mutated in place by the engine; `version` tracks its changes. */
  game: GameState
  actions: RecordedAction[]
  /** Id in 記録 once the finished game has been saved. */
  savedId: string | null
}

// A function, so TypeScript does not narrow `status` across engine calls that mutate it.
const isFinal = (g: GameState) => g.status === 'final'
const halfEnds = (g: GameState) => g.events.filter((e) => e.type === 'halfEnd').length

/** Holds the game in progress, so it survives moving between pages. */
export function LiveGameProvider({ children }: { children: ReactNode }) {
  const { dispatch } = useStore()
  const [session, setSession] = useState<Session | null>(null)
  const [version, setVersion] = useState(0)
  const bump = () => setVersion((v) => v + 1)

  const start = (setup: GameSetup) => {
    setSession({ game: createGame(setup), actions: [], savedId: null })
    bump()
  }

  const advance = (mode: AdvanceMode) => {
    const g = session?.game
    if (!g || isFinal(g)) return
    const halves = halfEnds(g)
    do {
      advanceGame(g)
    } while (!isFinal(g) && (mode === 'end' || (mode === 'half' && halfEnds(g) === halves)))
    if (isFinal(g) && session) {
      const saved: SavedGame = {
        id: newId(),
        playedAt: new Date().toISOString(),
        setup: g.setup,
        actions: session.actions,
        summary: { score: { ...g.score }, result: g.result!, innings: g.inning },
      }
      dispatch({ type: 'addSavedGame', game: saved })
      setSession({ ...session, savedId: saved.id })
    }
    bump()
  }

  const act = (action: ManagerAction) => {
    if (!session) return
    const at = session.game.events.length
    applyManagerAction(session.game, action)
    setSession({ ...session, actions: [...session.actions, { at, action }] })
    bump()
  }

  const discard = () => {
    setSession(null)
    bump()
  }

  const value = {
    game: session?.game ?? null,
    actions: session?.actions ?? [],
    savedId: session?.savedId ?? null,
    version,
    start,
    advance,
    act,
    discard,
  }
  return <LiveGameContext.Provider value={value}>{children}</LiveGameContext.Provider>
}

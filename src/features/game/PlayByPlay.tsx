import { describeEvent, displayName } from '../../sim/describe'
import type { GameEvent, GameState } from '../../sim/game'
import { HALF } from './labels'

function eventClass(e: GameEvent): string {
  if (e.type === 'pa') return e.runs.length > 0 ? 'pbp scored' : 'pbp'
  if (e.type === 'sub') return 'pbp sub'
  return 'pbp marker'
}

/** 実況: newest first, with the inning on each plate appearance. */
export function PlayByPlay({ game }: { game: GameState; version?: number }) {
  const items = game.events.map((e, i) => ({ e, i })).reverse()
  return (
    <div className="card">
      <h2>実況</h2>
      {items.length === 0 && <p className="muted">プレイボール!{displayName(game.away.players[game.away.order[0].playerId])}が打席に向かいます。</p>}
      <ol className="pbp-list" aria-live="polite">
        {items.map(({ e, i }) => (
          <li key={i} className={eventClass(e)}>
            {e.type === 'pa' && (
              <span className="pbp-inning">
                {e.inning}回{HALF[e.half]}
              </span>
            )}
            {describeEvent(game, e, i)}
          </li>
        ))}
      </ol>
    </div>
  )
}

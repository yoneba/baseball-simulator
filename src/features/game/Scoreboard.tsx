import type { BoxScore } from '../../sim/boxscore'
import type { GameState } from '../../sim/game'

interface ScoreboardProps {
  game: GameState
  box: BoxScore
}

/** スコアボード: line score by inning plus 計 (R), 安 (H) and 失 (E). */
export function Scoreboard({ game, box }: ScoreboardProps) {
  const innings = Math.max(game.setup.rules.regulationInnings, game.inning)
  const live = game.status === 'inProgress'
  const last = game.events.at(-1)
  const walkoff = last?.type === 'gameEnd' && last.walkoff
  const cell = (side: 'away' | 'home', i: number) => {
    const runs = box.lineScore[side][i]
    // サヨナラ is written as e.g. 「2x」.
    if (walkoff && side === 'home' && i === game.inning - 1) return `${runs}x`
    if (runs !== undefined) return runs
    // The home team did not need its last turn at bat.
    if (side === 'home' && !live && i === game.inning - 1) return 'X'
    return ''
  }

  return (
    <div className="scoreboard table-wrap">
      <table>
        <thead>
          <tr>
            <th scope="col">
              <span className="sr-only">チーム</span>
            </th>
            {Array.from({ length: innings }, (_, i) => (
              <th key={i} scope="col" className="num">
                {i + 1}
              </th>
            ))}
            <th scope="col" className="num total">
              計
            </th>
            <th scope="col" className="num">
              安
            </th>
            <th scope="col" className="num">
              失
            </th>
          </tr>
        </thead>
        <tbody>
          {(['away', 'home'] as const).map((side) => (
            <tr key={side}>
              <th scope="row">
                <span className="team-dot" style={{ background: game.setup[side].color }} aria-hidden="true" />
                {game.setup[side].shortName}
              </th>
              {Array.from({ length: innings }, (_, i) => {
                const current = live && i === game.inning - 1 && (side === 'away') === (game.half === 'top')
                return (
                  <td key={i} className={`num${current ? ' current' : ''}`}>
                    {cell(side, i)}
                  </td>
                )
              })}
              <td className="num total">{box.totals[side].r}</td>
              <td className="num">{box.totals[side].h}</td>
              <td className="num">{box.totals[side].e}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

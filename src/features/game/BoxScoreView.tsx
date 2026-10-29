import { POSITION_SHORT } from '../../domain/positions'
import { buildBoxScore, formatInnings, type BattingLine, type EntryRole } from '../../sim/boxscore'
import { displayName } from '../../sim/describe'
import type { GameState, PAEvent, Side } from '../../sim/game'
import { Scoreboard } from './Scoreboard'

function roleLabel(role: EntryRole): string {
  if (role === '代打' || role === '代走') return role.slice(1)
  if (role === '投') return '投'
  return POSITION_SHORT[role]
}

const HOMER_KIND = ['ソロ', '2ラン', '3ラン', '満塁']

/** 本塁打 notes, e.g. 「田中 3回2ラン」. */
function homeRuns(game: GameState, side: Side): string[] {
  const half = side === 'away' ? 'top' : 'bottom'
  return game.events
    .filter((e): e is PAEvent => e.type === 'pa' && e.outcome === 'HR' && e.half === half)
    .map((e) => {
      const runners = e.basesBefore.filter(Boolean).length
      return `${displayName(game[side].players[e.batterId])} ${e.inning}回${HOMER_KIND[runners]}`
    })
}

export function BoxScoreView({ game }: { game: GameState }) {
  const box = buildBoxScore(game)
  return (
    <div className="stack">
      <Scoreboard game={game} box={box} />
      {(['away', 'home'] as const).map((side) => {
        const team = game[side]
        const name = (id: string) => team.players[id]?.name ?? '?'
        const hrs = homeRuns(game, side)
        return (
          <div key={side} className="card stack box-team">
            <h2>
              <span className="team-dot" style={{ background: game.setup[side].color }} aria-hidden="true" />
              {game.setup[side].name}
            </h2>
            <div className="table-wrap">
              <table>
                <caption className="sr-only">{game.setup[side].name}の打撃成績</caption>
                <thead>
                  <tr>
                    <th>打順</th>
                    <th>守備</th>
                    <th>選手</th>
                    <th className="num">打数</th>
                    <th className="num">得点</th>
                    <th className="num">安打</th>
                    <th className="num">打点</th>
                    <th className="num">本塁打</th>
                    <th className="num">三振</th>
                    <th className="num">四死球</th>
                  </tr>
                </thead>
                <tbody>
                  {box.batting[side].map((l: BattingLine, i) => {
                    const firstInSlot = box.batting[side].findIndex((x) => x.slot === l.slot) === i
                    return (
                      <tr key={l.playerId} className={firstInSlot ? '' : 'sub-row'}>
                        <td className="num">{firstInSlot ? l.slot + 1 : ''}</td>
                        <td>{roleLabel(l.role)}</td>
                        <td>{name(l.playerId)}</td>
                        <td className="num">{l.ab}</td>
                        <td className="num">{l.r}</td>
                        <td className="num">{l.h}</td>
                        <td className="num">{l.rbi}</td>
                        <td className="num">{l.hr}</td>
                        <td className="num">{l.so}</td>
                        <td className="num">{l.bb}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {hrs.length > 0 && <p className="small">【本塁打】{hrs.join('、')}</p>}
            <div className="table-wrap">
              <table>
                <caption className="sr-only">{game.setup[side].name}の投手成績</caption>
                <thead>
                  <tr>
                    <th>投手</th>
                    <th></th>
                    <th className="num">投球回</th>
                    <th className="num">打者</th>
                    <th className="num">球数</th>
                    <th className="num">安打</th>
                    <th className="num">本塁打</th>
                    <th className="num">三振</th>
                    <th className="num">四死球</th>
                    <th className="num">失点</th>
                    <th className="num">自責点</th>
                  </tr>
                </thead>
                <tbody>
                  {box.pitching[side].map((p) => (
                    <tr key={p.playerId}>
                      <td>{name(p.playerId)}</td>
                      <td>{p.decision && <span className={`decision decision-${p.decision}`}>{p.decision}</span>}</td>
                      <td className="num">{formatInnings(p.outs)}</td>
                      <td className="num">{p.bf}</td>
                      <td className="num">{p.pitches}</td>
                      <td className="num">{p.h}</td>
                      <td className="num">{p.hr}</td>
                      <td className="num">{p.so}</td>
                      <td className="num">{p.bb}</td>
                      <td className="num">{p.r}</td>
                      <td className="num">{p.er}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}
    </div>
  )
}

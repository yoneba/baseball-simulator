import { useState } from 'react'
import { batValue } from '../../domain/autoLineup'
import { POSITION_SHORT } from '../../domain/positions'
import type { Player } from '../../domain/types'
import { pitchLimit } from '../../sim/model'
import {
  availableBench,
  availableRelievers,
  battingSide,
  fieldingSide,
  type GameState,
  type ManagerAction,
  type Side,
} from '../../sim/game'
import { useLiveGame } from './liveGameContext'

const BASE_LABEL = { 1: '一塁', 2: '二塁', 3: '三塁' } as const

function PlayerPicker({
  label,
  players,
  describe,
  action,
  onPick,
}: {
  label: string
  players: Player[]
  describe: (p: Player) => string
  action: string
  onPick: (id: string) => void
}) {
  const [selected, setSelected] = useState('')
  const value = players.some((p) => p.id === selected) ? selected : (players[0]?.id ?? '')
  if (players.length === 0) return <p className="muted small">{label}: 出場できる選手がいません。</p>
  return (
    <div className="row">
      <select value={value} onChange={(e) => setSelected(e.target.value)} aria-label={label}>
        {players.map((p) => (
          <option key={p.id} value={p.id}>
            {p.number} {p.name}({describe(p)})
          </option>
        ))}
      </select>
      <button onClick={() => onPick(value)}>{action}</button>
    </div>
  )
}

function SidePanel({ game, side, act }: { game: GameState; side: Side; act: (a: ManagerAction) => void }) {
  const team = game[side]
  const name = game.setup[side].shortName

  if (side === fieldingSide(game)) {
    const pitcher = team.players[team.pitcherId]
    const pitches = team.pitcherLines[team.pitcherId].pitches
    const limit = pitchLimit(pitcher)
    const order = team.team.lineup.bullpen
    const relievers = availableRelievers(team).sort((a, b) => {
      const ia = order.indexOf(a.id)
      const ib = order.indexOf(b.id)
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)
    })
    return (
      <div className="manager-side">
        <h3>{name}(守備)</h3>
        <p className="small">
          投手 {pitcher.name} {pitches}球
          {pitches >= limit ? (
            <span className="badge warn">疲れが見えます</span>
          ) : (
            <span className="muted">(目安 {limit}球)</span>
          )}
        </p>
        <PlayerPicker
          label="継投"
          players={relievers}
          describe={(p) => `球威${p.pitching!.stuff} 制球${p.pitching!.control}${p.id === order.at(-1) ? ' 抑え' : ''}`}
          action="継投"
          onPick={(id) => act({ type: 'changePitcher', side, pitcherId: id })}
        />
      </div>
    )
  }

  const bench = availableBench(team).sort((a, b) => batValue(b) - batValue(a))
  const slot = team.order[team.batterIndex]
  const batter = team.players[slot.playerId]
  const runners = ([1, 2, 3] as const).filter((b) => game.bases[b - 1])
  const describeBatter = (p: Player) =>
    `ミート${p.batting.contact} パワー${p.batting.power} ${p.positions.map((pos) => POSITION_SHORT[pos]).join('')}`
  return (
    <div className="manager-side">
      <h3>{name}(攻撃)</h3>
      <p className="small">
        代打: {batter.name}に代えて
      </p>
      <PlayerPicker
        label="代打"
        players={bench}
        describe={describeBatter}
        action="代打を送る"
        onPick={(id) => act({ type: 'pinchHit', side, playerId: id })}
      />
      {runners.map((base) => (
        <div key={base}>
          <p className="small">
            代走: {BASE_LABEL[base]}走者 {team.players[game.bases[base - 1]!.playerId].name}に代えて
          </p>
          <PlayerPicker
            label={`${BASE_LABEL[base]}の代走`}
            players={bench}
            describe={(p) => `走力${p.batting.speed}`}
            action="代走を送る"
            onPick={(id) => act({ type: 'pinchRun', side, base, playerId: id })}
          />
        </div>
      ))}
    </div>
  )
}

/** 采配パネル: substitutions for the sides the user manages. */
export function ManagerPanel() {
  const { game, act } = useLiveGame()
  const [error, setError] = useState<string | null>(null)
  if (!game || game.status === 'final') return null
  const sides = (['away', 'home'] as const).filter((s) => game[s].controller === 'user')
  if (sides.length === 0) return null

  const run = (action: ManagerAction) => {
    try {
      act(action)
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    }
  }
  // Show the batting side first: its moves are about the next plate appearance.
  const bat = battingSide(game)
  const ordered = [...sides].sort((a, b) => Number(b === bat) - Number(a === bat))

  return (
    <div className="card stack manager-panel">
      <h2>采配</h2>
      {error && (
        <p className="error-list" role="alert">
          {error}
        </p>
      )}
      <div className="manager-sides">
        {ordered.map((side) => (
          <SidePanel key={side} game={game} side={side} act={run} />
        ))}
      </div>
      <p className="muted small">投手に代打・代走を送ると、次の守備から救援投手が自動で登板します。</p>
    </div>
  )
}

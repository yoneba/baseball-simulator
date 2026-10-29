import { autoLineup } from '../../domain/autoLineup'
import { LINEUP_POSITIONS, POSITION_NAME, POSITION_SHORT } from '../../domain/positions'
import { LEAGUE_NAME } from '../../domain/rules'
import type { Lineup, Player, Position } from '../../domain/types'
import { validateLineup, validateRoster } from '../../domain/validate'
import { useStore } from '../../store/context'
import { Grade } from '../teams/Grade'
import { TeamHeader, TeamNotFound } from '../teams/TeamHeader'
import { useTeam } from '../teams/useTeam'
import '../teams/teams.css'
import './lineup.css'

function moveItem<T>(items: T[], index: number, delta: number): T[] {
  const target = index + delta
  if (target < 0 || target >= items.length) return items
  const next = [...items]
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}

const pitchValue = (p: Player) => p.pitching!.stuff + p.pitching!.control

export function LineupEditorPage() {
  const [team, save] = useTeam()
  const { data } = useStore()
  if (!team) return <TeamNotFound />

  const rules = data.leagueRules[team.league]
  const { lineup } = team
  const byId = new Map(team.roster.map((p) => [p.id, p]))
  const setLineup = (patch: Partial<Lineup>) => save({ ...team, lineup: { ...lineup, ...patch } })
  const errors = [...validateRoster(team, rules), ...validateLineup(team, rules)]

  const benchOut = new Set(lineup.benchOut)
  const inOrder = new Set(lineup.order.map((s) => s.playerId))
  const pitchers = team.roster.filter((p) => p.pitching)
  const batters = team.roster.filter((p) => !benchOut.has(p.id))
  const benchCount = team.roster.length - lineup.benchOut.length
  const relieverOptions = pitchers.filter(
    (p) => p.id !== lineup.startingPitcherId && !lineup.bullpen.includes(p.id) && !benchOut.has(p.id),
  )

  const setSlot = (index: number, patch: { playerId?: string; position?: Position }) =>
    setLineup({ order: lineup.order.map((s, i) => (i === index ? { ...s, ...patch } : s)) })

  const setStarter = (id: string) =>
    setLineup({ startingPitcherId: id, bullpen: lineup.bullpen.filter((b) => b !== id) })

  const toggleBench = (id: string, inBench: boolean) =>
    setLineup({
      benchOut: inBench ? lineup.benchOut.filter((b) => b !== id) : [...lineup.benchOut, id],
      bullpen: inBench ? lineup.bullpen : lineup.bullpen.filter((b) => b !== id),
    })

  return (
    <section className="stack">
      <TeamHeader team={team} current="lineup" />

      <div className="row">
        <button className="primary" onClick={() => setLineup(autoLineup(team, rules.benchLimit))}>
          おまかせで組む
        </button>
        <span className="muted small">能力から打順・守備・先発・ブルペン・ベンチ入りを自動で決めます。</span>
      </div>

      {errors.length > 0 ? (
        <ul className="error-list">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      ) : (
        <p className="notice">このオーダーで試合ができます。</p>
      )}

      <div className="card">
        <h2>打順</h2>
        {!rules.dh && (
          <p className="muted small">
            {LEAGUE_NAME[team.league]}は現在DHなしのため、本拠地の試合では指名打者の打順に先発投手が入ります。
            交流戦のビジターではDHが使われます。
          </p>
        )}
        <div className="table-wrap">
          <table className="order-table">
            <thead>
              <tr>
                <th>打順</th>
                <th>守備</th>
                <th>選手</th>
                <th>ミート</th>
                <th>パワー</th>
                <th>走力</th>
                <th>
                  <span className="sr-only">並べ替え</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {lineup.order.map((slot, i) => {
                const player = byId.get(slot.playerId)
                return (
                  <tr key={i}>
                    <td className="num">{i + 1}</td>
                    <td>
                      <select
                        value={slot.position}
                        aria-label={`${i + 1}番の守備位置`}
                        onChange={(e) => setSlot(i, { position: e.target.value as Position })}
                      >
                        {LINEUP_POSITIONS.map((pos) => (
                          <option key={pos} value={pos}>
                            {POSITION_SHORT[pos]} {POSITION_NAME[pos]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        value={slot.playerId}
                        aria-label={`${i + 1}番打者`}
                        onChange={(e) => setSlot(i, { playerId: e.target.value })}
                      >
                        <option value="">― 選択 ―</option>
                        {batters
                          .filter((p) => p.id === slot.playerId || (!inOrder.has(p.id) && p.id !== lineup.startingPitcherId))
                          .map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.number} {p.name}({p.positions.map((pos) => POSITION_SHORT[pos]).join('')})
                            </option>
                          ))}
                      </select>
                    </td>
                    <td>{player && <Grade value={player.batting.contact} />}</td>
                    <td>{player && <Grade value={player.batting.power} />}</td>
                    <td>{player && <Grade value={player.batting.speed} />}</td>
                    <td className="move-buttons">
                      <button aria-label="上へ" disabled={i === 0} onClick={() => setLineup({ order: moveItem(lineup.order, i, -1) })}>
                        ↑
                      </button>
                      <button
                        aria-label="下へ"
                        disabled={i === lineup.order.length - 1}
                        onClick={() => setLineup({ order: moveItem(lineup.order, i, 1) })}
                      >
                        ↓
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card stack">
        <h2>投手陣</h2>
        <label className="row starter-select">
          先発投手
          <select value={lineup.startingPitcherId} onChange={(e) => setStarter(e.target.value)}>
            <option value="">― 選択 ―</option>
            {[...pitchers]
              .filter((p) => !benchOut.has(p.id) && !inOrder.has(p.id))
              .sort((a, b) => b.pitching!.stamina - a.pitching!.stamina)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.number} {p.name}(スタミナ{p.pitching!.stamina})
                </option>
              ))}
          </select>
        </label>

        <div>
          <h3>ブルペン(登板順)</h3>
          <p className="muted small">CPU采配では上から順に登板し、最後の投手が抑えになります。</p>
          <ol className="bullpen">
            {lineup.bullpen.map((id, i) => {
              const p = byId.get(id)
              if (!p) return null
              return (
                <li key={id} className="row">
                  <span className="bullpen-name">
                    {p.number} {p.name}
                    {i === lineup.bullpen.length - 1 && <span className="badge ok">抑え</span>}
                  </span>
                  <span className="muted small">球威</span>
                  <Grade value={p.pitching!.stuff} />
                  <span className="muted small">制球</span>
                  <Grade value={p.pitching!.control} />
                  <span className="move-buttons">
                    <button aria-label="上へ" disabled={i === 0} onClick={() => setLineup({ bullpen: moveItem(lineup.bullpen, i, -1) })}>
                      ↑
                    </button>
                    <button
                      aria-label="下へ"
                      disabled={i === lineup.bullpen.length - 1}
                      onClick={() => setLineup({ bullpen: moveItem(lineup.bullpen, i, 1) })}
                    >
                      ↓
                    </button>
                    <button className="link danger" onClick={() => setLineup({ bullpen: lineup.bullpen.filter((b) => b !== id) })}>
                      外す
                    </button>
                  </span>
                </li>
              )
            })}
          </ol>
          {relieverOptions.length > 0 && (
            <select
              value=""
              aria-label="ブルペンに追加"
              onChange={(e) => e.target.value && setLineup({ bullpen: [...lineup.bullpen, e.target.value] })}
            >
              <option value="">+ ブルペンに追加</option>
              {[...relieverOptions]
                .sort((a, b) => pitchValue(b) - pitchValue(a))
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.number} {p.name}(球威{p.pitching!.stuff} 制球{p.pitching!.control})
                  </option>
                ))}
            </select>
          )}
        </div>
      </div>

      <div className="card">
        <h2>
          ベンチ入り {benchCount}/{rules.benchLimit}人
        </h2>
        <p className="muted small">一軍登録選手のうち、試合に出られるのは{rules.benchLimit}人までです。チェックを外すとベンチ外になります。</p>
        <div className="bench-grid">
          {team.roster.map((p) => (
            <label key={p.id} className="chip">
              <input type="checkbox" checked={!benchOut.has(p.id)} onChange={(e) => toggleBench(p.id, e.target.checked)} />
              {p.number} {p.name}
              {p.pitching && <span className="muted small">投</span>}
            </label>
          ))}
        </div>
      </div>
    </section>
  )
}

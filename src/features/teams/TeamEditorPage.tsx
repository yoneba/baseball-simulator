import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { downloadText } from '../../app/files'
import { HAND_LABEL } from '../../app/labels'
import { ROLE_LABEL, type PlayerRole } from '../../data/generate'
import { POSITION_SHORT } from '../../domain/positions'
import { compareNumbers, removePlayer, upsertPlayer } from '../../domain/roster'
import { LEAGUE_NAME } from '../../domain/rules'
import type { League, Player } from '../../domain/types'
import { validateRoster } from '../../domain/validate'
import { useStore } from '../../store/context'
import { exportTeams } from '../../store/transfer'
import { Grade } from './Grade'
import { TeamHeader, TeamNotFound } from './TeamHeader'
import { useTeam } from './useTeam'
import { createRandomPlayer } from './teamActions'
import './teams.css'

const ROLES = Object.keys(ROLE_LABEL) as PlayerRole[]

export function TeamEditorPage() {
  const [team, save] = useTeam()
  const { data, dispatch } = useStore()
  const navigate = useNavigate()
  const [role, setRole] = useState<PlayerRole>('RP')
  if (!team) return <TeamNotFound />

  const errors = validateRoster(team, data.leagueRules[team.league])
  const pitchers = team.roster.filter((p) => p.pitching).sort((a, b) => compareNumbers(a.number, b.number))
  const fielders = team.roster.filter((p) => !p.pitching).sort((a, b) => compareNumbers(a.number, b.number))

  const remove = (player: Player) => {
    if (confirm(`${player.name}をチームから外しますか?`)) save(removePlayer(team, player.id))
  }

  const deleteTeam = () => {
    if (confirm(`${team.name}を削除しますか? この操作は取り消せません。`)) {
      dispatch({ type: 'deleteTeam', teamId: team.id })
      navigate(`/teams?league=${team.league}`)
    }
  }

  return (
    <section className="stack">
      <TeamHeader team={team} current="roster" />

      <div className="card form-grid">
        <label>
          チーム名
          <input value={team.name} maxLength={20} onChange={(e) => save({ ...team, name: e.target.value })} />
        </label>
        <label>
          略称
          <input
            value={team.shortName}
            maxLength={4}
            onChange={(e) => save({ ...team, shortName: e.target.value })}
          />
        </label>
        <label>
          所属リーグ
          <select value={team.league} onChange={(e) => save({ ...team, league: e.target.value as League })}>
            <option value="central">{LEAGUE_NAME.central}</option>
            <option value="pacific">{LEAGUE_NAME.pacific}</option>
          </select>
        </label>
        <label>
          チームカラー
          <input type="color" value={team.color} onChange={(e) => save({ ...team, color: e.target.value })} />
        </label>
      </div>

      {errors.length > 0 && (
        <ul className="error-list">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

      <div className="row">
        <Link to={`/teams/${team.id}/players/new`} className="button primary">
          選手を追加
        </Link>
        <span className="row">
          <select value={role} onChange={(e) => setRole(e.target.value as PlayerRole)} aria-label="生成する選手の役割">
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
          <button onClick={() => save(upsertPlayer(team, createRandomPlayer(team, role)))}>ランダムに追加</button>
        </span>
      </div>

      <PlayerTable
        title={`投手(${pitchers.length}人)`}
        players={pitchers}
        teamId={team.id}
        columns={[
          ['球威', (p) => p.pitching!.stuff],
          ['制球', (p) => p.pitching!.control],
          ['スタミナ', (p) => p.pitching!.stamina],
        ]}
        onRemove={remove}
      />
      <PlayerTable
        title={`野手(${fielders.length}人)`}
        players={fielders}
        teamId={team.id}
        columns={[
          ['ミート', (p) => p.batting.contact],
          ['パワー', (p) => p.batting.power],
          ['選球眼', (p) => p.batting.eye],
          ['走力', (p) => p.batting.speed],
          ['守備', (p) => p.fielding.range],
        ]}
        onRemove={remove}
      />

      <div className="row">
        <button onClick={() => downloadText(`${team.name}.json`, exportTeams([team]))}>このチームを書き出し</button>
        <button className="danger" onClick={deleteTeam}>
          チームを削除
        </button>
      </div>
    </section>
  )
}

interface PlayerTableProps {
  title: string
  players: Player[]
  teamId: string
  columns: [string, (p: Player) => number][]
  onRemove: (p: Player) => void
}

function PlayerTable({ title, players, teamId, columns, onRemove }: PlayerTableProps) {
  return (
    <div className="card">
      <h2>{title}</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th className="num">背番号</th>
              <th>名前</th>
              <th>投打</th>
              <th>守備</th>
              {columns.map(([label]) => (
                <th key={label}>{label}</th>
              ))}
              <th>
                <span className="sr-only">操作</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {players.map((p) => (
              <tr key={p.id}>
                <td className="num">{p.number}</td>
                <td>
                  <Link to={`/teams/${teamId}/players/${p.id}`}>{p.name}</Link>
                  {p.foreign && <span className="badge foreign">外</span>}
                </td>
                <td>
                  {HAND_LABEL[p.throws]}投{HAND_LABEL[p.bats]}打
                </td>
                <td>{p.positions.map((pos) => POSITION_SHORT[pos]).join('')}</td>
                {columns.map(([label, get]) => (
                  <td key={label}>
                    <Grade value={get(p)} />
                  </td>
                ))}
                <td>
                  <button className="link danger" onClick={() => onRemove(p)}>
                    外す
                  </button>
                </td>
              </tr>
            ))}
            {players.length === 0 && (
              <tr>
                <td colSpan={5 + columns.length} className="muted">
                  まだ選手がいません。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

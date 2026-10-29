import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { BATTING_LABEL, FIELDING_LABEL, HAND_LABEL, PITCHING_LABEL } from '../../app/labels'
import { ROLE_LABEL, type PlayerRole } from '../../data/generate'
import { FIELD_POSITIONS, POSITION_NAME } from '../../domain/positions'
import { upsertPlayer } from '../../domain/roster'
import type { FieldPosition, Hand, Player, Team } from '../../domain/types'
import { newId } from '../../store/data'
import { Grade } from './Grade'
import { TeamNotFound } from './TeamHeader'
import { createRandomPlayer } from './teamActions'
import { useTeam } from './useTeam'
import './teams.css'

const ROLES = Object.keys(ROLE_LABEL) as PlayerRole[]
const DEFAULT_PITCHING = { stuff: 50, control: 50, stamina: 50 }

function roleOf(player: Player): PlayerRole {
  if (player.pitching) return player.pitching.stamina >= 50 ? 'SP' : 'RP'
  const main = player.positions[0]
  if (main === 'LF' || main === 'CF' || main === 'RF' || !main) return 'OF'
  return main as PlayerRole
}

function validatePlayer(player: Player, team: Team): string[] {
  const errors: string[] = []
  if (!player.name.trim()) errors.push('名前を入力してください。')
  if (!Number.isInteger(player.number) || player.number < 0 || player.number > 999) {
    errors.push('背番号は0〜999で入力してください。')
  } else if (team.roster.some((p) => p.id !== player.id && p.number === player.number)) {
    errors.push(`背番号${player.number}は他の選手が使っています。`)
  }
  if (player.positions.length === 0) errors.push('守備位置を1つ以上選んでください。')
  return errors
}

export function PlayerEditorPage() {
  const [team, save] = useTeam()
  if (!team) return <TeamNotFound />
  return <PlayerEditor key={team.id} team={team} save={save} />
}

function PlayerEditor({ team, save }: { team: Team; save: (team: Team) => void }) {
  const { playerId } = useParams()
  const navigate = useNavigate()
  const existing = team.roster.find((p) => p.id === playerId)
  const [draft, setDraft] = useState<Player>(() => existing ?? createRandomPlayer(team, 'OF', newId()))
  const [role, setRole] = useState<PlayerRole>(() => roleOf(draft))
  const [showErrors, setShowErrors] = useState(false)

  if (playerId !== 'new' && !existing) {
    return (
      <section className="stack">
        <h1>選手が見つかりません</h1>
        <Link to={`/teams/${team.id}`}>チームに戻る</Link>
      </section>
    )
  }

  const errors = validatePlayer(draft, team)
  const back = () => navigate(`/teams/${team.id}`)
  const update = (patch: Partial<Player>) => setDraft((d) => ({ ...d, ...patch }))

  const togglePosition = (pos: FieldPosition, on: boolean) => {
    const positions = on ? [...draft.positions, pos] : draft.positions.filter((p) => p !== pos)
    const ordered = FIELD_POSITIONS.filter((p) => positions.includes(p))
    // Pitching ratings exist exactly when the player can pitch.
    update({
      positions: ordered,
      pitching: ordered.includes('P') ? (draft.pitching ?? DEFAULT_PITCHING) : undefined,
    })
  }

  const reroll = () => {
    const fresh = createRandomPlayer({ ...team, roster: team.roster.filter((p) => p.id !== draft.id) }, role, draft.id)
    setDraft({ ...fresh, number: draft.number, foreign: draft.foreign })
  }

  const submit = () => {
    if (errors.length > 0) {
      setShowErrors(true)
      return
    }
    save(upsertPlayer(team, { ...draft, name: draft.name.trim() }))
    back()
  }

  return (
    <section className="stack">
      <Link to={`/teams/${team.id}`} className="small">
        ← {team.name}
      </Link>
      <h1>{existing ? `${existing.name}を編集` : '選手を追加'}</h1>

      <div className="card row">
        <select value={role} onChange={(e) => setRole(e.target.value as PlayerRole)} aria-label="生成する選手の役割">
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </select>
        <button onClick={reroll}>ランダムに生成</button>
        <span className="muted small">名前と能力を作り直します(背番号はそのまま)。</span>
      </div>

      <div className="card form-grid">
        <label>
          名前
          <input value={draft.name} maxLength={24} onChange={(e) => update({ name: e.target.value })} />
        </label>
        <label>
          背番号
          <input
            type="number"
            min={0}
            max={999}
            value={Number.isNaN(draft.number) ? '' : draft.number}
            onChange={(e) => update({ number: e.target.valueAsNumber })}
          />
        </label>
        <label>
          投
          <select value={draft.throws} onChange={(e) => update({ throws: e.target.value as 'R' | 'L' })}>
            <option value="R">{HAND_LABEL.R}投げ</option>
            <option value="L">{HAND_LABEL.L}投げ</option>
          </select>
        </label>
        <label>
          打
          <select value={draft.bats} onChange={(e) => update({ bats: e.target.value as Hand })}>
            <option value="R">{HAND_LABEL.R}打ち</option>
            <option value="L">{HAND_LABEL.L}打ち</option>
            <option value="S">{HAND_LABEL.S}打ち</option>
          </select>
        </label>
        <label className="checkbox">
          <input type="checkbox" checked={draft.foreign} onChange={(e) => update({ foreign: e.target.checked })} />
          外国人選手
        </label>
      </div>

      <fieldset className="card">
        <legend>守備位置</legend>
        <div className="row">
          {FIELD_POSITIONS.map((pos) => (
            <label key={pos} className="chip">
              <input
                type="checkbox"
                checked={draft.positions.includes(pos)}
                onChange={(e) => togglePosition(pos, e.target.checked)}
              />
              {POSITION_NAME[pos]}
            </label>
          ))}
        </div>
      </fieldset>

      {draft.pitching && (
        <RatingGroup
          title="投手能力"
          labels={PITCHING_LABEL}
          values={draft.pitching}
          onChange={(pitching) => update({ pitching })}
        />
      )}
      <RatingGroup
        title="打撃能力"
        labels={BATTING_LABEL}
        values={draft.batting}
        onChange={(batting) => update({ batting })}
      />
      <RatingGroup
        title="守備能力"
        labels={FIELDING_LABEL}
        values={draft.fielding}
        onChange={(fielding) => update({ fielding })}
      />

      {showErrors && errors.length > 0 && (
        <ul className="error-list">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      <div className="row">
        <button className="primary" onClick={submit}>
          保存
        </button>
        <button onClick={back}>キャンセル</button>
      </div>
    </section>
  )
}

interface RatingGroupProps<T extends object> {
  title: string
  labels: Record<keyof T, string>
  values: T
  onChange: (values: T) => void
}

function RatingGroup<T extends object>({ title, labels, values, onChange }: RatingGroupProps<T>) {
  const keys = Object.keys(labels) as (keyof T)[]
  return (
    <fieldset className="card">
      <legend>{title}</legend>
      <div className="ratings">
        {keys.map((key) => {
          const value = values[key] as number
          return (
            <label key={String(key)} className="rating">
              <span>{labels[key]}</span>
              <input
                type="range"
                min={1}
                max={100}
                value={value}
                onChange={(e) => onChange({ ...values, [key]: e.target.valueAsNumber })}
              />
              <Grade value={value} />
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

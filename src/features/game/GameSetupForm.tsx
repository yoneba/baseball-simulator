import { useState } from 'react'
import { Link } from 'react-router'
import { LEAGUE_NAME, resolveGameRules } from '../../domain/rules'
import type { Team } from '../../domain/types'
import { validateLineup, validateRoster } from '../../domain/validate'
import type { Controller, Side } from '../../sim/game'
import { randomSeed } from '../../sim/rng'
import { useStore } from '../../store/context'
import { useLiveGame } from './liveGameContext'

type Managed = 'none' | 'away' | 'home' | 'both'

const MANAGED_LABEL: Record<Managed, string> = {
  none: '観戦のみ(両チームCPU)',
  away: 'ビジターを采配',
  home: 'ホームを采配',
  both: '両チームを采配',
}

function TeamSelect({ label, value, teams, onChange }: { label: string; value: string; teams: Team[]; onChange: (id: string) => void }) {
  return (
    <label>
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {(['central', 'pacific'] as const).map((league) => (
          <optgroup key={league} label={LEAGUE_NAME[league]}>
            {teams
              .filter((t) => t.league === league)
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
          </optgroup>
        ))}
      </select>
    </label>
  )
}

export function GameSetupForm() {
  const { data } = useStore()
  const { start } = useLiveGame()
  const { teams } = data
  const [awayId, setAwayId] = useState(teams[0]?.id ?? '')
  const [homeId, setHomeId] = useState(teams[1]?.id ?? '')
  const [managed, setManaged] = useState<Managed>('home')
  const [seed, setSeed] = useState('')

  if (teams.length < 2) {
    return (
      <div className="card stack">
        <p>試合をするには2チーム以上必要です。</p>
        <Link to="/teams">チームを作成する</Link>
      </div>
    )
  }

  const away = teams.find((t) => t.id === awayId)
  const home = teams.find((t) => t.id === homeId)
  const rules = home ? resolveGameRules(home.league, data.leagueRules) : null
  const problems: string[] = []
  if (away && home && away.id === home.id) problems.push('同じチーム同士では対戦できません。')
  for (const team of [away, home]) {
    if (!team || !rules) continue
    const errors = [...validateRoster(team, rules), ...validateLineup(team, rules)]
    if (errors.length > 0) problems.push(`${team.name}: ${errors[0]}${errors.length > 1 ? ` ほか${errors.length - 1}件` : ''}`)
  }
  const interleague = away && home && away.league !== home.league

  const begin = () => {
    if (!away || !home || !rules || problems.length > 0) return
    const controller = (side: Side): Controller => (managed === 'both' || managed === side ? 'user' : 'cpu')
    const parsed = Number.parseInt(seed, 10)
    start({
      away: structuredClone(away),
      home: structuredClone(home),
      seed: Number.isFinite(parsed) ? parsed >>> 0 : randomSeed(),
      rules,
      controllers: { away: controller('away'), home: controller('home') },
    })
  }

  return (
    <div className="card stack">
      <h2>試合設定</h2>
      <div className="form-grid">
        <TeamSelect label="ビジター(先攻)" value={awayId} teams={teams} onChange={setAwayId} />
        <TeamSelect label="ホーム(後攻)" value={homeId} teams={teams} onChange={setHomeId} />
        <label>
          采配
          <select value={managed} onChange={(e) => setManaged(e.target.value as Managed)}>
            {(Object.keys(MANAGED_LABEL) as Managed[]).map((m) => (
              <option key={m} value={m}>
                {MANAGED_LABEL[m]}
              </option>
            ))}
          </select>
        </label>
        <label>
          シード値(任意)
          <input inputMode="numeric" placeholder="空欄でランダム" value={seed} onChange={(e) => setSeed(e.target.value.replace(/\D/g, ''))} />
        </label>
      </div>
      {home && rules && (
        <p className="muted small">
          {interleague && <span className="badge ok">交流戦</span>} {LEAGUE_NAME[home.league]}主催のため
          {rules.dh ? 'DHあり' : 'DHなし(投手も打席に立ちます)'}、延長{rules.maxInnings}回まで。
        </p>
      )}
      {problems.length > 0 && (
        <ul className="error-list">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
      <div>
        <button className="primary" onClick={begin} disabled={problems.length > 0}>
          プレイボール
        </button>
      </div>
    </div>
  )
}

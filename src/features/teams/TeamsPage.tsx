import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { downloadText, pickTextFile } from '../../app/files'
import { LEAGUE_NAME } from '../../domain/rules'
import type { League, Team } from '../../domain/types'
import { validateLineup, validateRoster } from '../../domain/validate'
import { useStore } from '../../store/context'
import { exportTeams, parseTeamsFile } from '../../store/transfer'
import { createEmptyTeam, createRandomTeam } from './teamActions'
import './teams.css'

const LEAGUES: League[] = ['central', 'pacific']

export function TeamsPage() {
  const { data, dispatch } = useStore()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const league: League = params.get('league') === 'pacific' ? 'pacific' : 'central'
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const teams = data.teams.filter((t) => t.league === league)
  const rules = data.leagueRules[league]

  const addTeam = (team: Team) => {
    dispatch({ type: 'upsertTeam', team })
    navigate(`/teams/${team.id}`)
  }

  const importFile = async () => {
    const text = await pickTextFile()
    if (text === null) return
    try {
      const imported = parseTeamsFile(text)
      dispatch({ type: 'importTeams', teams: imported })
      setMessage({ kind: 'ok', text: `${imported.length}チームを読み込みました。` })
    } catch (e) {
      setMessage({ kind: 'error', text: (e as Error).message })
    }
  }

  const reset = () => {
    if (confirm('すべてのチームと試合記録を削除して、初期状態に戻しますか?')) {
      dispatch({ type: 'reset' })
      setMessage({ kind: 'ok', text: '初期状態に戻しました。' })
    }
  }

  return (
    <section className="stack">
      <div className="row page-head">
        <h1>チーム</h1>
        <div className="row">
          <button onClick={importFile}>読み込み</button>
          <button onClick={() => downloadText('teams.json', exportTeams(data.teams))} disabled={data.teams.length === 0}>
            全チームを書き出し
          </button>
        </div>
      </div>

      {message && (
        <p className={message.kind === 'ok' ? 'notice' : 'error-list'} role="status">
          {message.text}
        </p>
      )}

      <div className="league-tabs" role="tablist" aria-label="リーグ">
        {LEAGUES.map((l) => (
          <button
            key={l}
            role="tab"
            aria-selected={l === league}
            className={`league-tab league-${l}`}
            onClick={() => setParams({ league: l }, { replace: true })}
          >
            {LEAGUE_NAME[l]}
            <span className="muted">{data.teams.filter((t) => t.league === l).length}</span>
          </button>
        ))}
      </div>

      <div className="team-grid">
        {teams.map((team) => {
          const problems = validateRoster(team, rules).length + validateLineup(team, rules).length
          return (
            <Link key={team.id} to={`/teams/${team.id}`} className="team-card card">
              <span className="team-swatch" style={{ background: team.color }} aria-hidden="true" />
              <span className="team-card-body">
                <strong>{team.name}</strong>
                <span className="muted">
                  {team.shortName} · {team.roster.length}人
                </span>
                {problems === 0 ? (
                  <span className="badge ok">試合可能</span>
                ) : (
                  <span className="badge warn">{problems}件の問題</span>
                )}
              </span>
            </Link>
          )
        })}
        {teams.length === 0 && <p className="muted">{LEAGUE_NAME[league]}にはまだチームがありません。</p>}
      </div>

      <div className="row">
        <button className="primary" onClick={() => addTeam(createRandomTeam(league))}>
          ランダム生成でチームを作成
        </button>
        <button onClick={() => addTeam(createEmptyTeam(league))}>空のチームを作成</button>
      </div>

      <div className="card stack">
        <h2>リーグ設定</h2>
        <label className="row">
          <input
            type="checkbox"
            checked={rules.dh}
            onChange={(e) => dispatch({ type: 'setLeagueRules', league, rules: { ...rules, dh: e.target.checked } })}
          />
          {LEAGUE_NAME[league]}で指名打者制(DH)を採用する
        </label>
        <p className="muted small">
          交流戦では、ホームチームのリーグのルールが適用されます。延長は{rules.maxInnings}回まで、
          一軍登録は{rules.rosterLimit}人(ベンチ入り{rules.benchLimit}人)、外国人枠は{rules.foreignLimit}人です。
        </p>
        <div>
          <button className="danger" onClick={reset}>
            データを初期化
          </button>
        </div>
      </div>
    </section>
  )
}

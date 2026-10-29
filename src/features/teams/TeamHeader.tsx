import { Link } from 'react-router'
import { LEAGUE_NAME } from '../../domain/rules'
import type { Team } from '../../domain/types'

export function TeamNotFound() {
  return (
    <section className="stack">
      <h1>チームが見つかりません</h1>
      <Link to="/teams">チーム一覧に戻る</Link>
    </section>
  )
}

export function TeamHeader({ team, current }: { team: Team; current: 'roster' | 'lineup' }) {
  return (
    <div className="stack team-header">
      <Link to={`/teams?league=${team.league}`} className="small">
        ← {LEAGUE_NAME[team.league]}のチーム一覧
      </Link>
      <div className="row">
        <span className="team-swatch large" style={{ background: team.color }} aria-hidden="true" />
        <h1>{team.name}</h1>
      </div>
      <nav className="sub-tabs" aria-label="チーム編集メニュー">
        <Link to={`/teams/${team.id}`} aria-current={current === 'roster' ? 'page' : undefined}>
          基本情報・選手
        </Link>
        <Link to={`/teams/${team.id}/lineup`} aria-current={current === 'lineup' ? 'page' : undefined}>
          オーダー
        </Link>
      </nav>
    </div>
  )
}

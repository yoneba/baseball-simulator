import { Link } from 'react-router'
import { useStore } from '../../store/context'
import type { SavedGame } from '../../store/data'
import './game.css'

const dateFormat = new Intl.DateTimeFormat('ja-JP', { dateStyle: 'medium', timeStyle: 'short' })

function resultLabel(g: SavedGame): string {
  const { result, innings } = g.summary
  const extra = innings > g.setup.rules.regulationInnings ? `・延長${innings}回` : ''
  if (result === 'tie') return `引き分け${extra}`
  return `${g.setup[result].shortName}勝利${extra}`
}

export function RecordsPage() {
  const { data, dispatch } = useStore()
  const games = data.savedGames

  return (
    <section className="stack">
      <h1>記録</h1>
      {games.length === 0 ? (
        <div className="card stack">
          <p className="muted">まだ試合の記録がありません。試合を最後まで行うと、ここに保存されます。</p>
          <div>
            <Link to="/game" className="button primary">
              試合をする
            </Link>
          </div>
        </div>
      ) : (
        <ul className="records-list">
          {games.map((g) => (
            <li key={g.id} className="card record">
              <Link to={`/records/${g.id}`} className="record-main">
                <span className="record-score">
                  <span className="team-dot" style={{ background: g.setup.away.color }} aria-hidden="true" />
                  {g.setup.away.shortName} {g.summary.score.away} - {g.summary.score.home} {g.setup.home.shortName}
                  <span className="team-dot after" style={{ background: g.setup.home.color }} aria-hidden="true" />
                </span>
                <span className="muted small">
                  {dateFormat.format(new Date(g.playedAt))} ・ {resultLabel(g)}
                  {g.setup.away.league !== g.setup.home.league && ' ・ 交流戦'}
                </span>
              </Link>
              <button
                className="link danger small"
                onClick={() => confirm('この試合の記録を削除しますか?') && dispatch({ type: 'deleteSavedGame', gameId: g.id })}
              >
                削除
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

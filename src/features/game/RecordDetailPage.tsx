import { useMemo } from 'react'
import { Link, useParams } from 'react-router'
import { replayGame } from '../../sim/game'
import { useStore } from '../../store/context'
import { BoxScoreView } from './BoxScoreView'
import { gameTitle } from './labels'
import { PlayByPlay } from './PlayByPlay'
import './game.css'

const dateFormat = new Intl.DateTimeFormat('ja-JP', { dateStyle: 'long', timeStyle: 'short' })

export function RecordDetailPage() {
  const { gameId } = useParams()
  const { data } = useStore()
  const saved = data.savedGames.find((g) => g.id === gameId)
  // Saved games keep only the setup and user moves; the full game is rebuilt by replay.
  const game = useMemo(() => (saved ? replayGame(saved.setup, saved.actions) : null), [saved])

  if (!saved || !game) {
    return (
      <section className="stack">
        <h1>記録が見つかりません</h1>
        <Link to="/records">記録一覧に戻る</Link>
      </section>
    )
  }

  return (
    <section className="stack">
      <Link to="/records" className="small">
        ← 記録一覧
      </Link>
      <div>
        <h1>
          {saved.setup.away.name} 対 {saved.setup.home.name}
        </h1>
        <p className="muted">
          {dateFormat.format(new Date(saved.playedAt))} ・ {gameTitle(game)} ・ シード値 {saved.setup.seed}
        </p>
      </div>
      <BoxScoreView game={game} />
      <PlayByPlay game={game} />
    </section>
  )
}

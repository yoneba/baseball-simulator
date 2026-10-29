import { GameSetupForm } from './GameSetupForm'
import { useLiveGame } from './liveGameContext'
import { LiveGameView } from './LiveGameView'
import '../teams/teams.css'
import './game.css'

export function GamePage() {
  const { game } = useLiveGame()
  return (
    <section className="stack">
      <h1>試合</h1>
      {game ? <LiveGameView /> : <GameSetupForm />}
    </section>
  )
}

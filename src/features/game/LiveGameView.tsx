import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { buildBoxScore, formatInnings } from '../../sim/boxscore'
import { battingSide, fieldingSide } from '../../sim/game'
import { BoxScoreView } from './BoxScoreView'
import { Diamond } from './Diamond'
import { gameTitle, HALF } from './labels'
import { ManagerPanel } from './ManagerPanel'
import { PlayByPlay } from './PlayByPlay'
import { useLiveGame } from './liveGameContext'
import { Scoreboard } from './Scoreboard'

export function LiveGameView() {
  const { game, advance, discard, version, savedId } = useLiveGame()
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(800)
  const final = game?.status === 'final'

  useEffect(() => {
    if (!playing || final) return
    const timer = setInterval(() => advance('pa'), speed)
    return () => clearInterval(timer)
  }, [playing, final, speed, advance])

  if (!game) return null
  const box = buildBoxScore(game)
  const bat = battingSide(game)
  const fld = fieldingSide(game)
  const offense = game[bat]
  const defense = game[fld]
  const batter = offense.players[offense.order[offense.batterIndex].playerId]
  const batterLine = box.batting[bat].find((l) => l.playerId === batter.id)
  const pitcher = defense.players[defense.pitcherId]
  const pitcherLine = defense.pitcherLines[pitcher.id]

  return (
    <div className="stack live-game">
      {final ? (
        <>
          <div className="card final-banner">
            <strong>試合終了 {gameTitle(game)}</strong>
            <span>
              {game.setup.away.shortName} {game.score.away} - {game.score.home} {game.setup.home.shortName}
            </span>
            {savedId && (
              <Link to={`/records/${savedId}`} className="small">
                記録に保存しました
              </Link>
            )}
          </div>
          <BoxScoreView game={game} />
        </>
      ) : (
        <Scoreboard game={game} box={box} />
      )}

      {!final && (
        <div className="card situation">
          <div className="situation-inning">
            <strong>
              {game.inning}回{HALF[game.half]}
            </strong>
            <span className="muted small">{game.setup[bat].shortName}の攻撃</span>
          </div>
          <Diamond bases={game.bases} outs={game.outs} />
          <dl className="matchup">
            <div>
              <dt>打者</dt>
              <dd>
                {offense.batterIndex + 1}番 {batter.name}
                <span className="muted small">
                  {' '}
                  {batterLine ? `${batterLine.ab}打数${batterLine.h}安打` : ''}
                </span>
              </dd>
            </div>
            <div>
              <dt>投手</dt>
              <dd>
                {pitcher.name}
                <span className="muted small">
                  {' '}
                  {formatInnings(pitcherLine.outs)}回 {pitcherLine.pitches}球
                </span>
              </dd>
            </div>
          </dl>
        </div>
      )}

      {!final && (
        <div className="card controls">
          <div className="row">
            <button className="primary" onClick={() => advance('pa')} disabled={playing}>
              1打席進む
            </button>
            <button onClick={() => advance('half')} disabled={playing}>
              イニング終了まで
            </button>
            <button onClick={() => setPlaying((p) => !p)}>{playing ? '一時停止' : '自動再生'}</button>
            <button onClick={() => advance('end')} disabled={playing}>
              試合終了まで
            </button>
          </div>
          <label className="row small">
            再生速度
            <input
              type="range"
              min={150}
              max={2000}
              step={50}
              value={2150 - speed}
              onChange={(e) => setSpeed(2150 - e.target.valueAsNumber)}
              aria-label="自動再生の速度"
            />
          </label>
        </div>
      )}

      <ManagerPanel />

      <PlayByPlay game={game} version={version} />

      <div className="row">
        <button
          className={final ? 'primary' : 'danger'}
          onClick={() => (final || confirm('試合を中止しますか? この試合は保存されません。')) && discard()}
        >
          {final ? '新しい試合へ' : '試合を中止'}
        </button>
      </div>
    </div>
  )
}

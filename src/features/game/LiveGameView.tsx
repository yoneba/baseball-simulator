import { useEffect, useState } from 'react'
import { buildBoxScore, formatInnings } from '../../sim/boxscore'
import { describeEvent, displayName } from '../../sim/describe'
import { battingSide, fieldingSide, type GameEvent, type GameState } from '../../sim/game'
import { Diamond } from './Diamond'
import { useLiveGame } from './liveGameContext'
import { Scoreboard } from './Scoreboard'

const HALF = { top: '表', bottom: '裏' } as const

function resultText(g: GameState): string {
  if (g.result === 'tie') return '引き分け'
  return `${g.setup[g.result!].name}の勝利`
}

export function LiveGameView() {
  const { game, advance, discard, version } = useLiveGame()
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
      <Scoreboard game={game} box={box} />

      {final ? (
        <div className="card final-banner">
          <strong>試合終了 {resultText(game)}</strong>
          <span>
            {game.setup.away.shortName} {game.score.away} - {game.score.home} {game.setup.home.shortName}
          </span>
        </div>
      ) : (
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

function eventClass(e: GameEvent): string {
  if (e.type === 'pa') return e.runs.length > 0 ? 'pbp scored' : 'pbp'
  if (e.type === 'sub') return 'pbp sub'
  return 'pbp marker'
}

/** 実況: newest first, with the inning on each plate appearance. */
function PlayByPlay({ game }: { game: GameState; version: number }) {
  const items = game.events.map((e, i) => ({ e, i })).reverse()
  return (
    <div className="card">
      <h2>実況</h2>
      {items.length === 0 && <p className="muted">プレイボール!{displayName(game.away.players[game.away.order[0].playerId])}が打席に向かいます。</p>}
      <ol className="pbp-list" aria-live="polite">
        {items.map(({ e, i }) => (
          <li key={i} className={eventClass(e)}>
            {e.type === 'pa' && (
              <span className="pbp-inning">
                {e.inning}回{HALF[e.half]}
              </span>
            )}
            {describeEvent(game, e, i)}
          </li>
        ))}
      </ol>
    </div>
  )
}

import type { Player } from '../domain/types'
import type { GameEvent, GameState, PAEvent, Side } from './game'

const BASE_NAME = { 1: '一塁', 2: '二塁', 3: '三塁' } as const
const HALF_NAME = { top: '表', bottom: '裏' } as const

/** Players are shown by surname, as in Japanese broadcasts. */
export function displayName(player: Player | undefined): string {
  return player?.name.split(/[\s　]/)[0] ?? '?'
}

/** Stable pseudo-random choice so the same event always reads the same way. */
function variant<T>(e: PAEvent, index: number, options: readonly T[]): T {
  let h = index * 31 + e.pitches * 7
  for (const ch of e.batterId) h = (h * 33 + ch.charCodeAt(0)) >>> 0
  return options[h % options.length]
}

const SINGLE = ['センター前ヒット', 'レフト前ヒット', 'ライト前ヒット', '三遊間を破るヒット', '一二塁間を抜けるヒット', '内野安打']
const DOUBLE = ['左中間を破るツーベース', '右中間を破るツーベース', 'レフト線へのツーベース', 'ライト線へのツーベース']
const TRIPLE = ['右中間を破るスリーベース', 'ライトオーバーのスリーベース', '左中間フェンス直撃のスリーベース']
const HOMER_TO = ['レフトスタンドへ', 'ライトスタンドへ', 'バックスクリーンへ', '左中間スタンドへ', '右中間スタンドへ']
const HOMER_KIND = ['ソロホームラン', 'ツーランホームラン', 'スリーランホームラン', '満塁ホームラン']
const GROUNDER = ['ショートゴロ', 'セカンドゴロ', 'サードゴロ', 'ファーストゴロ', 'ピッチャーゴロ']
const FLY = ['センターフライ', 'レフトフライ', 'ライトフライ', 'ショートフライ', 'セカンドフライ']
const DEEP_FLY = ['センターへの犠牲フライ', 'レフトへの犠牲フライ', 'ライトへの犠牲フライ']
const LINER = ['ショートライナー', 'セカンドライナー', 'センターライナー', 'サードライナー']
const ERROR = ['サードゴロ…これをサードがエラー', 'ショートゴロ…ショートが一塁へ悪送球', 'セカンドゴロ…セカンドがファンブル']
const STRIKEOUT = ['空振り三振', '見逃し三振', '空振り三振']

function playText(e: PAEvent, index: number): string {
  const runsOnBase = e.basesBefore.filter(Boolean).length
  switch (e.outcome) {
    case 'K':
      return variant(e, index, STRIKEOUT)
    case 'BB':
      return 'フォアボール'
    case 'HBP':
      return 'デッドボール'
    case '1B':
      return variant(e, index, SINGLE)
    case '2B':
      return variant(e, index, DOUBLE)
    case '3B':
      return variant(e, index, TRIPLE)
    case 'HR':
      return `${variant(e, index, HOMER_TO)}${HOMER_KIND[runsOnBase]}`
    case 'GO': {
      const grounder = variant(e, index, GROUNDER)
      if (e.special === 'DP') return `${grounder}、併殺打`
      if (e.special === 'FC') return `${grounder}、一塁走者は二塁フォースアウト`
      return grounder
    }
    case 'FO':
      return e.special === 'SF' ? variant(e, index, DEEP_FLY) : variant(e, index, FLY)
    case 'LO':
      return e.special === 'DP' ? `${variant(e, index, LINER)}、一塁走者戻れずダブルプレー` : variant(e, index, LINER)
    case 'E':
      return variant(e, index, ERROR)
  }
}

const EXCITED: PAEvent['outcome'][] = ['2B', '3B', 'HR']

function describePA(g: GameState, e: PAEvent, index: number): string {
  const bat: Side = e.half === 'top' ? 'away' : 'home'
  const name = (id: string) => displayName(g[bat].players[id])
  let text = `${name(e.batterId)}、${playText(e, index)}`
  text += EXCITED.includes(e.outcome) || e.runs.length > 0 ? '！' : '。'

  const runners = e.runs.filter((r) => r.playerId !== e.batterId)
  if (runners.length === 1 && e.outcome !== 'HR') {
    const from = e.movements.find((m) => m.playerId === runners[0].playerId)?.from
    const longRun = from === 1 || (from === 2 && e.outcome === '1B')
    const origin = typeof from === 'number' ? `${BASE_NAME[from]}から` : ''
    text += `${origin}${name(runners[0].playerId)}が${longRun ? '一気に' : ''}ホームイン。`
  } else if (runners.length > 1 && e.outcome !== 'HR') {
    text += `${runners.map((r) => name(r.playerId)).join('、')}がホームイン。`
  }
  if (e.runs.length > 0) {
    text += ` ${g.setup.away.shortName} ${e.scoreAfter.away} - ${e.scoreAfter.home} ${g.setup.home.shortName}`
  }
  return text
}

export function describeEvent(g: GameState, e: GameEvent, index: number): string {
  switch (e.type) {
    case 'pa':
      return describePA(g, e, index)
    case 'sub': {
      const team = g[e.side]
      const inName = displayName(team.players[e.inId])
      const outName = displayName(team.players[e.outId])
      if (e.kind === 'pitcher') return `${team.team.shortName}、ピッチャー交代。${outName}に代わって${inName}。`
      if (e.kind === 'pinchHitter') return `${team.team.shortName}、${outName}に代わりまして代打、${inName}。`
      return `${team.team.shortName}、${outName}に代わりまして代走、${inName}。`
    }
    case 'halfEnd':
      return `${e.inning}回${HALF_NAME[e.half]}終了${e.runs > 0 ? `(この回${e.runs}点)` : ''}`
    case 'gameEnd': {
      if (e.result === 'tie') return `延長12回、規定により引き分け。${g.score.away} - ${g.score.home}`
      const winner = g.setup[e.result].name
      if (e.walkoff) return `サヨナラ！ ${winner}の勝利！`
      return `試合終了。${g.score.away} - ${g.score.home}で${winner}の勝利。`
    }
  }
}

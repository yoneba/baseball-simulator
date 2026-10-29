import type { GameState } from '../../sim/game'

export const HALF = { top: '表', bottom: '裏' } as const

/** Result headline, e.g. 「横浜のサヨナラ勝利(延長11回)」. */
export function gameTitle(game: GameState): string {
  const last = game.events.at(-1)
  const extra = game.inning > game.setup.rules.regulationInnings ? `(延長${game.inning}回)` : ''
  const walkoff = last?.type === 'gameEnd' && last.walkoff ? 'サヨナラ' : ''
  if (game.result === 'tie') return `引き分け${extra}`
  return `${game.setup[game.result!].shortName}の${walkoff}勝利${extra}`
}

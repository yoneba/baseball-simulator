import type { League, LeagueRules, LineupSlot, Lineup } from './types'

export const LEAGUE_NAME: Record<League, string> = {
  central: 'セ・リーグ',
  pacific: 'パ・リーグ',
}

const BASE_RULES: Omit<LeagueRules, 'dh'> = {
  regulationInnings: 9,
  maxInnings: 12,
  rosterLimit: 31,
  benchLimit: 26,
  foreignLimit: 4,
  foreignPerRoleLimit: 3,
}

/** パ uses the DH; セ adopts it from 2027, so it is on by default but can be turned off. */
export const DEFAULT_LEAGUE_RULES: Record<League, LeagueRules> = {
  central: { ...BASE_RULES, dh: true },
  pacific: { ...BASE_RULES, dh: true },
}

/** The home team's league decides the rules, including the DH in 交流戦. */
export function resolveGameRules(
  homeLeague: League,
  rules: Record<League, LeagueRules> = DEFAULT_LEAGUE_RULES,
): LeagueRules {
  return rules[homeLeague]
}

/** Without the DH, the starting pitcher bats in the DH's slot. */
export function resolveBattingOrder(lineup: Lineup, useDH: boolean): LineupSlot[] {
  if (useDH) return lineup.order
  return lineup.order.map((slot) =>
    slot.position === 'DH' ? { playerId: lineup.startingPitcherId, position: 'P' } : slot,
  )
}

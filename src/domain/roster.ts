import type { Lineup, Player, Team } from './types'

export function emptyLineup(): Lineup {
  return {
    order: [
      { playerId: '', position: 'CF' },
      { playerId: '', position: 'SS' },
      { playerId: '', position: 'RF' },
      { playerId: '', position: '1B' },
      { playerId: '', position: 'DH' },
      { playerId: '', position: '3B' },
      { playerId: '', position: 'LF' },
      { playerId: '', position: '2B' },
      { playerId: '', position: 'C' },
    ],
    startingPitcherId: '',
    bullpen: [],
    benchOut: [],
  }
}

/** Removes a player from the roster and every lineup reference to them. */
export function removePlayer(team: Team, playerId: string): Team {
  const { lineup } = team
  return {
    ...team,
    roster: team.roster.filter((p) => p.id !== playerId),
    lineup: {
      order: lineup.order.map((s) => (s.playerId === playerId ? { ...s, playerId: '' } : s)),
      startingPitcherId: lineup.startingPitcherId === playerId ? '' : lineup.startingPitcherId,
      bullpen: lineup.bullpen.filter((id) => id !== playerId),
      benchOut: lineup.benchOut.filter((id) => id !== playerId),
    },
  }
}

/**
 * Adds or replaces a player. New relievers join the end of the bullpen, and a
 * player who can no longer pitch leaves the pitching staff.
 */
export function upsertPlayer(team: Team, player: Player): Team {
  const exists = team.roster.some((p) => p.id === player.id)
  const roster = exists ? team.roster.map((p) => (p.id === player.id ? player : p)) : [...team.roster, player]
  let { lineup } = team
  if (!player.pitching) {
    lineup = {
      ...lineup,
      startingPitcherId: lineup.startingPitcherId === player.id ? '' : lineup.startingPitcherId,
      bullpen: lineup.bullpen.filter((id) => id !== player.id),
    }
  } else if (!exists && player.pitching.stamina < 50) {
    lineup = { ...lineup, bullpen: [...lineup.bullpen, player.id] }
  }
  return { ...team, roster, lineup }
}

/** Lowest uniform number not used on the team, starting from `from`. */
export function freeNumber(team: Team, from = 0): number {
  const used = new Set(team.roster.map((p) => p.number))
  let n = from
  while (used.has(n)) n++
  return n
}

/** Rating grade as used in Japanese baseball games: S (90+) down to G. */
export function ratingGrade(value: number): string {
  if (value >= 90) return 'S'
  if (value >= 80) return 'A'
  if (value >= 70) return 'B'
  if (value >= 60) return 'C'
  if (value >= 50) return 'D'
  if (value >= 40) return 'E'
  if (value >= 30) return 'F'
  return 'G'
}

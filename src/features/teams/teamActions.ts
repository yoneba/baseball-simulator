import { generatePlayer, generateTeam, type PlayerRole } from '../../data/generate'
import { randomTeamIdentity } from '../../data/teams'
import { emptyLineup, freeNumber } from '../../domain/roster'
import type { League, Player, Team } from '../../domain/types'
import { displayName } from '../../sim/describe'
import { createRng, randomSeed } from '../../sim/rng'
import { newId } from '../../store/data'

export function createRandomTeam(league: League): Team {
  const rng = createRng(randomSeed())
  return generateTeam(rng, { id: newId(), league, ...randomTeamIdentity(rng) })
}

export function createEmptyTeam(league: League): Team {
  return {
    id: newId(),
    name: '新しいチーム',
    shortName: '新',
    league,
    color: '#334155',
    roster: [],
    lineup: emptyLineup(),
  }
}

/** A random player for `role` that fits the team: free number, distinct surname. */
export function createRandomPlayer(team: Team, role: PlayerRole, id: string = newId()): Player {
  return generatePlayer(createRng(randomSeed()), role, {
    id,
    number: freeNumber(team, role === 'SP' || role === 'RP' ? 11 : 0),
    usedSurnames: new Set(team.roster.map(displayName)),
  })
}

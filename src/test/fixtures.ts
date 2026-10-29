import type { FieldPosition, League, Player, Position, Team } from '../domain/types'

const AVG = 50

export function makePlayer(id: string, overrides: Partial<Player> = {}): Player {
  return {
    id,
    name: `選手${id}`,
    number: String(Number(id.replace(/\D/g, '')) || 0),
    bats: 'R',
    throws: 'R',
    positions: ['1B'],
    foreign: false,
    batting: { contact: AVG, power: AVG, eye: AVG, speed: AVG },
    fielding: { range: AVG, arm: AVG, hands: AVG },
    ...overrides,
  }
}

export function makePitcher(id: string, overrides: Partial<Player> = {}): Player {
  return makePlayer(id, {
    positions: ['P'],
    batting: { contact: 15, power: 10, eye: 15, speed: 30 },
    pitching: { stuff: AVG, control: AVG, stamina: AVG },
    ...overrides,
  })
}

const ORDER: Position[] = ['CF', 'SS', 'RF', '1B', 'DH', '3B', 'LF', '2B', 'C']

/** An all-average team with a valid lineup: 9 batters, 4 bench players and 12 pitchers. */
export function makeTeam(prefix = 'a', league: League = 'pacific'): Team {
  const batters = ORDER.map((pos, i) =>
    makePlayer(`${prefix}${i + 1}`, {
      number: String(i + 1),
      positions: pos === 'DH' ? ['1B'] : [pos as FieldPosition],
    }),
  )
  const bench = (['C', 'SS', 'LF', '1B'] as FieldPosition[]).map((pos, i) =>
    makePlayer(`${prefix}${10 + i}`, { number: String(10 + i), positions: [pos] }),
  )
  const pitchers = Array.from({ length: 12 }, (_, i) =>
    makePitcher(`${prefix}${20 + i}`, { number: String(20 + i) }),
  )
  return {
    id: `team-${prefix}`,
    name: `チーム${prefix.toUpperCase()}`,
    shortName: prefix.toUpperCase(),
    league,
    color: '#336699',
    roster: [...batters, ...bench, ...pitchers],
    lineup: {
      order: batters.map((p, i) => ({ playerId: p.id, position: ORDER[i] })),
      startingPitcherId: pitchers[0].id,
      bullpen: pitchers.slice(1).map((p) => p.id),
      benchOut: [],
    },
  }
}
